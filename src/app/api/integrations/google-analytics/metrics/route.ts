// src/app/api/integrations/google-analytics/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleAnalyticsIntegration } from '@/lib/integrations/google-analytics'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const integrationId = searchParams.get('integrationId')
    const days = parseInt(searchParams.get('days') || '30')
    const live = searchParams.get('live') === 'true'

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        platform: 'google_analytics',
        organization: {
          members: {
            some: {
              userId: session.user.id
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // If live data requested, fetch from GA API
    if (live && integration.accessToken && integration.refreshToken && integration.platformAccountId) {
      try {
        const ga = new GoogleAnalyticsIntegration(
          integration.accessToken,
          integration.refreshToken,
          integration.platformAccountId
        )

        const endDate = new Date().toISOString().split('T')[0]
        const startDate = new Date()
        startDate.setDate(startDate.getDate() - days)
        const startDateStr = startDate.toISOString().split('T')[0]

        // Get live metrics
        const [websiteMetrics, trafficSources, activeUsers] = await Promise.all([
          ga.getWebsiteMetrics(startDateStr, endDate),
          ga.getTrafficSources(startDateStr, endDate),
          ga.getActiveUsers().catch(() => ({ activeUsers: 0, activeUsersLast24h: 0, topPages: [] }))
        ])

        return NextResponse.json({
          success: true,
          live: true,
          integration: {
            id: integration.id,
            platform: 'google_analytics',
            propertyId: integration.platformAccountId,
            propertyName: (integration.metadata as any)?.propertyName,
            status: integration.status,
            lastSyncAt: integration.lastSyncAt
          },
          metrics: websiteMetrics,
          trafficSources,
          activeUsers,
          period: {
            startDate: startDateStr,
            endDate,
            days
          }
        })
      } catch (error) {
        console.warn('Failed to fetch live GA data, falling back to cached:', error)
        // Fall through to cached data
      }
    }

    // Get cached metrics from database
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const dataPoints = await prisma.dataPoint.findMany({
      where: {
        integrationId,
        dateRecorded: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { dateRecorded: 'asc' }
    })

    // Aggregate metrics
    const metrics = {
      sessions: 0,
      users: 0,
      pageviews: 0,
      bounceRate: 0,
      avgSessionDuration: 0,
      newUsers: 0,
      byDate: new Map<string, any>()
    }

    let totalBounceRate = 0
    let totalSessionDuration = 0
    let daysWithData = 0

    dataPoints.forEach(point => {
      const date = point.dateRecorded.toISOString().split('T')[0]
      const value = Number(point.value)
      const metadata = point.metadata as any

      if (!metrics.byDate.has(date)) {
        metrics.byDate.set(date, {
          date,
          sessions: 0,
          users: 0,
          pageviews: 0,
          newUsers: 0,
          bounceRate: 0,
          avgSessionDuration: 0
        })
      }

      const dayMetrics = metrics.byDate.get(date)

      switch (point.metricType) {
        case 'sessions':
          metrics.sessions += value
          dayMetrics.sessions += value
          break
        case 'users':
          metrics.users += value
          dayMetrics.users += value
          if (metadata?.newUsers) {
            metrics.newUsers += metadata.newUsers
            dayMetrics.newUsers += metadata.newUsers
          }
          break
        case 'pageviews':
          metrics.pageviews += value
          dayMetrics.pageviews += value
          if (metadata?.avgSessionDuration) {
            totalSessionDuration += metadata.avgSessionDuration
            dayMetrics.avgSessionDuration = metadata.avgSessionDuration
          }
          if (metadata?.bounceRate) {
            totalBounceRate += metadata.bounceRate
            dayMetrics.bounceRate = metadata.bounceRate
            daysWithData++
          }
          break
      }
    })

    // Calculate averages
    metrics.bounceRate = daysWithData > 0 ? totalBounceRate / daysWithData : 0
    metrics.avgSessionDuration = daysWithData > 0 ? totalSessionDuration / daysWithData : 0

    // Convert map to array and sort by date
    const timeSeriesData = Array.from(metrics.byDate.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    return NextResponse.json({
      success: true,
      live: false,
      integration: {
        id: integration.id,
        platform: 'google_analytics',
        propertyId: integration.platformAccountId,
        propertyName: (integration.metadata as any)?.propertyName,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt
      },
      metrics: {
        sessions: metrics.sessions,
        users: metrics.users,
        pageviews: metrics.pageviews,
        bounceRate: metrics.bounceRate,
        avgSessionDuration: metrics.avgSessionDuration,
        newUsers: metrics.newUsers,
        conversionRate: metrics.sessions > 0 ? 0 : 0, // Would need e-commerce data
        pagesPerSession: metrics.sessions > 0 ? metrics.pageviews / metrics.sessions : 0
      },
      timeSeries: timeSeriesData,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days
      }
    })

  } catch (error) {
    console.error('Google Analytics metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}