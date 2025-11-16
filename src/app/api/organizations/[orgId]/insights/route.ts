// src/app/api/organizations/[orgId]/insights/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20')
    const page = parseInt(searchParams.get('page') || '1')
    const type = searchParams.get('type')
    const unreadOnly = searchParams.get('unreadOnly') === 'true'

    // Verify user has access to this organization
    const organizationMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id
      },
      include: {
        organization: true
      }
    })

    if (!organizationMember) {
      return NextResponse.json(
        { error: 'Organization not found or access denied' },
        { status: 403 }
      )
    }

    // Build where clause
    const whereClause: any = {
      organizationId: orgId
    }

    if (type) {
      whereClause.type = type
    }

    if (unreadOnly) {
      whereClause.isRead = false
    }

    // Get insights with pagination
    const [insights, totalCount] = await Promise.all([
      prisma.insight.findMany({
        where: whereClause,
        orderBy: [
          { isRead: 'asc' }, // Unread first
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: (page - 1) * limit,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          impactScore: true,
          isRead: true,
          metadata: true,
          createdAt: true
        }
      }),
      prisma.insight.count({
        where: whereClause
      })
    ])

    // Get summary statistics
    const [totalInsights, unreadCount, typeBreakdown] = await Promise.all([
      prisma.insight.count({
        where: { organizationId: orgId }
      }),
      prisma.insight.count({
        where: { 
          organizationId: orgId,
          isRead: false 
        }
      }),
      prisma.insight.groupBy({
        by: ['type'],
        where: { organizationId: orgId },
        _count: {
          id: true
        }
      })
    ])

    // Format insights with relative time and additional data
    const formattedInsights = insights.map(insight => ({
      ...insight,
      relativeTime: getRelativeTime(insight.createdAt),
      impactLevel: getImpactLevel(insight.impactScore),
      typeDisplayName: getTypeDisplayName(insight.type)
    }))

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPreviousPage = page > 1

    return NextResponse.json({
      insights: formattedInsights,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        hasNextPage,
        hasPreviousPage,
        limit
      },
      summary: {
        totalInsights,
        unreadCount,
        readCount: totalInsights - unreadCount,
        typeBreakdown: typeBreakdown.reduce((acc, item) => {
          acc[item.type] = item._count.id
          return acc
        }, {} as Record<string, number>)
      }
    })

  } catch (error) {
    console.error('Get insights error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params
    const body = await req.json()
    const { type, title, description, impactScore, metadata } = body

    // Validation
    if (!type || !title || !description) {
      return NextResponse.json(
        { error: 'Missing required fields: type, title, description' },
        { status: 400 }
      )
    }

    if (impactScore && (impactScore < 1 || impactScore > 100)) {
      return NextResponse.json(
        { error: 'Impact score must be between 1 and 100' },
        { status: 400 }
      )
    }

    // Verify user has admin access to this organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!member) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Validate insight type
    const validTypes = ['trend', 'anomaly', 'recommendation', 'alert', 'opportunity']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid insight type. Valid types: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // Create insight
    const insight = await prisma.insight.create({
      data: {
        organizationId: orgId,
        type,
        title,
        description,
        impactScore: impactScore || 50,
        metadata: metadata || {},
        isRead: false
      },
      select: {
        id: true,
        type: true,
        title: true,
        description: true,
        impactScore: true,
        isRead: true,
        metadata: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      insight: {
        ...insight,
        relativeTime: getRelativeTime(insight.createdAt),
        impactLevel: getImpactLevel(insight.impactScore),
        typeDisplayName: getTypeDisplayName(insight.type)
      },
      message: 'Insight created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Create insight error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params
    const body = await req.json()
    const { action, insightIds } = body

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

    let message = ''
    let updatedCount = 0

    switch (action) {
      case 'markAllAsRead':
        const readResult = await prisma.insight.updateMany({
          where: {
            organizationId: orgId,
            isRead: false
          },
          data: {
            isRead: true
          }
        })
        updatedCount = readResult.count
        message = `Marked ${updatedCount} insights as read`
        break

      case 'markAsRead':
        if (!insightIds || !Array.isArray(insightIds)) {
          return NextResponse.json(
            { error: 'insightIds array is required for markAsRead action' },
            { status: 400 }
          )
        }
        const markReadResult = await prisma.insight.updateMany({
          where: {
            id: { in: insightIds },
            organizationId: orgId
          },
          data: {
            isRead: true
          }
        })
        updatedCount = markReadResult.count
        message = `Marked ${updatedCount} insights as read`
        break

      case 'markAsUnread':
        if (!insightIds || !Array.isArray(insightIds)) {
          return NextResponse.json(
            { error: 'insightIds array is required for markAsUnread action' },
            { status: 400 }
          )
        }
        const markUnreadResult = await prisma.insight.updateMany({
          where: {
            id: { in: insightIds },
            organizationId: orgId
          },
          data: {
            isRead: false
          }
        })
        updatedCount = markUnreadResult.count
        message = `Marked ${updatedCount} insights as unread`
        break

      case 'deleteRead':
        // Only allow admins to delete insights
        if (!['owner', 'admin'].includes(member.role)) {
          return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
        }
        const deleteResult = await prisma.insight.deleteMany({
          where: {
            organizationId: orgId,
            isRead: true
          }
        })
        updatedCount = deleteResult.count
        message = `Deleted ${updatedCount} read insights`
        break

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: markAllAsRead, markAsRead, markAsUnread, deleteRead' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message,
      updatedCount
    })

  } catch (error) {
    console.error('Bulk insights action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper functions
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