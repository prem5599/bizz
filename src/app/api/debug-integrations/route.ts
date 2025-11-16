// src/app/api/debug-integrations/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({
        error: 'No session found',
        hasSession: false
      })
    }

    // Get user's organizations
    const userMemberships = await prisma.organizationMember.findMany({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            integrations: true
          }
        }
      }
    })

    // Get all integrations
    const allIntegrations = await prisma.integration.findMany({
      select: {
        id: true,
        organizationId: true,
        platform: true,
        platformAccountId: true,
        status: true,
        createdAt: true,
        lastSyncAt: true
      }
    })

    // Get data points count for each integration
    const integrationStats = await Promise.all(
      allIntegrations.map(async (integration) => {
        const dataPointsCount = await prisma.dataPoint.count({
          where: { integrationId: integration.id }
        })
        return {
          ...integration,
          dataPointsCount
        }
      })
    )

    return NextResponse.json({
      session: {
        userId: session.user.id,
        userEmail: session.user.email
      },
      userOrganizations: userMemberships.map(membership => ({
        organizationId: membership.organizationId,
        organizationName: membership.organization.name,
        organizationSlug: membership.organization.slug,
        role: membership.role,
        integrations: membership.organization.integrations.map(integration => ({
          id: integration.id,
          platform: integration.platform,
          platformAccountId: integration.platformAccountId,
          status: integration.status,
          createdAt: integration.createdAt,
          lastSyncAt: integration.lastSyncAt
        }))
      })),
      allIntegrations: integrationStats,
      summary: {
        totalOrganizations: userMemberships.length,
        totalIntegrations: allIntegrations.length,
        shopifyIntegrations: allIntegrations.filter(i => i.platform === 'shopify').length,
        activeIntegrations: allIntegrations.filter(i => i.status === 'active').length
      }
    })

  } catch (error) {
    console.error('Debug integrations error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const integrationId = searchParams.get('id')

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID required' }, { status: 400 })
    }

    // Verify user owns this integration
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
      return NextResponse.json({ error: 'Integration not found or access denied' }, { status: 404 })
    }

    // Delete data points first (foreign key constraint)
    const deletedDataPoints = await prisma.dataPoint.deleteMany({
      where: { integrationId: integrationId }
    })

    // Delete the integration
    await prisma.integration.delete({
      where: { id: integrationId }
    })

    return NextResponse.json({
      success: true,
      message: 'Integration deleted successfully',
      deletedDataPoints: deletedDataPoints.count
    })

  } catch (error) {
    console.error('Delete integration error:', error)
    return NextResponse.json({
      error: 'Failed to delete integration',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}