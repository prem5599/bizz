// src/app/api/integrations/[integrationId]/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ShopifyIntegration } from '@/lib/integrations/shopify'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/[integrationId]/sync
 * Get current sync status using existing schema
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { integrationId } = await params
    console.log('📊 Getting sync status for integration:', integrationId)

    // Get integration and verify ownership
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id
            }
          }
        }
      },
      include: {
        organization: true
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    console.log('✅ Integration found:', integration.platform, integration.platformAccountId)

    // Get sync status and statistics using existing schema
    const [webhookStats, dataPointStats, currentSyncStatus] = await Promise.all([
      getRecentWebhookActivity(integrationId),
      getDataPointStatistics(integrationId),
      getCurrentSyncStatus(integration)
    ])

    // Calculate sync health metrics
    const syncHealth = calculateSyncHealth(webhookStats, dataPointStats, integration.lastSyncAt)

    const response = {
      integration: {
        id: integration.id,
        platform: integration.platform,
        platformAccountId: integration.platformAccountId,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt
      },
      sync: {
        status: currentSyncStatus.status,
        isRunning: currentSyncStatus.isRunning,
        canTriggerSync: currentSyncStatus.canTriggerSync,
        nextScheduledSync: currentSyncStatus.nextScheduledSync,
        lastActivity: integration.lastSyncAt || integration.updatedAt
      },
      statistics: {
        totalWebhooks: webhookStats.totalEvents,
        successfulWebhooks: webhookStats.successfulEvents,
        failedWebhooks: webhookStats.failedEvents,
        successRate: webhookStats.successRate,
        totalDataPoints: dataPointStats.totalRecords,
        dataPointsLast24h: dataPointStats.recordsLast24h,
        dataPointsLast7d: dataPointStats.recordsLast7d
      },
      dataPoints: {
        total: dataPointStats.totalRecords,
        byMetricType: dataPointStats.byMetricType,
        lastUpdated: dataPointStats.lastUpdated,
        freshness: dataPointStats.freshness
      },
      recentActivity: webhookStats.recentEvents.slice(0, 10).map(event => ({
        id: event.id,
        topic: event.topic,
        status: event.status,
        receivedAt: event.receivedAt,
        processedAt: event.processedAt,
        error: event.error
      })),
      health: {
        score: syncHealth.healthScore,
        issues: syncHealth.issues,
        recommendations: syncHealth.recommendations
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error getting sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/[integrationId]/sync
 * Trigger a manual sync for the integration
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { integrationId } = await params
    const body = await request.json().catch(() => ({}))
    const { 
      syncType = 'incremental', 
      force = false 
    } = body

    console.log('🔄 Triggering manual sync:', {
      integrationId,
      syncType,
      force,
      userId: session.user.id
    })

    // Get integration and verify ownership
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['owner', 'admin', 'member'] } // Members can trigger syncs
            }
          }
        }
      },
      include: {
        organization: true
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or insufficient permissions' },
        { status: 404 }
      )
    }

    // Check if integration is active
    if (integration.status !== 'active') {
      return NextResponse.json(
        { error: 'Integration is not active. Please reconnect your integration.' },
        { status: 400 }
      )
    }

    // Rate limiting check - prevent too frequent syncs (more lenient)
    if (!force) {
      const recentSyncs = await prisma.webhookEvent.count({
        where: {
          integrationId,
          topic: 'manual_sync',
          receivedAt: {
            gte: new Date(Date.now() - 2 * 60 * 1000) // Last 2 minutes (reduced from 5)
          }
        }
      })

      if (recentSyncs >= 2) { // Reduced from 3 to 2
        const waitTime = 2 * 60 // 2 minutes
        return NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            message: 'Please wait a moment before triggering another sync to avoid overwhelming your store.',
            details: `You can trigger up to 2 syncs every 2 minutes. Please wait ${waitTime} seconds before trying again.`,
            retryAfter: waitTime,
            canRetryAt: new Date(Date.now() + waitTime * 1000).toISOString()
          },
          { status: 429 }
        )
      }
    }

    // Create webhook event to track this manual sync
    const syncEvent = await prisma.webhookEvent.create({
      data: {
        integrationId,
        topic: 'manual_sync',
        status: 'received',
        externalId: `manual_${Date.now()}`,
        metadata: JSON.stringify({
          syncType,
          triggeredBy: session.user.id,
          manual: true,
          force,
          userAgent: request.headers.get('user-agent'),
          ipAddress: getClientIP(request)
        })
      }
    })

    console.log('📝 Sync event created:', syncEvent.id)

    // Update integration status
    const existingMetadata = typeof integration.metadata === 'string' 
      ? JSON.parse(integration.metadata) 
      : integration.metadata || {}
    
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        metadata: JSON.stringify({
          ...existingMetadata,
          lastSyncTriggeredBy: session.user.id,
          lastSyncType: syncType
        })
      }
    })

    // Trigger the actual sync operation asynchronously
    triggerSyncOperation(integration, syncEvent.id, syncType)
      .catch(error => {
        console.error('❌ Sync operation failed:', error)
        // Update webhook event with error
        prisma.webhookEvent.update({
          where: { id: syncEvent.id },
          data: {
            status: 'failed',
            error: error.message,
            processedAt: new Date()
          }
        }).catch(logError => {
          console.error('Failed to update sync event:', logError)
        })
      })

    const response = {
      success: true,
      message: 'Sync operation started successfully',
      sync: {
        id: syncEvent.id,
        status: 'running',
        startedAt: syncEvent.receivedAt,
        type: syncType,
        triggeredBy: session.user.email || session.user.id
      },
      integration: {
        id: integration.id,
        platform: integration.platform,
        lastSyncAt: integration.lastSyncAt
      },
      estimatedDuration: getEstimatedDuration(integration.platform, syncType)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error triggering sync:', error)
    return NextResponse.json(
      { error: 'Failed to trigger sync' },
      { status: 500 }
    )
  }
}

