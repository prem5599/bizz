// src/app/api/integrations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const createIntegrationSchema = z.object({
  platform: z.enum(['shopify', 'stripe', 'woocommerce', 'google_analytics', 'facebook_ads', 'mailchimp']),
  organizationId: z.string().cuid(),
  platformAccountId: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.string().datetime().optional(),
  metadata: z.record(z.any()).optional(),
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const orgId = searchParams.get('orgId')
    const platform = searchParams.get('platform')
    const status = searchParams.get('status')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    // Verify user has access to this organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id
      }
    })

    if (!member) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Build where clause for filtering
    const whereClause: any = {
      organizationId: orgId
    }

    if (platform) {
      whereClause.platform = platform
    }

    if (status) {
      whereClause.status = status
    }

    // Fetch integrations for the organization
    const integrations = await prisma.integration.findMany({
      where: whereClause,
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
        _count: {
          select: {
            dataPoints: true,
            webhookEvents: true
          }
        }
        // Don't expose sensitive tokens
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Add additional metadata for each integration
    const integrationsWithStatus = integrations.map(integration => ({
      ...integration,
      isConnected: integration.status === 'active',
      platformDisplayName: getPlatformDisplayName(integration.platform),
      statusText: getStatusText(integration.status, integration.lastSyncAt),
      canSync: integration.status === 'active',
      syncStatus: getSyncStatus(integration.lastSyncAt),
      hasRecentData: integration._count.dataPoints > 0,
      totalDataPoints: integration._count.dataPoints,
      totalWebhookEvents: integration._count.webhookEvents,
      lastSyncStatus: getLastSyncStatus(integration.lastSyncAt),
      configuration: {
        webhooksEnabled: !!(integration.metadata as any)?.webhooksEnabled,
        autoSync: !!(integration.metadata as any)?.autoSync,
        syncFrequency: (integration.metadata as any)?.syncFrequency || 'daily'
      }
    }))

    // Calculate summary statistics
    const summary = {
      totalIntegrations: integrations.length,
      connectedCount: integrations.filter(i => i.status === 'active').length,
      pausedCount: integrations.filter(i => i.status === 'paused').length,
      errorCount: integrations.filter(i => i.status === 'error').length,
      platformBreakdown: integrations.reduce((acc, integration) => {
        acc[integration.platform] = (acc[integration.platform] || 0) + 1
        return acc
      }, {} as Record<string, number>),
      lastSyncAt: integrations.reduce((latest, integration) => {
        if (!integration.lastSyncAt) return latest
        return !latest || integration.lastSyncAt > latest ? integration.lastSyncAt : latest
      }, null as Date | null)
    }

    return NextResponse.json({
      integrations: integrationsWithStatus,
      summary,
      pagination: {
        total: integrations.length,
        page: 1,
        pageSize: integrations.length,
        hasNext: false,
        hasPrev: false
      }
    })

  } catch (error) {
    console.error('GET integrations error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Validate request body
    const validation = createIntegrationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { 
      platform, 
      organizationId, 
      platformAccountId, 
      accessToken, 
      refreshToken, 
      tokenExpiresAt,
      metadata 
    } = validation.data

    // Verify user has admin access to this organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: {
          in: ['owner', 'admin'] // Only admins can create integrations
        }
      }
    })

    if (!member) {
      return NextResponse.json({ error: 'Access denied - admin role required' }, { status: 403 })
    }

    // Check if integration already exists for this platform
    const existingIntegration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId,
          platform
        }
      }
    })

    if (existingIntegration) {
      return NextResponse.json(
        { error: `${getPlatformDisplayName(platform)} integration already exists for this organization` },
        { status: 409 }
      )
    }

    // Create the integration
    const integration = await prisma.integration.create({
      data: {
        platform,
        organizationId,
        platformAccountId,
        accessToken,
        refreshToken,
        tokenExpiresAt: tokenExpiresAt ? new Date(tokenExpiresAt) : null,
        status: 'active',
        metadata: {
          autoSync: true,
          syncFrequency: 'daily',
          webhooksEnabled: false,
          ...metadata
        }
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    // Log the integration creation
    console.log(`Integration created: ${platform} for organization ${organizationId} by user ${session.user.id}`)

    // Start initial sync (async)
    if (integration.accessToken) {
      triggerInitialSync(integration.id, platform).catch(error => {
        console.error(`Failed to trigger initial sync for integration ${integration.id}:`, error)
      })
    }

    return NextResponse.json({
      integration: {
        ...integration,
        isConnected: true,
        platformDisplayName: getPlatformDisplayName(platform),
        statusText: 'Connected, preparing initial sync',
        canSync: true,
        syncStatus: 'never',
        // Don't expose sensitive tokens
        accessToken: undefined,
        refreshToken: undefined,
      }
    }, { status: 201 })

  } catch (error) {
    console.error('POST integration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions
function getPlatformDisplayName(platform: string): string {
  const displayNames: Record<string, string> = {
    shopify: 'Shopify',
    stripe: 'Stripe',
    woocommerce: 'WooCommerce',
    google_analytics: 'Google Analytics',
    facebook_ads: 'Facebook Ads',
    mailchimp: 'Mailchimp',
  }
  return displayNames[platform] || platform
}

function getStatusText(status: string, lastSyncAt: Date | null): string {
  switch (status) {
    case 'active':
      if (!lastSyncAt) return 'Connected, not synced yet'
      const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceSync < 1) return 'Recently synced'
      if (hoursSinceSync < 24) return `Synced ${Math.floor(hoursSinceSync)} hours ago`
      return `Synced ${Math.floor(hoursSinceSync / 24)} days ago`
    case 'paused':
      return 'Paused'
    case 'error':
      return 'Connection error'
    default:
      return 'Unknown status'
  }
}

function getSyncStatus(lastSyncAt: Date | null): 'never' | 'recent' | 'stale' | 'very_stale' {
  if (!lastSyncAt) return 'never'
  
  const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceSync < 1) return 'recent'
  if (hoursSinceSync < 24) return 'stale'
  return 'very_stale'
}

function getLastSyncStatus(lastSyncAt: Date | null): 'success' | 'warning' | 'error' | 'never' {
  if (!lastSyncAt) return 'never'
  
  const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceSync < 2) return 'success'
  if (hoursSinceSync < 48) return 'warning'
  return 'error'
}

async function triggerInitialSync(integrationId: string, platform: string): Promise<void> {
  // This would trigger the initial data sync
  // Implementation depends on your sync service
  console.log(`Triggering initial sync for ${platform} integration ${integrationId}`)
  
  // Example: Call your sync service
  // await syncService.startInitialSync(integrationId, platform)
}