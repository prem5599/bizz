// app/api/organizations/[orgId]/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ReportGenerator } from '@/lib/reports/generator'
import { ReportEmailer } from '@/lib/reports/emailer'
import { TeamManager } from '@/lib/team/manager'

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

    // Check if user has permission to view reports
    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canViewReports'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Build where condition
    const where: any = { organizationId: orgId }
    if (type && ['daily', 'weekly', 'monthly'].includes(type)) {
      where.reportType = type
    }

    // Get reports
    const reports = await prisma.report.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        reportType: true,
        title: true,
        dateRangeStart: true,
        dateRangeEnd: true,
        generatedAt: true,
        emailedAt: true
      }
    })

    // Get report statistics
    const stats = await prisma.report.groupBy({
      by: ['reportType'],
      where: { organizationId: orgId },
      _count: { id: true }
    })

    const reportStats = stats.reduce((acc, stat) => {
      acc[stat.reportType] = stat._count.id
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      reports,
      stats: reportStats,
      pagination: {
        total: reports.length,
        limit
      }
    })

  } catch (error) {
    console.error('Get reports error:', error)
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

    // Check if user has permission to generate reports
    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canViewReports'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, reportType, startDate, endDate, emailReport } = await req.json()

    switch (action) {
      case 'generate':
        if (!reportType || !['weekly', 'monthly', 'custom'].includes(reportType)) {
          return NextResponse.json({ error: 'Invalid report type' }, { status: 400 })
        }

        let reportData
        
        if (reportType === 'custom') {
          if (!startDate || !endDate) {
            return NextResponse.json({ error: 'Start and end dates are required for custom reports' }, { status: 400 })
          }
          reportData = await ReportGenerator.generateCustomReport(
            orgId,
            new Date(startDate),
            new Date(endDate)
          )
        } else if (reportType === 'weekly') {
          reportData = await ReportGenerator.generateWeeklyReport(orgId)
        } else {
          reportData = await ReportGenerator.generateMonthlyReport(orgId)
        }

        // Send email if requested
        if (emailReport) {
          const user = await prisma.user.findUnique({
            where: { id: session.user.id }
          })

          if (user) {
            if (reportType === 'weekly') {
              await ReportEmailer.sendWeeklyReport(user.email, user.name || 'User', reportData)
            } else {
              await ReportEmailer.sendMonthlyReport(user.email, user.name || 'User', reportData)
            }
          }
        }

        return NextResponse.json({
          success: true,
          message: 'Report generated successfully',
          reportData
        })

      case 'email_to_team':
        const reportId = req.nextUrl.searchParams.get('reportId')
        if (!reportId) {
          return NextResponse.json({ error: 'Report ID is required' }, { status: 400 })
        }

        // Get report
        const report = await prisma.report.findFirst({
          where: { id: reportId, organizationId: orgId }
        })

        if (!report) {
          return NextResponse.json({ error: 'Report not found' }, { status: 404 })
        }

        // Send to team
        const emailResult = await ReportEmailer.sendReportToOrganization(
          orgId,
          report.content as any,
          report.reportType as 'weekly' | 'monthly'
        )

        // Update emailed timestamp
        await prisma.report.update({
          where: { id: reportId },
          data: { emailedAt: new Date() }
        })

        return NextResponse.json({
          success: true,
          message: `Report sent to ${emailResult.sent} team members`,
          sent: emailResult.sent,
          failed: emailResult.failed
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Report action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get individual report
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canViewReports'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { reportId } = await req.json()

    const report = await prisma.report.findFirst({
      where: { 
        id: reportId, 
        organizationId: orgId 
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({ report })

  } catch (error) {
    console.error('Get individual report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}