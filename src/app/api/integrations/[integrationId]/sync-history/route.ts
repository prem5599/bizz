// src/app/api/integrations/[integrationId]/sync-history/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/[integrationId]/sync-history
 * Get sync history using WebhookEvent and DataPoint data from existing schema
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
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200)
    const offset = Math.max(parseInt(searchParams.get('offset') || '0'), 0)
    const status = searchParams.get('status') // 'processed', 'failed', 'received'
    const topic = searchParams.get('topic') // webhook topic filter
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    console.log('📜 Fetching sync history:', {
      integrationId,
      limit,
      offset,
      filters: { status, topic, dateFrom, dateTo }
    })

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

    // Build where clause for filtering webhook events
    const whereClause: any = {
      integrationId
    }

    if (status && status !== 'all') {
      whereClause.status = status
    }

    if (topic && topic !== 'all') {
      whereClause.topic = topic
    }

    if (dateFrom || dateTo) {
      whereClause.receivedAt = {}
      if (dateFrom) {
        whereClause.receivedAt.gte = new Date(dateFrom)
      }
      if (dateTo) {
        whereClause.receivedAt.lte = new Date(dateTo)
      }
    }

    // Get webhook events with pagination (these represent sync activities)
    const [webhookEvents, totalCount] = await Promise.all([
      prisma.webhookEvent.findMany({
        where: whereClause,
        orderBy: { receivedAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          topic: true,
          status: true,
          externalId: true,
          error: true,
          receivedAt: true,
          processedAt: true,
          metadata: true
        }
      }),
      prisma.webhookEvent.count({
        where: whereClause
      })
    ])

    // Get summary statistics
    const [statusCounts, topicStats, performanceMetrics] = await Promise.all([
      getWebhookStatusCounts(integrationId),
      getWebhookTopicStatistics(integrationId),
      getWebhookPerformanceMetrics(integrationId)
    ])

    // Transform webhook events for response (treating them as sync activities)
    const formattedHistory = webhookEvents.map(event => ({
      id: event.id,
      type: 'webhook',
      topic: event.topic,
      status: event.status,
      externalId: event.externalId,
      startedAt: event.receivedAt,
      completedAt: event.processedAt,
      duration: event.processedAt 
        ? new Date(event.processedAt).getTime() - new Date(event.receivedAt).getTime()
        : null,
      error: event.error,
      metadata: event.metadata,
      isManual: false // Webhooks are not manual
    }))

    // Get timeline data for charts
    const timelineData = await getTimelineData(integrationId, dateFrom, dateTo)

    // Get available topics for filtering
    const availableTopics = await prisma.webhookEvent.groupBy({
      by: ['topic'],
      where: { integrationId },
      _count: { topic: true }
    })

    const response = {
      integration: {
        id: integration.id,
        platform: integration.platform,
        platformAccountId: integration.platformAccountId,
        lastSyncAt: integration.lastSyncAt
      },
      history: formattedHistory,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
        pages: Math.ceil(totalCount / limit),
        currentPage: Math.floor(offset / limit) + 1
      },
      summary: {
        totalEvents: statusCounts.total,
        statusBreakdown: statusCounts.breakdown,
        topicBreakdown: topicStats,
        performance: performanceMetrics,
        timeline: timelineData
      },
      filters: {
        applied: {
          status: status || 'all',
          topic: topic || 'all',
          dateFrom,
          dateTo
        },
        available: {
          statuses: ['all', 'processed', 'failed', 'received', 'signature_verification_failed'],
          topics: ['all', ...availableTopics.map(t => t.topic)]
        }
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error fetching sync history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sync history' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/integrations/[integrationId]/sync-history
 * Clear webhook event history (keeping recent entries)
 */
export async function DELETE(
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
    const { searchParams } = new URL(request.url)
    
    // Parse parameters
    const olderThan = searchParams.get('olderThan') // Delete entries older than this date
    const keepRecent = parseInt(searchParams.get('keepRecent') || '50') // Keep this many recent entries
    const statusFilter = searchParams.get('status') // Only delete entries with this status

    console.log('🗑️ Clearing webhook history:', {
      integrationId,
      olderThan,
      keepRecent,
      statusFilter
    })

    // Get integration and verify admin ownership
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['owner', 'admin'] } // Only admins can clear history
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or insufficient permissions' },
        { status: 404 }
      )
    }

    // Build delete criteria
    let deleteWhereClause: any = {
      integrationId
    }

    if (statusFilter && statusFilter !== 'all') {
      deleteWhereClause.status = statusFilter
    }

    if (olderThan) {
      deleteWhereClause.receivedAt = {
        lt: new Date(olderThan)
      }
    } else {
      // If no date specified, keep only the most recent entries
      const recentEvents = await prisma.webhookEvent.findMany({
        where: { integrationId },
        orderBy: { receivedAt: 'desc' },
        take: keepRecent,
        select: { id: true }
      })

      if (recentEvents.length > 0) {
        deleteWhereClause.id = {
          notIn: recentEvents.map(event => event.id)
        }
      }
    }

    // Perform the deletion
    const deleteResult = await prisma.webhookEvent.deleteMany({
      where: deleteWhereClause
    })

    console.log('✅ Webhook history cleared:', deleteResult.count, 'entries deleted')

    // Get updated statistics
    const remainingCount = await prisma.webhookEvent.count({
      where: { integrationId }
    })

    return NextResponse.json({
      success: true,
      message: `Cleared ${deleteResult.count} webhook history entries`,
      deleted: deleteResult.count,
      remaining: remainingCount,
      clearedBy: session.user.email || session.user.id,
      clearedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error clearing webhook history:', error)
    return NextResponse.json(
      { error: 'Failed to clear webhook history' },
      { status: 500 }
    )
  }
}

