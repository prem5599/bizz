// src/app/api/dashboard/[organizationId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface DashboardMetric {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
}

interface DashboardMetrics {
  revenue: DashboardMetric
  orders: DashboardMetric
  customers: DashboardMetric
  conversionRate: DashboardMetric
  averageOrderValue: DashboardMetric
  sessions: DashboardMetric
}

interface DashboardIntegration {
  id: string
  platform: string
  platformAccountId: string
  status: 'active' | 'inactive' | 'error' | 'syncing'
  lastSyncAt: string | null
  dataPointsCount: number
}

interface DashboardInsight {
  id: string
  type: 'trend' | 'anomaly' | 'recommendation'
  title: string
  description: string
  impactScore: number
  isRead: boolean
  createdAt: string
  metadata: Record<string, unknown>
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ organizationId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId } = await params
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    // Verify user has access to this organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id
      },
      include: {
        organization: true
      }
    })

    if (!membership) {
      return NextResponse.json(
        { error: 'Organization not found or access denied' },
        { status: 404 }
      )
    }

    // Get integrations with data point counts
    const integrations = await prisma.integration.findMany({
      where: {
        organizationId
      },
      include: {
        _count: {
          select: {
            dataPoints: true
          }
        }
      }
    })

    const dashboardIntegrations: DashboardIntegration[] = integrations.map(integration => ({
      id: integration.id,
      platform: integration.platform,
      platformAccountId: integration.platformAccountId || '',
      status: integration.status as 'active' | 'inactive' | 'error' | 'syncing',
      lastSyncAt: integration.lastSyncAt?.toISOString() || null,
      dataPointsCount: integration._count.dataPoints
    }))

    // Check if we have any real data
    const hasRealData = integrations.some(integration => integration._count.dataPoints > 0)

    let metrics: DashboardMetrics
    let insights: DashboardInsight[]
    let chartData: Array<{ date: string; revenue: number; orders: number; sessions: number }>

    if (hasRealData) {
      // Calculate real metrics from data points
      metrics = await aggregateMetrics(organizationId, days)
      insights = await fetchInsights(organizationId)
      chartData = await fetchChartData(organizationId, days)
    } else {
      // Return empty metrics for no data case
      const emptyMetric = {
        current: 0,
        previous: 0,
        change: 0,
        changePercent: 0,
        trend: 'neutral' as const
      }

      metrics = {
        revenue: emptyMetric,
        orders: emptyMetric,
        customers: emptyMetric,
        conversionRate: emptyMetric,
        averageOrderValue: emptyMetric,
        sessions: emptyMetric
      }

      insights = []
      chartData = {
        revenue: [],
        traffic: [],
        products: []
      }
    }

    // Determine data status message
    let message = ''
    if (integrations.length === 0) {
      message = 'Connect your first integration to see real data'
    } else if (!hasRealData) {
      message = 'Integrations connected. Syncing data now...'
    } else {
      message = `Live data from ${integrations.length} connected integration${integrations.length !== 1 ? 's' : ''}`
    }

    const dashboardData = {
      metrics,
      integrations: dashboardIntegrations,
      insights,
      hasRealData,
      message,
      lastUpdated: new Date().toISOString(),
      chartData
    }

    return NextResponse.json(dashboardData)

  } catch (error) {
    console.error('Dashboard API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

async function aggregateMetrics(organizationId: string, days: number): Promise<DashboardMetrics> {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
  const previousStartDate = new Date(startDate.getTime() - days * 24 * 60 * 60 * 1000)

  // Current period data
  const currentData = await prisma.dataPoint.groupBy({
    by: ['metricType'],
    where: {
      integration: {
        organizationId
      },
      dateRecorded: {
        gte: startDate,
        lte: endDate
      }
    },
    _sum: {
      value: true
    },
    _count: {
      id: true
    }
  })

  // Previous period data for comparison
  const previousData = await prisma.dataPoint.groupBy({
    by: ['metricType'],
    where: {
      integration: {
        organizationId
      },
      dateRecorded: {
        gte: previousStartDate,
        lt: startDate
      }
    },
    _sum: {
      value: true
    },
    _count: {
      id: true
    }
  })

  // Helper function to calculate metric
  const calculateMetric = (metricType: string): DashboardMetric => {
    const current = Number(currentData.find(d => d.metricType === metricType)?._sum.value || 0)
    const previous = Number(previousData.find(d => d.metricType === metricType)?._sum.value || 0)
    const change = current - previous
    const changePercent = previous > 0 ? (change / previous) * 100 : 0
    
    return {
      current,
      previous,
      change,
      changePercent,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'neutral'
    }
  }

  // Calculate derived metrics
  const revenue = calculateMetric('revenue')
  const orders = calculateMetric('orders')
  const customers = calculateMetric('customers')
  const sessions = calculateMetric('sessions')

  // Calculate conversion rate
  const currentConversionRate = sessions.current > 0 ? (orders.current / sessions.current) * 100 : 0
  const previousConversionRate = sessions.previous > 0 ? (orders.previous / sessions.previous) * 100 : 0
  const conversionChange = currentConversionRate - previousConversionRate

  // Calculate average order value
  const currentAOV = orders.current > 0 ? revenue.current / orders.current : 0
  const previousAOV = orders.previous > 0 ? revenue.previous / orders.previous : 0
  const aovChange = currentAOV - previousAOV

  return {
    revenue,
    orders,
    customers,
    sessions,
    conversionRate: {
      current: currentConversionRate,
      previous: previousConversionRate,
      change: conversionChange,
      changePercent: previousConversionRate > 0 ? (conversionChange / previousConversionRate) * 100 : 0,
      trend: conversionChange > 0 ? 'up' : conversionChange < 0 ? 'down' : 'neutral'
    },
    averageOrderValue: {
      current: currentAOV,
      previous: previousAOV,
      change: aovChange,
      changePercent: previousAOV > 0 ? (aovChange / previousAOV) * 100 : 0,
      trend: aovChange > 0 ? 'up' : aovChange < 0 ? 'down' : 'neutral'
    }
  }
}

async function fetchInsights(organizationId: string): Promise<DashboardInsight[]> {
  const insightRecords = await prisma.insight.findMany({
    where: {
      organizationId
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: 10
  })

  return insightRecords.map(insight => ({
    id: insight.id,
    type: insight.type as 'trend' | 'anomaly' | 'recommendation',
    title: insight.title,
    description: insight.description,
    impactScore: insight.impactScore,
    isRead: insight.isRead,
    createdAt: insight.createdAt.toISOString(),
    metadata: insight.metadata as Record<string, unknown>
  }))
}

async function fetchChartData(organizationId: string, days: number) {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  // Get daily revenue and orders data
  const dailyData = await prisma.dataPoint.findMany({
    where: {
      integration: {
        organizationId
      },
      metricType: {
        in: ['revenue', 'orders', 'sessions']
      },
      dateRecorded: {
        gte: startDate,
        lte: endDate
      }
    },
    orderBy: {
      dateRecorded: 'asc'
    }
  })

  // Group by date for revenue chart
  const revenueByDate = new Map()
  dailyData.forEach(point => {
    const date = point.dateRecorded.toISOString().split('T')[0]
    if (!revenueByDate.has(date)) {
      revenueByDate.set(date, { date, revenue: 0, orders: 0, sessions: 0 })
    }
    const dayData = revenueByDate.get(date)
    if (point.metricType === 'revenue') {
      dayData.revenue += Number(point.value)
    } else if (point.metricType === 'orders') {
      dayData.orders += Number(point.value)
    } else if (point.metricType === 'sessions') {
      dayData.sessions += Number(point.value)
    }
  })

  // Traffic sources data
  const trafficData = await prisma.dataPoint.findMany({
    where: {
      integration: {
        organizationId
      },
      metricType: 'sessions',
      dateRecorded: {
        gte: startDate,
        lte: endDate
      }
    },
    select: {
      value: true,
      metadata: true
    }
  })

  // Group by traffic source
  const trafficBySource = new Map()
  let totalTraffic = 0
  trafficData.forEach(point => {
    const source = (point.metadata as { source?: string; [key: string]: unknown })?.source || 'Direct'
    const sessions = Number(point.value)
    totalTraffic += sessions
    
    if (!trafficBySource.has(source)) {
      trafficBySource.set(source, 0)
    }
    trafficBySource.set(source, trafficBySource.get(source) + sessions)
  })

  // Convert to array with percentages
  const trafficSources = Array.from(trafficBySource.entries()).map(([source, sessions]) => ({
    source,
    sessions,
    percentage: totalTraffic > 0 ? Math.round((sessions / totalTraffic) * 100) : 0
  }))

  return {
    revenue: Array.from(revenueByDate.values()),
    traffic: trafficSources,
    products: [] // TODO: Implement product data
  }
}