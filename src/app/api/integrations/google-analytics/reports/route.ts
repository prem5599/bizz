// src/app/api/integrations/google-analytics/reports/route.ts
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
    const reportType = searchParams.get('type') || 'overview'
    const days = parseInt(searchParams.get('days') || '30')

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

    if (!integration.accessToken || !integration.refreshToken || !integration.platformAccountId) {
      return NextResponse.json(
        { error: 'Integration not configured' },
        { status: 400 }
      )
    }

    const ga = new GoogleAnalyticsIntegration(
      integration.accessToken,
      integration.refreshToken,
      integration.platformAccountId
    )

    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startDateStr = startDate.toISOString().split('T')[0]

    let reportData: any = {}

    switch (reportType) {
      case 'overview':
        const [websiteMetrics, trafficSources, deviceData] = await Promise.all([
          ga.getWebsiteMetrics(startDateStr, endDate),
          ga.getTrafficSources(startDateStr, endDate),
          ga.getDeviceData(startDateStr, endDate)
        ])
        
        reportData = {
          overview: websiteMetrics,
          trafficSources,
          deviceBreakdown: deviceData
        }
        break

      case 'traffic':
        const [sources, pages, realtime] = await Promise.all([
          ga.getTrafficSources(startDateStr, endDate),
          ga.getPagePerformance(startDateStr, endDate),
          ga.getActiveUsers().catch(() => ({ activeUsers: 0, topPages: [] }))
        ])
        
        reportData = {
          trafficSources: sources,
          topPages: pages,
          realtime
        }
        break

      case 'behavior':
        const [pagePerf, devices, conversions] = await Promise.all([
          ga.getPagePerformance(startDateStr, endDate),
          ga.getDeviceData(startDateStr, endDate),
          ga.getConversions(startDateStr, endDate).catch(() => [])
        ])
        
        reportData = {
          pagePerformance: pagePerf,
          deviceData: devices,
          conversions
        }
        break

      case 'realtime':
        reportData = await ga.getActiveUsers().catch(() => ({
          activeUsers: 0,
          activeUsersLast24h: 0,
          topPages: []
        }))
        break

      default:
        return NextResponse.json(
          { error: 'Invalid report type' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      reportType,
      data: reportData,
      period: {
        startDate: startDateStr,
        endDate,
        days
      },
      integration: {
        id: integration.id,
        propertyName: (integration.metadata as any)?.propertyName,
        propertyId: integration.platformAccountId
      }
    })

  } catch (error) {
    console.error('Google Analytics reports error:', error)
    return NextResponse.json(
      { error: 'Failed to generate report' },
      { status: 500 }
    )
  }
}