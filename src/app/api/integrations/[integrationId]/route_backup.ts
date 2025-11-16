// src/app/api/integrations/[integrationId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const updateIntegrationSchema = z.object({
  status: z.enum(['active', 'paused', 'error']).optional(),
  settings: z.record(z.any()).optional(),
})

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

    // Find the integration and verify user has access
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
            dateRecorded: true,
            metadata: true
          }
        },
        _count: {
          select: {
            dataPoints: true,
            webhookEvents: true
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Add computed fields
    const integrationWithStatus = {
      ...integration,
      isConnected: integration.status === 'active',
      platformDisplayName: getPlatformDisplayName(integration.platform),
      statusText: getStatusText(integration.status, integration.lastSyncAt),
      canSync: integration.status === 'active',
      syncStatus: getSyncStatus(integration.lastSyncAt),
      hasRecentData: integration.dataPoints.length > 0,
      lastDataPoint: integration.dataPoints[0] || null,
      totalDataPoints: integration._count.dataPoints,
      totalWebhookEvents: integration._count.webhookEvents,
      // Don't expose sensitive tokens
      accessToken: undefined,
      refreshToken: undefined,
    }

    return NextResponse.json({ integration: integrationWithStatus })

  } catch (error) {
    console.error('GET integration error:', error)
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

    // Validate request body
    const validation = updateIntegrationSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { status, settings } = validation.data

    // Verify user has access to this integration
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: {
                in: ['owner', 'admin'] // Only admins can modify integrations
              }
            }
          }
        }
      }
    })

    if (!existingIntegration) {
      return NextResponse.json({ error: 'Integration not found or access denied' }, { status: 404 })
    }

    // Update the integration
    const updatedIntegration = await prisma.integration.update({
      where: {
        id: integrationId
      },
      data: {
        ...(status && { status }),
        ...(settings && { 
          metadata: {
            ...existingIntegration.metadata as any,
            settings: {
              ...(existingIntegration.metadata as any)?.settings || {},
              ...settings
            }
          }
        }),
        updatedAt: new Date()
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

    // Log the integration update
    console.log(`Integration ${integrationId} updated by user ${session.user.id}`, {
      status,
      settings,
      platform: updatedIntegration.platform
    })

    return NextResponse.json({
      integration: {
        ...updatedIntegration,
        // Don't expose sensitive tokens
        accessToken: undefined,
        refreshToken: undefined,
      }
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

    // Verify user has access to this integration
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: {
                in: ['owner', 'admin'] // Only admins can delete integrations
              }
            }
          }
        }
      }
    })

    if (!existingIntegration) {
      return NextResponse.json({ error: 'Integration not found or access denied' }, { status: 404 })
    }

    // Delete the integration (this will cascade delete data points and webhook events)
    await prisma.integration.delete({
      where: {
        id: integrationId
      }
    })

    // Log the integration deletion
    console.log(`Integration ${integrationId} deleted by user ${session.user.id}`, {
      platform: existingIntegration.platform,
      organizationId: existingIntegration.organizationId
    })

    return NextResponse.json({ 
      message: 'Integration deleted successfully',
      deletedIntegration: {
        id: integrationId,
        platform: existingIntegration.platform
      }
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