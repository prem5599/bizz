// src/app/api/integrations/[integrationId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { integrationId } = await params

    // Get integration with organization membership check
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
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        },
        dataPoints: {
          take: 10,
          orderBy: {
            dateRecorded: 'desc'
          },
          select: {
            id: true,
            metricType: true,
            value: true,
            dateRecorded: true
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or access denied' },
        { status: 404 }
      )
    }

    // Calculate sync statistics
    const syncStats = await calculateSyncStats(integrationId)

    // Prepare response without sensitive data
    const response = {
      id: integration.id,
      platform: integration.platform,
      platformAccountId: integration.platformAccountId,
      status: integration.status,
      lastSyncAt: integration.lastSyncAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
      organization: integration.organization,
      platformDisplayName: getPlatformDisplayName(integration.platform),
      statusText: getStatusText(integration.status, integration.lastSyncAt),
      canSync: integration.status === 'active',
      syncStatus: getSyncStatus(integration.lastSyncAt),
      syncStats,
      recentDataPoints: integration.dataPoints,
      hasValidToken: !!integration.accessToken && (!integration.tokenExpiresAt || integration.tokenExpiresAt > new Date())
    }

    return NextResponse.json({ integration: response })

  } catch (error) {
    console.error('GET integration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { integrationId } = await params
    const body = await req.json()
    const { accessToken, refreshToken, platformAccountId, status, triggerSync } = body

    // Verify user has admin access
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['owner', 'admin'] }
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or admin access required' },
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {}

    // Validate and update tokens if provided
    if (accessToken) {
      const validationResult = await validateIntegrationToken(
        integration.platform, 
        accessToken, 
        platformAccountId || integration.platformAccountId
      )

      if (!validationResult.isValid) {
        return NextResponse.json(
          { error: validationResult.error || 'Invalid access token' },
          { status: 400 }
        )
      }

      updateData.accessToken = accessToken
      updateData.tokenExpiresAt = validationResult.expiresAt
      if (refreshToken) updateData.refreshToken = refreshToken
      if (platformAccountId) updateData.platformAccountId = platformAccountId
    }

    // Update status if provided
    if (status && ['active', 'inactive', 'error'].includes(status)) {
      updateData.status = status
    }

    // Update the integration
    const updatedIntegration = await prisma.integration.update({
      where: { id: integrationId },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        status: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true
      }
    })

    // Trigger sync if requested
    if (triggerSync && updatedIntegration.status === 'active') {
      await triggerDataSync(integrationId, integration.platform)
    }

    return NextResponse.json({
      integration: {
        ...updatedIntegration,
        platformDisplayName: getPlatformDisplayName(integration.platform),
        statusText: getStatusText(updatedIntegration.status, updatedIntegration.lastSyncAt),
        canSync: updatedIntegration.status === 'active',
        syncStatus: getSyncStatus(updatedIntegration.lastSyncAt)
      },
      message: 'Integration updated successfully'
    })

  } catch (error) {
    console.error('PUT integration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { integrationId } = await params
    const body = await req.json()
    const { action } = body

    // Verify user has admin access
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['owner', 'admin'] }
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or admin access required' },
        { status: 404 }
      )
    }

    let updateData: any = {}
    let message = ''

    switch (action) {
      case 'sync':
        if (integration.status !== 'active') {
          return NextResponse.json(
            { error: 'Cannot sync inactive integration' },
            { status: 400 }
          )
        }
        await triggerDataSync(integrationId, integration.platform)
        message = 'Sync triggered successfully'
        break

      case 'toggle':
        updateData.status = integration.status === 'active' ? 'inactive' : 'active'
        message = `Integration ${updateData.status === 'active' ? 'activated' : 'deactivated'}`
        break

      case 'refresh_token':
        // Attempt to refresh token using refresh token
        if (!integration.refreshToken) {
          return NextResponse.json(
            { error: 'No refresh token available' },
            { status: 400 }
          )
        }
        
        const refreshResult = await refreshAccessToken(integration.platform, integration.refreshToken)
        if (!refreshResult.success) {
          return NextResponse.json(
            { error: refreshResult.error || 'Failed to refresh token' },
            { status: 400 }
          )
        }

        updateData.accessToken = refreshResult.accessToken
        updateData.tokenExpiresAt = refreshResult.expiresAt
        if (refreshResult.refreshToken) {
          updateData.refreshToken = refreshResult.refreshToken
        }
        message = 'Token refreshed successfully'
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: sync, toggle, refresh_token' },
          { status: 400 }
        )
    }

    // Update integration if there's data to update
    let updatedIntegration = integration
    if (Object.keys(updateData).length > 0) {
      updatedIntegration = await prisma.integration.update({
        where: { id: integrationId },
        data: {
          ...updateData,
          updatedAt: new Date()
        }
      })
    }

    return NextResponse.json({
      integration: {
        id: updatedIntegration.id,
        platform: updatedIntegration.platform,
        platformAccountId: updatedIntegration.platformAccountId,
        status: updatedIntegration.status,
        lastSyncAt: updatedIntegration.lastSyncAt,
        createdAt: updatedIntegration.createdAt,
        updatedAt: updatedIntegration.updatedAt,
        platformDisplayName: getPlatformDisplayName(updatedIntegration.platform),
        statusText: getStatusText(updatedIntegration.status, updatedIntegration.lastSyncAt),
        canSync: updatedIntegration.status === 'active',
        syncStatus: getSyncStatus(updatedIntegration.lastSyncAt)
      },
      message
    })

  } catch (error) {
    console.error('PATCH integration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { integrationId } = await params

    // Verify user has admin access
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['owner', 'admin'] }
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or admin access required' },
        { status: 404 }
      )
    }

    // Delete integration and all associated data
    await prisma.integration.delete({
      where: { id: integrationId }
    })

    // Note: DataPoints will be automatically deleted due to CASCADE delete

    return NextResponse.json({
      message: `${getPlatformDisplayName(integration.platform)} integration deleted successfully`
    })

  } catch (error) {
    console.error('DELETE integration error:', error)
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
    google_analytics: 'Google Analytics',
    facebook_ads: 'Facebook Ads',
    mailchimp: 'Mailchimp'
  }
  return displayNames[platform] || platform
}

