// src/app/api/integrations/shopify/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ShopifyIntegration } from '@/lib/integrations/shopify'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    // Check for internal API key for background jobs
    const authHeader = req.headers.get('authorization')
    const isInternalCall = authHeader === `Bearer ${process.env.INTERNAL_API_KEY}`
    
    let userId: string | undefined
    let organizationId: string

    if (isInternalCall) {
      // Internal call from background job or webhook
      const body = await req.json()
      organizationId = body.organizationId
      
      if (!organizationId) {
        return NextResponse.json(
          { error: 'Organization ID required for internal calls' },
          { status: 400 }
        )
      }
    } else {
      // User-initiated sync request
      const session = await getServerSession(authOptions)
      if (!session?.user?.id) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      
      userId = session.user.id
      const body = await req.json()
      organizationId = body.organizationId

      // Verify user has access to this organization
      const organization = await prisma.organization.findFirst({
        where: {
          id: organizationId,
          members: {
            some: {
              userId: session.user.id,
              role: {
                in: ['owner', 'admin', 'member'] // Members can trigger sync
              }
            }
          }
        }
      })

      if (!organization) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        )
      }
    }

    // Get all active Shopify integrations for this organization
    const integrations = await prisma.integration.findMany({
      where: {
        organizationId,
        platform: 'shopify',
        status: 'active'
      }
    })

    if (integrations.length === 0) {
      return NextResponse.json(
        { 
          error: 'No active Shopify integrations found',
          message: 'Please connect a Shopify store first'
        },
        { status: 404 }
      )
    }

    const syncResults = []

    // Process each integration
    for (const integration of integrations) {
      try {
        // Check if sync is already in progress
        if (integration.metadata && (integration.metadata as any).syncInProgress) {
          const syncStarted = new Date((integration.metadata as any).syncStartedAt)
          const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
          
          // If sync has been running for more than 30 minutes, consider it stale
          if (syncStarted > thirtyMinutesAgo) {
            syncResults.push({
              integrationId: integration.id,
              shopDomain: integration.platformAccountId,
              status: 'skipped',
              message: 'Sync already in progress'
            })
            continue
          }
        }

        // Mark sync as in progress
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            metadata: {
              ...(integration.metadata as any || {}),
              syncInProgress: true,
              syncStartedAt: new Date().toISOString(),
              lastSyncBy: userId || 'system'
            }
          }
        })

        // Perform the sync
        const result = await performShopifySync(integration)
        syncResults.push({
          integrationId: integration.id,
          shopDomain: integration.platformAccountId,
          accountName: integration.accountName,
          ...result
        })

        // Update integration with sync results
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            lastSyncAt: new Date(),
            status: result.success ? 'active' : 'error',
            metadata: {
              ...(integration.metadata as any || {}),
              syncInProgress: false,
              lastSyncResult: result,
              lastSuccessfulSync: result.success ? new Date().toISOString() : (integration.metadata as any)?.lastSuccessfulSync
            }
          }
        })

      } catch (error) {
        console.error(`Sync failed for integration ${integration.id}:`, error)
        
        // Mark sync as failed
        await prisma.integration.update({
          where: { id: integration.id },
          data: {
            status: 'error',
            metadata: {
              ...(integration.metadata as any || {}),
              syncInProgress: false,
              lastSyncError: {
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
              }
            }
          }
        })

        syncResults.push({
          integrationId: integration.id,
          shopDomain: integration.platformAccountId,
          accountName: integration.accountName,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Calculate overall success rate
    const successfulSyncs = syncResults.filter(r => r.success).length
    const totalSyncs = syncResults.length

    return NextResponse.json({
      success: successfulSyncs === totalSyncs,
      results: syncResults,
      summary: {
        total: totalSyncs,
        successful: successfulSyncs,
        failed: totalSyncs - successfulSyncs,
        timestamp: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Shopify sync error:', error)
    
    return NextResponse.json(
      {
        error: 'Sync failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}

/**
 * Get sync status for an organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      )
    }

    // Verify user has access
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: session.user.id
          }
        }
      },
      include: {
        integrations: {
          where: {
            platform: 'shopify'
          }
        }
      }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const syncStatuses = organization.integrations.map(integration => {
      const metadata = integration.metadata as any || {}
      
      return {
        integrationId: integration.id,
        shopDomain: integration.platformAccountId,
        accountName: integration.accountName,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
        syncInProgress: metadata.syncInProgress || false,
        syncStartedAt: metadata.syncStartedAt,
        lastSyncResult: metadata.lastSyncResult,
        lastSyncError: metadata.lastSyncError,
        connectedAt: integration.connectedAt
      }
    })

    return NextResponse.json({
      organizationId,
      integrations: syncStatuses,
      summary: {
        total: syncStatuses.length,
        active: syncStatuses.filter(s => s.status === 'active').length,
        syncing: syncStatuses.filter(s => s.syncInProgress).length,
        errors: syncStatuses.filter(s => s.status === 'error').length
      }
    })

  } catch (error) {
    console.error('Get sync status error:', error)
    
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
}

/**
 * Perform the actual Shopify data sync
 */
async function performShopifySync(integration: any) {
  const shopifyIntegration = new ShopifyIntegration(
    integration.accessToken,
    integration.platformAccountId
  )

  // Test connection first
  const isConnected = await shopifyIntegration.testConnection()
  if (!isConnected) {
    throw new Error('Failed to connect to Shopify store')
  }

  // Determine sync days back (30 days default, or full history if never synced)
  const daysBack = integration.lastSyncAt ? 30 : 365
  
  // Sync historical data (orders, customers, products)
  const syncResult = await shopifyIntegration.syncHistoricalData(integration.id, daysBack)

  // Get additional metrics
  const totalDataPoints = await prisma.dataPoint.count({
    where: { integrationId: integration.id }
  })

  const recentDataPoints = await prisma.dataPoint.count({
    where: {
      integrationId: integration.id,
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  })

  return {
    success: true,
    recordsProcessed: syncResult.orders + syncResult.customers + syncResult.products,
    errors: [],
    metrics: {
      totalDataPoints,
      recentDataPoints,
      syncDuration: Date.now() - integration.lastSyncAt?.getTime() || 0,
      orders: syncResult.orders,
      customers: syncResult.customers,
      products: syncResult.products
    },
    timestamp: new Date().toISOString()
  }
}

/**
 * Background sync job endpoint
 */
export async function PUT(req: NextRequest) {
  try {
    // Verify this is an internal call
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get all organizations with active Shopify integrations
    const organizations = await prisma.organization.findMany({
      where: {
        integrations: {
          some: {
            platform: 'shopify',
            status: 'active'
          }
        }
      },
      include: {
        integrations: {
          where: {
            platform: 'shopify',
            status: 'active'
          }
        }
      }
    })

    const results = []

    for (const org of organizations) {
      try {
        // Trigger sync for this organization
        const response = await fetch(`${process.env.APP_URL}/api/integrations/shopify/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
          },
          body: JSON.stringify({
            organizationId: org.id
          })
        })

        const syncResult = await response.json()
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          success: syncResult.success,
          results: syncResult.results
        })

      } catch (error) {
        console.error(`Background sync failed for org ${org.id}:`, error)
        results.push({
          organizationId: org.id,
          organizationName: org.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Background sync completed',
      results,
      processedOrganizations: organizations.length,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Background sync error:', error)
    
    return NextResponse.json(
      {
        error: 'Background sync failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}