// Helper functions

/**
 * Get recent webhook activity
 */
async function getRecentWebhookActivity(integrationId: string) {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [events, statusCounts] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: { 
        integrationId,
        receivedAt: { gte: last30Days }
      },
      orderBy: { receivedAt: 'desc' },
      take: 20,
      select: {
        id: true,
        topic: true,
        status: true,
        receivedAt: true,
        processedAt: true,
        error: true
      }
    }),
    prisma.webhookEvent.groupBy({
      by: ['status'],
      where: { 
        integrationId,
        receivedAt: { gte: last30Days }
      },
      _count: { id: true }
    })
  ])

  const breakdown = statusCounts.reduce((acc, item) => {
    acc[item.status] = item._count.id
    return acc
  }, {} as Record<string, number>)

  const totalEvents = statusCounts.reduce((sum, item) => sum + item._count.id, 0)
  const successfulEvents = breakdown.processed || 0
  const failedEvents = breakdown.failed || 0
  const successRate = totalEvents > 0 ? Math.round((successfulEvents / totalEvents) * 100) : 0

  return {
    totalEvents,
    successfulEvents,
    failedEvents,
    successRate,
    recentEvents: events
  }
}

/**
 * Get data point statistics
 */
async function getDataPointStatistics(integrationId: string) {
  const now = new Date()
  const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [total, last24hCount, last7dCount, byType, lastUpdated] = await Promise.all([
    prisma.dataPoint.count({ where: { integrationId } }),
    prisma.dataPoint.count({ 
      where: { 
        integrationId, 
        dateRecorded: { gte: last24h } 
      } 
    }),
    prisma.dataPoint.count({ 
      where: { 
        integrationId, 
        dateRecorded: { gte: last7d } 
      } 
    }),
    prisma.dataPoint.groupBy({
      by: ['metricType'],
      where: { integrationId },
      _count: { id: true }
    }),
    prisma.dataPoint.findFirst({
      where: { integrationId },
      orderBy: { dateRecorded: 'desc' },
      select: { dateRecorded: true }
    })
  ])

  const byMetricType = byType.reduce((acc, item) => {
    acc[item.metricType] = item._count.id
    return acc
  }, {} as Record<string, number>)

  const freshness = lastUpdated 
    ? Math.round((Date.now() - new Date(lastUpdated.dateRecorded).getTime()) / (1000 * 60 * 60))
    : null

  return {
    totalRecords: total,
    recordsLast24h: last24hCount,
    recordsLast7d: last7dCount,
    byMetricType,
    lastUpdated: lastUpdated?.dateRecorded || null,
    freshness // hours since last data point
  }
}

/**
 * Get current sync status
 */
async function getCurrentSyncStatus(integration: any) {
  // Check if there are any recent manual sync events that are still running
  const runningSync = await prisma.webhookEvent.findFirst({
    where: {
      integrationId: integration.id,
      topic: 'manual_sync',
      status: 'received', // Still processing
      receivedAt: {
        gte: new Date(Date.now() - 10 * 60 * 1000) // Last 10 minutes
      }
    },
    orderBy: {
      receivedAt: 'desc'
    }
  })

  const isRunning = !!runningSync
  const canTriggerSync = !isRunning && integration.status === 'active'

  // Calculate next scheduled sync (simplified - would depend on sync schedule)
  const nextScheduledSync = new Date(Date.now() + 24 * 60 * 60 * 1000) // Next day

  return {
    status: isRunning ? 'running' : 'idle',
    isRunning,
    canTriggerSync,
    nextScheduledSync,
    currentSyncId: runningSync?.id || null
  }
}

