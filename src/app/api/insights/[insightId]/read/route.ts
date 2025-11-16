// src/app/api/insights/[insightId]/read/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{
    insightId: string
  }>
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { insightId } = await params

    // First, find the insight and verify user has access
    const insight = await prisma.insight.findUnique({
      where: {
        id: insightId
      },
      include: {
        organization: {
          include: {
            members: {
              where: {
                userId: session.user.id
              }
            }
          }
        }
      }
    })

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    // Check if user has access to this organization
    if (insight.organization.members.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Update the insight to mark as read
    const updatedInsight = await prisma.insight.update({
      where: {
        id: insightId
      },
      data: {
        isRead: true
      }
    })

    return NextResponse.json({
      success: true,
      insight: {
        id: updatedInsight.id,
        isRead: updatedInsight.isRead
      }
    })

  } catch (error) {
    console.error('Mark insight as read API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Optional: GET endpoint to retrieve specific insight details
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { insightId } = await params

    // Find the insight and verify user has access
    const insight = await prisma.insight.findUnique({
      where: {
        id: insightId
      },
      include: {
        organization: {
          include: {
            members: {
              where: {
                userId: session.user.id
              }
            }
          }
        }
      }
    })

    if (!insight) {
      return NextResponse.json({ error: 'Insight not found' }, { status: 404 })
    }

    // Check if user has access to this organization
    if (insight.organization.members.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({
      id: insight.id,
      type: insight.type,
      title: insight.title,
      description: insight.description,
      impactScore: insight.impactScore,
      isRead: insight.isRead,
      createdAt: insight.createdAt.toISOString(),
      metadata: insight.metadata,
      organization: {
        id: insight.organization.id,
        name: insight.organization.name
      }
    })

  } catch (error) {
    console.error('Get insight API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}