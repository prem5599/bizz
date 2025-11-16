// app/api/schedule/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ReportGenerator } from '@/lib/reports/generator'
import { ReportEmailer } from '@/lib/reports/emailer'
import { InsightsScheduler } from '@/lib/insights/scheduler'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    // This endpoint would be called by a cron job or scheduled task
    // In production, protect this with API keys or internal auth
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY || 'dev-key'}`
    
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { type = 'weekly' } = await req.json()

    if (!['weekly', 'monthly'].includes(type)) {
      return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
    }

    console.log(`🔄 Starting scheduled ${type} report generation...`)

    // Get all organizations with active subscriptions
    const organizations = await prisma.organization.findMany({
      where: {
        // Add subscription filter if needed
        // subscriptionTier: { not: 'free' }
      },
      include: {
        members: {
          include: { user: true }
        },
        integrations: {
          where: { status: 'active' }
        }
      }
    })

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const org of organizations) {
      try {
        results.processed++

        // Skip organizations without integrations
        if (org.integrations.length === 0) {
          console.log(`⏭️  Skipping ${org.name} - no active integrations`)
          continue
        }

        // Generate insights first
        await InsightsScheduler.generateOrganizationInsights(org.id)

        // Generate report
        const reportData = type === 'weekly' 
          ? await ReportGenerator.generateWeeklyReport(org.id)
          : await ReportGenerator.generateMonthlyReport(org.id)

        // Send to organization members
        const emailResult = await ReportEmailer.sendReportToOrganization(
          org.id,
          reportData,
          type as 'weekly' | 'monthly'
        )

        console.log(`✅ ${org.name}: Generated and sent to ${emailResult.sent} members`)
        results.successful++

        // Update report as emailed
        const latestReport = await prisma.report.findFirst({
          where: { 
            organizationId: org.id, 
            reportType: type 
          },
          orderBy: { generatedAt: 'desc' }
        })

        if (latestReport) {
          await prisma.report.update({
            where: { id: latestReport.id },
            data: { emailedAt: new Date() }
          })
        }

      } catch (error) {
        console.error(`❌ Failed to process ${org.name}:`, error)
        results.failed++
        results.errors.push(`${org.name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    console.log(`📊 Scheduled ${type} reports completed:`, results)

    return NextResponse.json({
      success: true,
      message: `${type} reports generated and sent`,
      results
    })

  } catch (error) {
    console.error('Scheduled reports error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error' 
      },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const expectedAuth = `Bearer ${process.env.INTERNAL_API_KEY || 'dev-key'}`
    
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get scheduling status and statistics
    const totalOrgs = await prisma.organization.count()
    const activeIntegrations = await prisma.integration.count({
      where: { status: 'active' }
    })
    
    const recentReports = await prisma.report.count({
      where: {
        generatedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    const recentEmailedReports = await prisma.report.count({
      where: {
        emailedAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    return NextResponse.json({
      status: 'healthy',
      statistics: {
        totalOrganizations: totalOrgs,
        activeIntegrations,
        reportsGenerated: recentReports,
        reportsEmailed: recentEmailedReports,
        lastChecked: new Date().toISOString()
      }
    })

  } catch (error) {
    console.error('Schedule health check error:', error)
    return NextResponse.json(
      { 
        status: 'error',
        error: error instanceof Error ? error.message : 'Health check failed' 
      },
      { status: 500 }
    )
  }
}