/**
 * Calculate sync health metrics
 */
function calculateSyncHealth(webhookStats: any, dataPointStats: any, lastSyncAt: Date | null) {
  const { totalEvents, successfulEvents, failedEvents, successRate } = webhookStats
  const { totalRecords, recordsLast24h } = dataPointStats

  // Health score calculation (0-100)
  let healthScore = 100
  if (successRate < 90) healthScore -= (90 - successRate)
  if (!lastSyncAt || (Date.now() - lastSyncAt.getTime()) > 48 * 60 * 60 * 1000) {
    healthScore -= 20 // No sync in 48 hours
  }
  if (recordsLast24h === 0) healthScore -= 15 // No recent data

  // Identify issues
  const issues: string[] = []
  const recommendations: string[] = []

  if (successRate < 80) {
    issues.push('Low webhook success rate')
    recommendations.push('Check integration credentials and permissions')
  }
  if (recordsLast24h === 0 && totalRecords > 0) {
    issues.push('No recent data points')
    recommendations.push('Verify data is flowing from your store')
  }
  if (!lastSyncAt || (Date.now() - lastSyncAt.getTime()) > 24 * 60 * 60 * 1000) {
    issues.push('Sync frequency is low')
    recommendations.push('Consider triggering a manual sync')
  }

  return {
    healthScore: Math.max(0, healthScore),
    issues,
    recommendations
  }
}

/**
 * Trigger the actual sync operation
 */
async function triggerSyncOperation(
  integration: any,
  syncEventId: string,
  syncType: string
) {
  const startTime = Date.now()
  
  try {
    console.log('🚀 Starting sync operation:', {
      platform: integration.platform,
      syncType,
      syncEventId
    })

    let result: any

    // Platform-specific sync logic
    switch (integration.platform) {
      case 'shopify':
        result = await performShopifySync(integration, syncType)
        break
      default:
        throw new Error(`Sync not implemented for platform: ${integration.platform}`)
    }

    const processingTime = Date.now() - startTime

    // Update webhook event with success
    await prisma.webhookEvent.update({
      where: { id: syncEventId },
      data: {
        status: 'processed',
        processedAt: new Date(),
        metadata: JSON.stringify({
          ...result.metadata,
          processingTime,
          recordsProcessed: result.recordsProcessed,
          syncResult: result
        })
      }
    })

    // Update integration last sync time
    await prisma.integration.update({
      where: { id: integration.id },
      data: { lastSyncAt: new Date() }
    })

    console.log('✅ Sync completed successfully:', {
      processingTime,
      recordsProcessed: result.recordsProcessed
    })

    return result

  } catch (error) {
    const processingTime = Date.now() - startTime
    console.error('❌ Sync operation failed:', error)

    // Update webhook event with error
    await prisma.webhookEvent.update({
      where: { id: syncEventId },
      data: {
        status: 'failed',
        processedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: JSON.stringify({
          processingTime,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
        })
      }
    })

    throw error
  }
}

/**
 * Perform Shopify-specific sync using existing integration
 */
async function performShopifySync(integration: any, syncType: string) {
  try {
    // Use existing Shopify integration class if available
    if (typeof ShopifyIntegration !== 'undefined') {
      const shopifyIntegration = new ShopifyIntegration(
        integration.accessToken,
        integration.platformAccountId
      )

      // Test connection first
      const isConnected = await shopifyIntegration.testConnection()
      if (!isConnected) {
        throw new Error('Failed to connect to Shopify store')
      }

      // Determine sync days back
      let daysBack: number
      if (syncType === 'full') {
        daysBack = 365 * 2 // 2 years of historical data
      } else {
        daysBack = integration.lastSyncAt ? 30 : 365 // 30 days or 1 year if never synced
      }

      // Perform the sync
      const result = await shopifyIntegration.syncHistoricalData(integration.id, daysBack)

      return {
        recordsProcessed: result.orders + result.customers + result.products,
        errors: [],
        metadata: {
          syncType,
          daysBack,
          platform: 'shopify',
          orders: result.orders,
          customers: result.customers,
          products: result.products
        }
      }
    }

    // Fallback if ShopifyIntegration class not available
    throw new Error('Shopify integration class not available')

  } catch (error) {
    console.error('Shopify sync error:', error)
    throw error
  }
}

/**
 * Get estimated sync duration
 */
function getEstimatedDuration(platform: string, syncType: string): number {
  // Return estimated duration in milliseconds
  const estimates = {
    shopify: {
      incremental: 30000, // 30 seconds
      full: 300000 // 5 minutes
    }
  }

  return estimates[platform as keyof typeof estimates]?.[syncType as keyof typeof estimates['shopify']] || 60000
}

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for') ||
         request.headers.get('x-real-ip') ||
         request.headers.get('cf-connecting-ip') ||
         'unknown'
}