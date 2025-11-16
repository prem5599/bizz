// src/app/api/insights/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Simple in-memory cache for insights
const insightsCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Validation schema for creating insights
const createInsightSchema = z.object({
  organizationId: z.string().min(1),
  type: z.enum(['trend', 'anomaly', 'recommendation']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  impactScore: z.number().min(1).max(10),
  metadata: z.record(z.any()).optional().default({})
})

// Validation schema for querying insights
const queryInsightsSchema = z.object({
  organizationId: z.string().optional(),
  type: z.enum(['trend', 'anomaly', 'recommendation']).optional(),
  isRead: z.enum(['true', 'false']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('10'),
  offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0')
})

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const query = {
      organizationId: searchParams.get('organizationId'),
      type: searchParams.get('type'),
      isRead: searchParams.get('isRead'),
      limit: searchParams.get('limit') || '10',
      offset: searchParams.get('offset') || '0'
    }

    // Validate query parameters
    const validation = queryInsightsSchema.safeParse(query)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { organizationId, type, isRead, limit, offset } = validation.data

    // Generate cache key
    const cacheKey = `insights:${session.user.id}:${organizationId || 'all'}:${type || 'all'}:${isRead || 'all'}:${limit}:${offset}`
    
    // Check cache first
    const cached = insightsCache.get(cacheKey)
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data)
    }

    // Build where clause
    let whereClause: Record<string, unknown> = {}

    // If organizationId is provided, verify user has access
    if (organizationId) {
      const organizationMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id
        }
      })

      if (!organizationMember) {
        return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 })
      }

      whereClause.organizationId = organizationId
    } else {
      // Get all organizations user has access to
      const userOrganizations = await prisma.organizationMember.findMany({
        where: {
          userId: session.user.id
        },
        select: {
          organizationId: true
        }
      })

      whereClause.organizationId = {
        in: userOrganizations.map(org => org.organizationId)
      }
    }

    // Add optional filters
    if (type) {
      whereClause.type = type
    }

    if (isRead !== undefined) {
      whereClause.isRead = isRead === 'true'
    }

    // Fetch insights with pagination
    const [insights, totalCount, summaryStats] = await Promise.all([
      prisma.insight.findMany({
        where: whereClause,
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        },
        orderBy: [
          { isRead: 'asc' }, // Unread first
          { impactScore: 'desc' }, // High impact first
          { createdAt: 'desc' } // Most recent first
        ],
        take: limit,
        skip: offset
      }),
      prisma.insight.count({
        where: whereClause
      }),
      // Get summary statistics for all insights in the organization
      prisma.insight.groupBy({
        by: ['type', 'isRead'],
        where: whereClause,
        _count: {
          id: true
        }
      })
    ])

    // Transform insights for response
    const transformedInsights = insights.map(insight => {
      const createdAt = new Date(insight.createdAt)
      const now = new Date()
      const timeDiff = now.getTime() - createdAt.getTime()
      
      let relativeTime: string
      if (timeDiff < 60000) { // Less than 1 minute
        relativeTime = 'Just now'
      } else if (timeDiff < 3600000) { // Less than 1 hour
        relativeTime = `${Math.floor(timeDiff / 60000)}m ago`
      } else if (timeDiff < 86400000) { // Less than 1 day
        relativeTime = `${Math.floor(timeDiff / 3600000)}h ago`
      } else {
        relativeTime = `${Math.floor(timeDiff / 86400000)}d ago`
      }

      let impactLevel: string
      if (insight.impactScore >= 8) {
        impactLevel = 'high'
      } else if (insight.impactScore >= 5) {
        impactLevel = 'medium'
      } else {
        impactLevel = 'low'
      }

      let typeDisplayName: string
      switch (insight.type) {
        case 'trend':
          typeDisplayName = 'Trend Analysis'
          break
        case 'anomaly':
          typeDisplayName = 'Anomaly Detection'
          break
        case 'recommendation':
          typeDisplayName = 'Recommendation'
          break
        default:
          typeDisplayName = insight.type.charAt(0).toUpperCase() + insight.type.slice(1)
      }

      return {
        id: insight.id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        impactScore: insight.impactScore,
        isRead: insight.isRead,
        createdAt: insight.createdAt.toISOString(),
        relativeTime,
        impactLevel,
        typeDisplayName,
        metadata: insight.metadata,
        organization: insight.organization
      }
    })

    // Calculate summary statistics
    const typeBreakdown: Record<string, number> = {}
    let totalInsights = 0
    let unreadCount = 0
    let readCount = 0

    summaryStats.forEach(stat => {
      totalInsights += stat._count.id
      if (stat.isRead) {
        readCount += stat._count.id
      } else {
        unreadCount += stat._count.id
      }
      
      if (!typeBreakdown[stat.type]) {
        typeBreakdown[stat.type] = 0
      }
      typeBreakdown[stat.type] += stat._count.id
    })

    const currentPage = Math.floor(offset / limit) + 1
    const totalPages = Math.ceil(totalCount / limit)

    const responseData = {
      insights: transformedInsights,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        hasNextPage: offset + limit < totalCount,
        hasPreviousPage: offset > 0,
        limit
      },
      summary: {
        totalInsights,
        unreadCount,
        readCount,
        typeBreakdown
      }
    }

    // Cache the response
    insightsCache.set(cacheKey, { data: responseData, timestamp: Date.now() })

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('GET insights API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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
    const validation = createInsightSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { organizationId, type, title, description, impactScore, metadata } = validation.data

    // Verify user has admin or owner access to this organization
    const organizationMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: {
          in: ['owner', 'admin'] // Only admins and owners can create insights
        }
      }
    })

    if (!organizationMember) {
      return NextResponse.json({ error: 'Access denied - admin role required' }, { status: 403 })
    }

    // Create the insight
    const insight = await prisma.insight.create({
      data: {
        organizationId,
        type,
        title,
        description,
        impactScore,
        metadata,
        isRead: false
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

    // Invalidate cache for this organization
    const cacheKeysToInvalidate = Array.from(insightsCache.keys()).filter(key => 
      key.includes(`${session.user.id}`) && key.includes(organizationId)
    )
    cacheKeysToInvalidate.forEach(key => insightsCache.delete(key))

    return NextResponse.json({
      success: true,
      insight: {
        id: insight.id,
        type: insight.type,
        title: insight.title,
        description: insight.description,
        impactScore: insight.impactScore,
        isRead: insight.isRead,
        createdAt: insight.createdAt.toISOString(),
        metadata: insight.metadata,
        organization: insight.organization
      }
    }, { status: 201 })

  } catch (error) {
    console.error('POST insights API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// PATCH endpoint for bulk operations (mark multiple as read, etc.)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { action, insightIds, organizationId } = body

    if (!action || !Array.isArray(insightIds) || insightIds.length === 0) {
      return NextResponse.json({ error: 'Invalid request data' }, { status: 400 })
    }

    // Verify user has access to the organization
    if (organizationId) {
      const organizationMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: session.user.id
        }
      })

      if (!organizationMember) {
        return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 404 })
      }
    }

    let updateData: Record<string, unknown> = {}
    
    switch (action) {
      case 'mark_read':
        updateData.isRead = true
        break
      case 'mark_unread':
        updateData.isRead = false
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Build where clause for the insights
    let whereClause: Record<string, unknown> = {
      id: {
        in: insightIds
      }
    }

    if (organizationId) {
      whereClause.organizationId = organizationId
    } else {
      // Ensure user only updates insights from organizations they have access to
      const userOrganizations = await prisma.organizationMember.findMany({
        where: {
          userId: session.user.id
        },
        select: {
          organizationId: true
        }
      })

      whereClause.organizationId = {
        in: userOrganizations.map(org => org.organizationId)
      }
    }

    // Perform bulk update
    const result = await prisma.insight.updateMany({
      where: whereClause,
      data: updateData
    })

    // Invalidate cache for affected organizations
    if (organizationId) {
      const cacheKeysToInvalidate = Array.from(insightsCache.keys()).filter(key => 
        key.includes(`${session.user.id}`) && key.includes(organizationId)
      )
      cacheKeysToInvalidate.forEach(key => insightsCache.delete(key))
    } else {
      // Clear all cache entries for this user
      const cacheKeysToInvalidate = Array.from(insightsCache.keys()).filter(key => 
        key.includes(`${session.user.id}`)
      )
      cacheKeysToInvalidate.forEach(key => insightsCache.delete(key))
    }

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      action
    })

  } catch (error) {
    console.error('PATCH insights API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}