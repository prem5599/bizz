// src/app/api/debug-user/route.ts
import { NextResponse } from 'next/server'
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

    // Get user with organizations
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        organizations: {
          include: {
            organization: {
              include: {
                integrations: {
                  include: {
                    _count: {
                      select: {
                        dataPoints: true
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({
        error: 'User not found in database',
        sessionUserId: session.user.id
      })
    }

    // Check if user has any organizations
    const organizations = user.organizations.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
      integrations: membership.organization.integrations.map(integration => ({
        id: integration.id,
        platform: integration.platform,
        status: integration.status,
        dataPointsCount: integration._count.dataPoints
      }))
    }))

    return NextResponse.json({
      session: {
        userId: session.user.id,
        userEmail: session.user.email,
        userName: session.user.name
      },
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt
      },
      organizations,
      summary: {
        hasOrganizations: organizations.length > 0,
        totalIntegrations: organizations.reduce((sum, org) => sum + org.integrations.length, 0),
        totalDataPoints: organizations.reduce((sum, org) => 
          sum + org.integrations.reduce((intSum, int) => intSum + int.dataPointsCount, 0), 0
        )
      }
    })

  } catch (error) {
    console.error('Debug user error:', error)
    return NextResponse.json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}