function getStatusText(status: string, lastSyncAt: Date | null): string {
  if (status !== 'active') return 'Disconnected'
  
  if (!lastSyncAt) return 'Connected - No sync yet'
  
  const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceSync < 1) return 'Connected - Synced recently'
  if (hoursSinceSync < 24) return `Connected - Synced ${Math.floor(hoursSinceSync)}h ago`
  
  const daysSinceSync = Math.floor(hoursSinceSync / 24)
  return `Connected - Synced ${daysSinceSync}d ago`
}

function getSyncStatus(lastSyncAt: Date | null): 'pending' | 'syncing' | 'synced' | 'error' {
  if (!lastSyncAt) return 'pending'
  
  const hoursSinceSync = (Date.now() - lastSyncAt.getTime()) / (1000 * 60 * 60)
  if (hoursSinceSync > 25) return 'error'
  
  return 'synced'
}

async function calculateSyncStats(integrationId: string) {
  const [totalDataPoints, lastWeekDataPoints, syncHistory] = await Promise.all([
    prisma.dataPoint.count({
      where: { integrationId }
    }),
    prisma.dataPoint.count({
      where: {
        integrationId,
        dateRecorded: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.dataPoint.groupBy({
      by: ['metricType'],
      where: { integrationId },
      _count: { id: true },
      _max: { dateRecorded: true }
    })
  ])

  return {
    totalDataPoints,
    lastWeekDataPoints,
    metricTypes: syncHistory.map(metric => ({
      type: metric.metricType,
      count: metric._count.id,
      lastRecorded: metric._max.dateRecorded
    }))
  }
}

async function validateIntegrationToken(
  platform: string, 
  accessToken: string, 
  platformAccountId?: string
): Promise<{ isValid: boolean; error?: string; accountId?: string; expiresAt?: Date }> {
  // This should use the same validation logic as in the main integrations route
  // For brevity, returning a simplified version here
  return { isValid: true, accountId: platformAccountId }
}

async function triggerDataSync(integrationId: string, platform: string): Promise<void> {
  // Update last sync attempt timestamp
  await prisma.integration.update({
    where: { id: integrationId },
    data: { lastSyncAt: new Date() }
  })

  // In a real implementation, trigger background job
  console.log(`Data sync triggered for integration ${integrationId} (${platform})`)
}

async function refreshAccessToken(
  platform: string, 
  refreshToken: string
): Promise<{ success: boolean; error?: string; accessToken?: string; refreshToken?: string; expiresAt?: Date }> {
  try {
    switch (platform) {
      case 'google_analytics':
        return await refreshGoogleToken(refreshToken)
      case 'facebook_ads':
        return await refreshFacebookToken(refreshToken)
      default:
        return { success: false, error: 'Token refresh not supported for this platform' }
    }
  } catch (error) {
    console.error(`Token refresh error for ${platform}:`, error)
    return { success: false, error: 'Token refresh failed' }
  }
}

async function refreshGoogleToken(refreshToken: string): Promise<any> {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) {
      return { success: false, error: 'Failed to refresh Google token' }
    }

    const data = await response.json()
    return {
      success: true,
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken, // Google may not return new refresh token
      expiresAt: new Date(Date.now() + data.expires_in * 1000)
    }
  } catch (error) {
    return { success: false, error: 'Google token refresh failed' }
  }
}

async function refreshFacebookToken(refreshToken: string): Promise<any> {
  // Facebook token refresh implementation would go here
  return { success: false, error: 'Facebook token refresh not implemented' }
}