// Helper functions

/**
 * Get webhook status counts and breakdown
 */
async function getWebhookStatusCounts(integrationId: string) {
  const counts = await prisma.webhookEvent.groupBy({
    by: ['status'],
    where: { integrationId },
    _count: { id: true }
  })

  const breakdown = counts.reduce((acc, item) => {
    acc[item.status] = item._count.id
    return acc
  }, {} as Record<string, number>)

  const total = counts.reduce((sum, item) => sum + item._count.id, 0)

  return {
    total,
    breakdown: {
      processed: breakdown.processed || 0,
      failed: breakdown.failed || 0,
      received: breakdown.received || 0,
      signature_verification_failed: breakdown.signature_verification_failed || 0
    }
  }
}

/**
 * Get webhook topic statistics
 */
async function getWebhookTopicStatistics(integrationId: string) {
  const stats = await prisma.webhookEvent.groupBy({
    by: ['topic'],
    where: { integrationId },
    _count: { id: true }
  })

  return stats.reduce((acc, item) => {
    acc[item.topic] = item._count.id
    return acc
  }, {} as Record<string, number>)
}

/**
 * Get webhook performance metrics
 */
async function getWebhookPerformanceMetrics(integrationId: string) {
  const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [recentEvents, totalDataPoints] = await Promise.all([
    prisma.webhookEvent.findMany({
      where: {
        integrationId,
        receivedAt: { gte: last30Days },
        status: 'processed',
        processedAt: { not: null }
      },
      select: {
        receivedAt: true,
        processedAt: true
      }
    }),
    prisma.dataPoint.count({
      where: { integrationId }
    })
  ])

  if (recentEvents.length === 0) {
    return {
      averageProcessingTime: 0,
      averageEventsPerDay: 0,
      totalDataPointsCreated: totalDataPoints,
      eventFrequency: 0,
      successRate: 0
    }
  }

  // Calculate processing times
  const processingTimes = recentEvents
    .filter(event => event.processedAt)
    .map(event => new Date(event.processedAt!).getTime() - new Date(event.receivedAt).getTime())

  const averageProcessingTime = processingTimes.length > 0 
    ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
    : 0

  // Calculate event frequency (events per day)
  const daysCovered = Math.max(1, (Date.now() - last30Days.getTime()) / (1000 * 60 * 60 * 24))
  const eventFrequency = Math.round((recentEvents.length / daysCovered) * 100) / 100

  // Get success rate for last 30 days
  const [successCount, totalCount] = await Promise.all([
    prisma.webhookEvent.count({
      where: {
        integrationId,
        receivedAt: { gte: last30Days },
        status: 'processed'
      }
    }),
    prisma.webhookEvent.count({
      where: {
        integrationId,
        receivedAt: { gte: last30Days }
      }
    })
  ])

  const successRate = totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0

  return {
    averageProcessingTime,
    averageEventsPerDay: Math.round(recentEvents.length / daysCovered),
    totalDataPointsCreated: totalDataPoints,
    eventFrequency,
    successRate,
    period: '30 days'
  }
}

/**
 * Get timeline data for charts using existing schema
 */
async function getTimelineData(integrationId: string, dateFrom?: string, dateTo?: string) {
  const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const endDate = dateTo ? new Date(dateTo) : new Date()

  try {
    // Get daily webhook event counts
    const dailyStats = await prisma.$queryRaw<Array<{
      date: string
      processed_count: bigint
      failed_count: bigint
      total_events: bigint
    }>>`
      SELECT 
        DATE(received_at) as date,
        COUNT(CASE WHEN status = 'processed' THEN 1 END) as processed_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count,
        COUNT(*) as total_events
      FROM "WebhookEvent"
      WHERE integration_id = ${integrationId}
        AND received_at >= ${startDate}
        AND received_at <= ${endDate}
      GROUP BY DATE(received_at)
      ORDER BY date ASC
    `

    // Transform BigInt to number for JSON serialization
    const timeline = dailyStats.map(day => ({
      date: day.date,
      processedCount: Number(day.processed_count),
      failedCount: Number(day.failed_count),
      totalEvents: Number(day.total_events)
    }))

    return timeline
  } catch (error) {
    console.error('Error getting timeline data:', error)
    return []
  }
}