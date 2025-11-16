// src/app/api/integrations/[integrationId]/metrics/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/[integrationId]/metrics
 * Get comprehensive metrics using existing database schema
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { integrationId } = await params
    console.log('📊 Fetching metrics for integration:', integrationId)

    // Get integration and verify ownership
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
        organization: true
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    console.log('✅ Integration found:', integration.platform, integration.platformAccountId)

    // Calculate time ranges for metrics
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const last30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    // Fetch all metrics in parallel using existing schema
    const [
      webhookStats,
      dataPointCounts,
      businessMetrics,
      performanceMetrics,
      trendData
    ] = await Promise.all([
      getWebhookStatistics(integrationId, last30d),
      getDataPointStatistics(integrationId),
      getBusinessMetrics(integrationId, last30d),
      getPerformanceMetrics(integrationId, last7d),
      getTrendData(integrationId, last30d)
    ])

    console.log('📈 Metrics calculated successfully')

    const metrics = {
      // Integration overview
      integration: {
        id: integration.id,
        platform: integration.platform,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
        createdAt: integration.createdAt
      },

      // Sync performance (using webhook events as proxy)
      sync: {
        totalWebhooks: webhookStats.totalEvents,
        successfulWebhooks: webhookStats.successfulEvents,
        failedWebhooks: webhookStats.failedEvents,
        successRate: webhookStats.successRate,
        lastSyncAt: integration.lastSyncAt,
        isHealthy: webhookStats.successRate > 80
      },

      // Data summary
      data: {
        totalDataPoints: dataPointCounts.total,
        byMetricType: dataPointCounts.byType,
        lastUpdated: dataPointCounts.lastUpdated,
        dataFreshness: dataPointCounts.freshness
      },

      // Business metrics (for Shopify/Stripe)
      business: businessMetrics,

      // Performance metrics
      performance: {
        dataPointsLast24h: dataPointCounts.last24h,
        dataPointsLast7d: dataPointCounts.last7d,
        averagePerDay: dataPointCounts.averagePerDay,
        growthRate: dataPointCounts.growthRate
      },

      // Recent activity (using webhook events)
      activity: {
        recentWebhooks: webhookStats.recentEvents,
        lastActivity: integration.lastSyncAt || integration.updatedAt
      },

      // Trends and history
      trends: trendData
    }

    return NextResponse.json(metrics)

  } catch (error) {
    console.error('❌ Error fetching integration metrics:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}

/**
 * Get webhook/event statistics using WebhookEvent model
 */
async function getWebhookStatistics(integrationId: string, since: Date) {
  try {
    const [totalEvents, eventsByStatus, recentEvents] = await Promise.all([
      prisma.webhookEvent.count({
        where: {
          integrationId,
          receivedAt: { gte: since }
        }
      }),
      prisma.webhookEvent.groupBy({
        by: ['status'],
        where: {
          integrationId,
          receivedAt: { gte: since }
        },
        _count: { id: true }
      }),
      prisma.webhookEvent.findMany({
        where: { integrationId },
        orderBy: { receivedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          topic: true,
          status: true,
          receivedAt: true,
          processedAt: true,
          error: true
        }
      })
    ])

    const statusCounts = eventsByStatus.reduce((acc, item) => {
      acc[item.status] = item._count.id
      return acc
    }, {} as Record<string, number>)

    const successfulEvents = statusCounts.processed || 0
    const failedEvents = statusCounts.failed || 0
    const successRate = totalEvents > 0 ? Math.round((successfulEvents / totalEvents) * 100) : 0

    return {
      totalEvents,
      successfulEvents,
      failedEvents,
      successRate,
      recentEvents: recentEvents.map(event => ({
        id: event.id,
        topic: event.topic,
        status: event.status,
        receivedAt: event.receivedAt,
        processedAt: event.processedAt,
        error: event.error
      }))
    }
  } catch (error) {
    console.error('Error getting webhook statistics:', error)
    return {
      totalEvents: 0,
      successfulEvents: 0,
      failedEvents: 0,
      successRate: 0,
      recentEvents: []
    }
  }
}

/**
 * Get data point counts and distribution
 */
async function getDataPointStatistics(integrationId: string) {
  try {
    const now = new Date()
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const [totalDataPoints, last24hCount, last7dCount, countsByType, mostRecent] = await Promise.all([
      prisma.dataPoint.count({
        where: { integrationId }
      }),
      prisma.dataPoint.count({
        where: { 
          integrationId,
          dateRecorded: { gte: last24h }
        }
      }),
      prisma.dataPoint.count({
        where: { 
          integrationId,
          dateRecorded: { gte: last7d }
        }
      }),
      prisma.dataPoint.groupBy({
        by: ['metricType'],
        where: { integrationId },
        _count: { id: true }
      }),
      prisma.dataPoint.findFirst({
        where: { integrationId },
        orderBy: { dateRecorded: 'desc' },
        select: { dateRecorded: true }
      })
    ])

    const byType = countsByType.reduce((acc, item) => {
      acc[item.metricType] = item._count.id
      return acc
    }, {} as Record<string, number>)

    const dataFreshness = mostRecent 
      ? Math.round((Date.now() - new Date(mostRecent.dateRecorded).getTime()) / (1000 * 60 * 60))
      : null

    const averagePerDay = last7dCount > 0 ? Math.round(last7dCount / 7) : 0
    const growthRate = last7dCount > 0 && totalDataPoints > last7dCount 
      ? Math.round(((last7dCount / (totalDataPoints - last7dCount)) - 1) * 100)
      : 0

    return {
      total: totalDataPoints,
      last24h: last24hCount,
      last7d: last7dCount,
      byType,
      lastUpdated: mostRecent?.dateRecorded || null,
      freshness: dataFreshness, // hours since last data point
      averagePerDay,
      growthRate
    }
  } catch (error) {
    console.error('Error getting data point counts:', error)
    return {
      total: 0,
      last24h: 0,
      last7d: 0,
      byType: {},
      lastUpdated: null,
      freshness: null,
      averagePerDay: 0,
      growthRate: 0
    }
  }
}

/**
 * Get business metrics (using DataPoint aggregations)
 */
async function getBusinessMetrics(integrationId: string, since: Date) {
  try {
    // Get revenue data
    const revenueData = await prisma.dataPoint.aggregate({
      where: {
        integrationId,
        metricType: 'revenue',
        dateRecorded: { gte: since }
      },
      _sum: { value: true },
      _count: { id: true }
    })

    // Get order count
    const orderCount = await prisma.dataPoint.count({
      where: {
        integrationId,
        metricType: 'orders',
        dateRecorded: { gte: since }
      }
    })

    // Get unique customers (approximate using customer metric type)
    const customerCount = await prisma.dataPoint.count({
      where: {
        integrationId,
        metricType: 'customers',
        dateRecorded: { gte: since }
      }
    })

    // Get product count (if available)
    const productCount = await prisma.dataPoint.count({
      where: {
        integrationId,
        metricType: 'products',
        dateRecorded: { gte: since }
      }
    })

    const totalRevenue = Number(revenueData._sum.value || 0)
    const avgOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0

    return {
      revenue: Math.round(totalRevenue),
      orders: orderCount,
      customers: customerCount,
      products: productCount,
      avgOrderValue: Math.round(avgOrderValue),
      period: {
        start: since.toISOString(),
        end: new Date().toISOString()
      }
    }
  } catch (error) {
    console.error('Error getting business metrics:', error)
    return {
      revenue: 0,
      orders: 0,
      customers: 0,
      products: 0,
      avgOrderValue: 0,
      period: {
        start: since.toISOString(),
        end: new Date().toISOString()
      }
    }
  }
}

/**
 * Get performance metrics using existing data
 */
async function getPerformanceMetrics(integrationId: string, since: Date) {
  try {
    const [dataPointMetrics, webhookMetrics] = await Promise.all([
      prisma.dataPoint.findMany({
        where: {
          integrationId,
          dateRecorded: { gte: since }
        },
        select: {
          createdAt: true,
          dateRecorded: true
        }
      }),
      prisma.webhookEvent.findMany({
        where: {
          integrationId,
          receivedAt: { gte: since }
        },
        select: {
          receivedAt: true,
          processedAt: true,
          status: true
        }
      })
    ])

    // Calculate processing times for webhooks
    const processingTimes = webhookMetrics
      .filter(event => event.processedAt && event.status === 'processed')
      .map(event => new Date(event.processedAt!).getTime() - new Date(event.receivedAt).getTime())

    const avgResponseTime = processingTimes.length > 0
      ? Math.round(processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length)
      : 0

    // Calculate throughput (data points per hour)
    const hoursElapsed = (Date.now() - since.getTime()) / (1000 * 60 * 60)
    const throughput = hoursElapsed > 0 ? Math.round(dataPointMetrics.length / hoursElapsed) : 0

    // Calculate error rate from webhooks
    const totalWebhooks = webhookMetrics.length
    const errorWebhooks = webhookMetrics.filter(event => event.status === 'failed').length
    const errorRate = totalWebhooks > 0 ? Math.round((errorWebhooks / totalWebhooks) * 100) : 0

    // Calculate uptime
    const uptime = totalWebhooks > 0 ? Math.round(((totalWebhooks - errorWebhooks) / totalWebhooks) * 100) : 100

    return {
      avgResponseTime,
      throughput,
      errorRate,
      uptime
    }
  } catch (error) {
    console.error('Error getting performance metrics:', error)
    return {
      avgResponseTime: 0,
      throughput: 0,
      errorRate: 0,
      uptime: 100
    }
  }
}

/**
 * Get trend data for charts using existing schema
 */
async function getTrendData(integrationId: string, since: Date) {
  try {
    // Get daily revenue trends
    const dailyRevenue = await prisma.$queryRaw<Array<{
      date: string
      total_revenue: number | null
      order_count: bigint
    }>>`
      SELECT 
        DATE(date_recorded) as date,
        SUM(CASE WHEN metric_type = 'revenue' THEN value END) as total_revenue,
        COUNT(CASE WHEN metric_type = 'orders' THEN 1 END) as order_count
      FROM "DataPoint"
      WHERE integration_id = ${integrationId}
        AND date_recorded >= ${since}
      GROUP BY DATE(date_recorded)
      ORDER BY date ASC
    `

    // Get daily webhook activity
    const dailyActivity = await prisma.$queryRaw<Array<{
      date: string
      event_count: bigint
      success_count: bigint
    }>>`
      SELECT 
        DATE(received_at) as date,
        COUNT(*) as event_count,
        COUNT(CASE WHEN status = 'processed' THEN 1 END) as success_count
      FROM "WebhookEvent"
      WHERE integration_id = ${integrationId}
        AND received_at >= ${since}
      GROUP BY DATE(received_at)
      ORDER BY date ASC
    `

    // Transform data for response
    const revenueTimeline = dailyRevenue.map(day => ({
      date: day.date,
      revenue: Number(day.total_revenue || 0),
      orders: Number(day.order_count)
    }))

    const activityTimeline = dailyActivity.map(day => ({
      date: day.date,
      events: Number(day.event_count),
      successful: Number(day.success_count)
    }))

    return {
      revenue: revenueTimeline,
      activity: activityTimeline,
      period: '30d'
    }
  } catch (error) {
    console.error('Error getting trend data:', error)
    return {
      revenue: [],
      activity: [],
      period: '30d'
    }
  }
}