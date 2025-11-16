// src/app/api/reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateHTMLReport, generatePDFReport } from '@/lib/reports/pdf'
import { sendReportEmail } from '@/lib/reports/email'

export const dynamic = 'force-dynamic'

/**
 * Generate and optionally send reports
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      organizationId,
      reportType = 'monthly',
      format = 'pdf',
      timeframe,
      emailOptions,
      scheduleOptions
    } = body

    // Verify user has access to organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
      },
      include: {
        organization: true
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      )
    }

    // Set up timeframe based on reportType if not provided
    let reportTimeframe = timeframe
    if (!reportTimeframe) {
      const endDate = new Date()
      const startDate = new Date()
      
      switch (reportType) {
        case 'weekly':
          startDate.setDate(endDate.getDate() - 7)
          break
        case 'monthly':
          startDate.setMonth(endDate.getMonth() - 1)
          break
        case 'quarterly':
          startDate.setMonth(endDate.getMonth() - 3)
          break
        default:
          startDate.setMonth(endDate.getMonth() - 1)
      }
      
      reportTimeframe = {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    }

    const timeframeDates = {
      start: new Date(reportTimeframe.start),
      end: new Date(reportTimeframe.end)
    }

    // Generate report based on format
    let reportBuffer: Buffer
    let reportName: string
    let contentType: string

    if (format === 'html') {
      const htmlContent = await generateHTMLReport(organizationId, timeframeDates, {
        format: 'standard',
        includeInsights: true,
        includeTrends: true,
        includeComparisons: true
      })
      reportBuffer = Buffer.from(htmlContent, 'utf8')
      reportName = `${member.organization.name}-${reportType}-report-${new Date().toISOString().split('T')[0]}.html`
      contentType = 'text/html'
    } else {
      // Generate PDF (currently returns HTML buffer as we don't have Puppeteer)
      reportBuffer = await generatePDFReport(organizationId, timeframeDates, {
        format: 'standard',
        includeInsights: true,
        includeTrends: true,
        includeComparisons: true
      })
      reportName = `${member.organization.name}-${reportType}-report-${new Date().toISOString().split('T')[0]}.pdf`
      contentType = 'application/pdf'
    }

    // If email options are provided, send the report via email
    if (emailOptions) {
      const emailResult = await sendReportEmail({
        organizationId,
        recipientEmail: emailOptions.recipientEmail,
        recipientName: emailOptions.recipientName,
        reportTitle: `${capitalizeFirst(reportType)} Analytics Report`,
        reportType: reportType as any,
        attachmentBuffer: reportBuffer,
        attachmentName: reportName,
        attachmentType: format as any,
        customMessage: emailOptions.customMessage,
        includeMetrics: true
      })

      if (!emailResult.success) {
        return NextResponse.json(
          { error: 'Report generated but email delivery failed', details: emailResult.error },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'Report generated and sent via email',
        reportName,
        emailSent: true,
        messageId: emailResult.messageId
      })
    }

    // If schedule options are provided, create scheduled report
    if (scheduleOptions) {
      const scheduledReport = await prisma.scheduledReport.create({
        data: {
          organizationId,
          name: scheduleOptions.name || `${capitalizeFirst(reportType)} Report`,
          description: scheduleOptions.description,
          reportType,
          format,
          schedule: scheduleOptions.schedule, // cron expression
          recipients: JSON.stringify(scheduleOptions.recipients || []),
          isActive: scheduleOptions.isActive !== false,
          reportOptions: JSON.stringify({
            includeInsights: true,
            includeTrends: true,
            includeComparisons: true,
            timeframe: reportType
          }),
          createdBy: session.user.id
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Scheduled report created successfully',
        scheduledReport: {
          id: scheduledReport.id,
          name: scheduledReport.name,
          schedule: scheduledReport.schedule,
          isActive: scheduledReport.isActive
        }
      })
    }

    // Return the report as download
    return new NextResponse(reportBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${reportName}"`,
        'Content-Length': reportBuffer.length.toString(),
      }
    })

  } catch (error) {
    console.error('Report generation error:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Get scheduled reports for an organization
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')

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
        { error: 'Access denied to organization' },
        { status: 403 }
      )
    }

    // Get scheduled reports
    const scheduledReports = await prisma.scheduledReport.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        description: true,
        reportType: true,
        format: true,
        schedule: true,
        recipients: true,
        isActive: true,
        lastRunAt: true,
        nextRunAt: true,
        createdAt: true,
        createdBy: true,
        user: {
          select: {
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    const formattedReports = scheduledReports.map(report => ({
      ...report,
      recipients: JSON.parse(report.recipients as string || '[]'),
      createdByUser: report.user
    }))

    return NextResponse.json({
      success: true,
      scheduledReports: formattedReports
    })

  } catch (error) {
    console.error('Get scheduled reports error:', error)
    return NextResponse.json(
      { error: 'Failed to get scheduled reports' },
      { status: 500 }
    )
  }
}

/**
 * Update or delete scheduled report
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { reportId, action, updates } = body

    if (!reportId) {
      return NextResponse.json(
        { error: 'Report ID is required' },
        { status: 400 }
      )
    }

    // Get the scheduled report
    const scheduledReport = await prisma.scheduledReport.findUnique({
      where: { id: reportId },
      include: {
        organization: {
          include: {
            members: {
              where: { userId: session.user.id }
            }
          }
        }
      }
    })

    if (!scheduledReport || scheduledReport.organization.members.length === 0) {
      return NextResponse.json(
        { error: 'Scheduled report not found or access denied' },
        { status: 404 }
      )
    }

    if (action === 'delete') {
      await prisma.scheduledReport.delete({
        where: { id: reportId }
      })

      return NextResponse.json({
        success: true,
        message: 'Scheduled report deleted successfully'
      })
    }

    if (action === 'update' && updates) {
      const updatedReport = await prisma.scheduledReport.update({
        where: { id: reportId },
        data: {
          name: updates.name,
          description: updates.description,
          schedule: updates.schedule,
          recipients: updates.recipients ? JSON.stringify(updates.recipients) : undefined,
          isActive: updates.isActive,
          reportOptions: updates.reportOptions ? JSON.stringify(updates.reportOptions) : undefined
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Scheduled report updated successfully',
        scheduledReport: updatedReport
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )

  } catch (error) {
    console.error('Update scheduled report error:', error)
    return NextResponse.json(
      { error: 'Failed to update scheduled report' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}