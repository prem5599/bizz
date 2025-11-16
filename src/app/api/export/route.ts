// src/app/api/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { 
  ExportOptions,
  validateExportOptions,
  getContentType,
  generateFilename,
  convertToCSV,
  convertToJSON,
  exportDataPoints,
  exportMetricsSummary,
  exportInsights,
  exportIntegrations,
  formatExportData
} from '@/lib/export/exportUtils'

export const dynamic = 'force-dynamic'

interface DateRange {
  start: Date
  end: Date
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { exportType, options, organizationId } = body

    // Validate export options
    const validationError = validateExportOptions(options)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    // Verify user has access to organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id
      }
    })

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get date range
    const dateRange = options.dateRange || {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      end: new Date()
    }

    let exportData: string
    let filename: string
    const contentType = getContentType(options.format)

    switch (exportType) {
      case 'dashboard':
        exportData = await exportDashboardData(organizationId, options, dateRange)
        filename = generateFilename('dashboard', options.format)
        break

      case 'analytics':
        exportData = await exportAnalyticsData(organizationId, options, dateRange)
        filename = generateFilename('analytics', options.format)
        break

      case 'insights':
        exportData = await exportInsightsData(organizationId, options, dateRange)
        filename = generateFilename('insights', options.format)
        break

      case 'integrations':
        exportData = await exportIntegrationsData(organizationId, options)
        filename = generateFilename('integrations', options.format)
        break

      case 'reports':
        exportData = await exportReportsData(organizationId, options, dateRange)
        filename = generateFilename('reports', options.format)
        break

      case 'raw_data':
        exportData = await exportRawData(organizationId, options, dateRange)
        filename = generateFilename('raw_data', options.format)
        break

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 })
    }


    // Return file for download
    return new NextResponse(exportData, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache'
      }
    })

  } catch (error) {
    console.error('Export API error:', error)
    return NextResponse.json(
      { error: 'Export failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Export dashboard data
async function exportDashboardData(organizationId: string, options: ExportOptions, dateRange: DateRange): Promise<string> {
  // Get metrics
  const metrics = await aggregateMetrics(organizationId, dateRange)
  
  // Get chart data
  const chartData = await getChartData(organizationId, dateRange)
  
  // Get insights
  const insights = await prisma.insight.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
    take: 10
  })

  // Get integrations
  const integrations = await prisma.integration.findMany({
    where: { organizationId },
    include: {
      _count: { select: { dataPoints: true } }
    }
  })

  const dashboardData = {
    metrics,
    chartData,
    insights,
    integrations: integrations.map(i => ({
      ...i,
      dataPointsCount: i._count.dataPoints
    }))
  }

  if (options.format === 'json') {
    return convertToJSON(formatExportData(dashboardData, options))
  } else {
    return exportMetricsSummary(metrics, options)
  }
}

// Export analytics data
async function exportAnalyticsData(organizationId: string, options: ExportOptions, dateRange: DateRange): Promise<string> {
  const dataPoints = await prisma.dataPoint.findMany({
    where: {
      integration: { organizationId },
      dateRecorded: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    },
    include: {
      integration: {
        select: {
          platform: true,
          platformAccountId: true
        }
      }
    },
    orderBy: { dateRecorded: 'desc' }
  })

  if (options.format === 'json') {
    return convertToJSON({ raw: dataPoints })
  } else {
    return exportDataPoints(dataPoints, options)
  }
}

// Export insights data
async function exportInsightsData(organizationId: string, options: ExportOptions, dateRange: DateRange): Promise<string> {
  const insights = await prisma.insight.findMany({
    where: {
      organizationId,
      createdAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (options.format === 'json') {
    return convertToJSON({ insights })
  } else {
    return exportInsights(insights, options)
  }
}

// Export integrations data
async function exportIntegrationsData(organizationId: string, options: ExportOptions): Promise<string> {
  const integrations = await prisma.integration.findMany({
    where: { organizationId },
    include: {
      _count: { select: { dataPoints: true } }
    }
  })

  const integrationsWithCounts = integrations.map(i => ({
    ...i,
    dataPointsCount: i._count.dataPoints
  }))

  if (options.format === 'json') {
    return convertToJSON({ integrations: integrationsWithCounts })
  } else {
    return exportIntegrations(integrationsWithCounts, options)
  }
}

// Export reports data
async function exportReportsData(organizationId: string, options: ExportOptions, dateRange: DateRange): Promise<string> {
  const reports = await prisma.report.findMany({
    where: {
      organizationId,
      generatedAt: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    },
    orderBy: { generatedAt: 'desc' }
  })

  if (options.format === 'json') {
    return convertToJSON({ reports })
  } else {
    const reportData = reports.map(report => ({
      title: report.title,
      type: report.reportType,
      generated_at: report.generatedAt.toISOString(),
      date_range_start: report.dateRangeStart.toISOString(),
      date_range_end: report.dateRangeEnd.toISOString(),
      emailed_at: report.emailedAt?.toISOString() || 'Not emailed'
    }))

    return convertToCSV(reportData)
  }
}

// Export raw data
async function exportRawData(organizationId: string, options: ExportOptions, dateRange: DateRange): Promise<string> {
  const dataPoints = await prisma.dataPoint.findMany({
    where: {
      integration: { organizationId },
      dateRecorded: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    },
    include: {
      integration: {
        select: {
          platform: true,
          platformAccountId: true,
          status: true
        }
      }
    },
    orderBy: { dateRecorded: 'desc' },
    take: 10000 // Limit to prevent memory issues
  })

  if (options.format === 'json') {
    return convertToJSON({ dataPoints })
  } else {
    const csvData = dataPoints.map(point => ({
      date: point.dateRecorded.toISOString(),
      metric_type: point.metricType,
      value: point.value,
      platform: point.integration.platform,
      account_id: point.integration.platformAccountId || '',
      integration_status: point.integration.status,
      metadata: JSON.stringify(point.metadata || {})
    }))

    return convertToCSV(csvData)
  }
}

// Helper function to aggregate metrics
async function aggregateMetrics(organizationId: string, dateRange: DateRange) {
  const dataPoints = await prisma.dataPoint.groupBy({
    by: ['metricType'],
    where: {
      integration: { organizationId },
      dateRecorded: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    },
    _sum: { value: true },
    _count: { id: true }
  })

  const metrics: Record<string, { current: number; count: number }> = {}
  
  dataPoints.forEach(point => {
    metrics[point.metricType] = {
      current: Number(point._sum.value || 0),
      previous: 0, // Would need previous period calculation
      change: 0,
      changePercent: 0,
      trend: 'neutral'
    }
  })

  return metrics
}

// Helper function to get chart data
async function getChartData(organizationId: string, dateRange: DateRange) {
  const dataPoints = await prisma.dataPoint.findMany({
    where: {
      integration: { organizationId },
      metricType: { in: ['revenue', 'orders', 'sessions'] },
      dateRecorded: {
        gte: dateRange.start,
        lte: dateRange.end
      }
    },
    orderBy: { dateRecorded: 'asc' }
  })

  const chartData: { revenue: Array<{ date: string; value: number }> } = { revenue: [] }
  const dateMap = new Map()

  dataPoints.forEach(point => {
    const date = point.dateRecorded.toISOString().split('T')[0]
    if (!dateMap.has(date)) {
      dateMap.set(date, { date, revenue: 0, orders: 0, sessions: 0 })
    }
    const dayData = dateMap.get(date)
    dayData[point.metricType] += Number(point.value)
  })

  chartData.revenue = Array.from(dateMap.values())
  return chartData
}