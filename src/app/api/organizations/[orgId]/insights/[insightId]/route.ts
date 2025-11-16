// src/app/api/organizations/[orgId]/insights/[insightId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; insightId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId, insightId } = await params

    // Get insight with organization membership check
    const insight = await prisma.insight.findFirst({
      where: {
        id: insightId,
        organizationId: orgId,
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
        }
      }
    })

    if (!insight) {
      return NextResponse.json(
        { error: 'Insight not found or access denied' },
        { status: 404 }
      )
    }

    // Format response with additional data
    const formattedInsight = {
      ...insight,
      relativeTime: getRelativeTime(insight.createdAt),
      impactLevel: getImpactLevel(insight.impactScore),
      typeDisplayName: getTypeDisplayName(insight.type)
    }

    return NextResponse.json({ insight: formattedInsight })

  } catch (error) {
    console.error('Get insight error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; insightId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId, insightId } = await params
    const body = await req.json()
    const { isRead, title, description, impactScore, metadata } = body

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

    // Prepare update data
    const updateData: any = {}

    // Anyone can mark as read/unread
    if (typeof isRead === 'boolean') {
      updateData.isRead = isRead
    }

    // Only admins can update content
    if (['owner', 'admin'].includes(member.role)) {
      if (title) updateData.title = title
      if (description) updateData.description = description
      if (impactScore !== undefined) {
        if (impactScore < 1 || impactScore > 100) {
          return NextResponse.json(
            { error: 'Impact score must be between 1 and 100' },
            { status: 400 }
          )
        }
        updateData.impactScore = impactScore
      }
      if (metadata) updateData.metadata = metadata
    }

    // Update the insight
    const updatedInsight = await prisma.insight.update({
      where: {
        id: insightId,
        organizationId: orgId
      },
      data: updateData,
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

    // Format response
    const formattedInsight = {
      ...updatedInsight,
      relativeTime: getRelativeTime(updatedInsight.createdAt),
      impactLevel: getImpactLevel(updatedInsight.impactScore),
      typeDisplayName: getTypeDisplayName(updatedInsight.type)
    }

    return NextResponse.json({
      insight: formattedInsight,
      message: 'Insight updated successfully'
    })

  } catch (error) {
    console.error('Update insight error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; insightId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId, insightId } = await params

    // Verify user has admin access to delete insights
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Admin access required to delete insights' },
        { status: 403 }
      )
    }

    // Verify insight exists and belongs to organization
    const insight = await prisma.insight.findFirst({
      where: {
        id: insightId,
        organizationId: orgId
      }
    })

    if (!insight) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      )
    }

    // Delete the insight
    await prisma.insight.delete({
      where: {
        id: insightId
      }
    })

    return NextResponse.json({
      message: 'Insight deleted successfully'
    })

  } catch (error) {
    console.error('Delete insight error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions (shared with main insights route)
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
  
  if (diffInHours < 1) return 'Just now'
  if (diffInHours < 24) return `${diffInHours}h ago`
  
  const diffInDays = Math.floor(diffInHours / 24)
  if (diffInDays < 7) return `${diffInDays}d ago`
  
  const diffInWeeks = Math.floor(diffInDays / 7)
  if (diffInWeeks < 4) return `${diffInWeeks}w ago`
  
  return date.toLocaleDateString()
}

function getImpactLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical'
  if (score >= 60) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

function getTypeDisplayName(type: string): string {
  const displayNames: Record<string, string> = {
    trend: 'Trend Analysis',
    anomaly: 'Anomaly Detection',
    recommendation: 'Recommendation',
    alert: 'Alert',
    opportunity: 'Opportunity'
  }
  return displayNames[type] || type
}