// src/app/api/integrations/stripe/metrics/route.ts
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
    const integrationId = searchParams.get('integrationId')
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
        platform: 'stripe',
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

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // Get metrics from data points
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
      totalRevenue: 0,
      totalCharges: 0,
      totalCustomers: 0,
      totalSubscriptions: 0,
      totalInvoices: 0,
      failedPayments: 0,
      chargebacks: 0,
      byDate: new Map<string, any>()
    }

    dataPoints.forEach(point => {
      const date = point.dateRecorded.toISOString().split('T')[0]
      const value = Number(point.value)

      if (!metrics.byDate.has(date)) {
        metrics.byDate.set(date, {
          date,
          revenue: 0,
          charges: 0,
          customers: 0,
          subscriptions: 0,
          invoices: 0,
          failedPayments: 0,
          chargebacks: 0
        })
      }

      const dayMetrics = metrics.byDate.get(date)

      switch (point.metricType) {
        case 'revenue':
          metrics.totalRevenue += value
          dayMetrics.revenue += value
          break
        case 'charge_succeeded':
          metrics.totalCharges += value
          dayMetrics.charges += value
          break
        case 'customer_created':
          metrics.totalCustomers += value
          dayMetrics.customers += value
          break
        case 'subscription_created':
          metrics.totalSubscriptions += value
          dayMetrics.subscriptions += value
          break
        case 'invoice_paid':
          metrics.totalInvoices += value
          dayMetrics.invoices += value
          break
        case 'payment_failed':
        case 'charge_failed':
        case 'invoice_payment_failed':
          metrics.failedPayments += value
          dayMetrics.failedPayments += value
          break
        case 'chargeback':
          metrics.chargebacks += value
          dayMetrics.chargebacks += value
          break
      }
    })

    // Convert map to array and sort by date
    const timeSeriesData = Array.from(metrics.byDate.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: 'stripe',
        accountId: integration.platformAccountId,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt
      },
      metrics: {
        totalRevenue: metrics.totalRevenue,
        totalCharges: metrics.totalCharges,
        totalCustomers: metrics.totalCustomers,
        totalSubscriptions: metrics.totalSubscriptions,
        totalInvoices: metrics.totalInvoices,
        failedPayments: metrics.failedPayments,
        chargebacks: metrics.chargebacks,
        averageOrderValue: metrics.totalCharges > 0 ? metrics.totalRevenue / metrics.totalCharges : 0,
        successRate: (metrics.totalCharges + metrics.failedPayments) > 0 
          ? (metrics.totalCharges / (metrics.totalCharges + metrics.failedPayments)) * 100 
          : 0
      },
      timeSeries: timeSeriesData,
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        days
      }
    })

  } catch (error) {
    console.error('Stripe metrics error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    )
  }
}
