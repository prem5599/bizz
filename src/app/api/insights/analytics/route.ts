// src/app/api/insights/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')
    const days = parseInt(searchParams.get('days') || '30')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get insight analytics
    const [
      totalInsights,
      insightsByType,
      insightsByDate,
      readVsUnread,
      impactDistribution
    ] = await Promise.all([
      // Total insights count
      prisma.insight.count({
        where: {
          organizationId,
          createdAt: { gte: startDate }
        }
      }),

      // Insights by type
      prisma.insight.groupBy({
        by: ['type'],
        where: {
          organizationId,
          createdAt: { gte: startDate }
        },
        _count: { id: true },
        _avg: { impactScore: true }
      }),

      // Insights by date
      prisma.$queryRaw`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM "Insight"
        WHERE organization_id = ${organizationId}
        AND created_at >= ${startDate}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `,

      // Read vs unread
      prisma.insight.groupBy({
        by: ['isRead'],
        where: {
          organizationId,
          createdAt: { gte: startDate }
        },
        _count: { id: true }
      }),

      // Impact score distribution
      prisma.$queryRaw`
        SELECT 
          CASE 
            WHEN impact_score >= 8 THEN 'high'
            WHEN impact_score >= 5 THEN 'medium'
            ELSE 'low'
          END as impact_level,
          COUNT(*) as count
        FROM "Insight"
        WHERE organization_id = ${organizationId}
        AND created_at >= ${startDate}
        GROUP BY impact_level
      `
    ])

    // Calculate engagement metrics
    const totalRead = readVsUnread.find(r => r.isRead)?._count.id || 0
    const totalUnread = readVsUnread.find(r => !r.isRead)?._count.id || 0
    const engagementRate = totalInsights > 0 ? (totalRead / totalInsights) * 100 : 0

    // Get top performing insights
    const topInsights = await prisma.insight.findMany({
      where: {
        organizationId,
        createdAt: { gte: startDate }
      },
      orderBy: [
        { impactScore: 'desc' },
        { createdAt: 'desc' }
      ],
      take: 5,
      select: {
        id: true,
        type: true,
        title: true,
        impactScore: true,
        isRead: true,
        createdAt: true
      }
    })

    return NextResponse.json({
      success: true,
      analytics: {
        overview: {
          totalInsights,
          totalRead,
          totalUnread,
          engagementRate: Math.round(engagementRate * 100) / 100
        },
        byType: insightsByType.map(item => ({
          type: item.type,
          count: item._count.id,
          avgImpact: Math.round((item._avg.impactScore || 0) * 100) / 100
        })),
        byDate: insightsByDate,
        readStatus: {
          read: totalRead,
          unread: totalUnread
        },
        impactDistribution,
        topInsights
      },
      period: {
        startDate: startDate.toISOString(),
        endDate: new Date().toISOString(),
        days
      }
    })

  } catch (error) {
    console.error('Insights analytics error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}