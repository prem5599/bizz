// src/app/api/cron/generate-reports/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { generateHTMLReport, generatePDFReport } from '@/lib/reports/pdf'
import { sendBatchReportEmails } from '@/lib/reports/email'

export const dynamic = 'force-dynamic'

/**
 * Cron job endpoint for automated report generation
 * This should be called periodically to generate and send scheduled reports
 */
export async function POST(request: NextRequest) {
  try {
    // Security check - verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_API_KEY

    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not configured')
      return NextResponse.json(
        { error: 'Cron job not properly configured' },
        { status: 500 }
      )
    }

    // Check authorization (either Bearer token or X-API-Key header)
    const apiKey = request.headers.get('x-api-key') || 
                   request.headers.get('x-cron-key') ||
                   (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)

    if (apiKey !== cronSecret) {
      console.error('Unauthorized cron job request')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      )
    }

    console.log('Starting automated report generation...')
    const startTime = Date.now()

    // Get execution parameters from request body or use defaults
    const body = await request.json().catch(() => ({}))
    const options = {
      dryRun: body.dryRun || false,
      reportIds: body.reportIds || null, // null means all active reports
      maxConcurrent: body.maxConcurrent || 3
    }

    let results = {
      success: true,
      totalReports: 0,
      successfulReports: 0,
      failedReports: 0,
      totalEmailsSent: 0,
      totalEmailsFailed: 0,
      errors: [] as Array<{ reportId: string; error: string }>,
      executionTimeMs: 0,
      timestamp: new Date().toISOString()
    }

    if (options.dryRun) {
      console.log('DRY RUN MODE - No reports will be generated or sent')
    }

    // Get scheduled reports that are due to run
    const now = new Date()
    const whereClause = options.reportIds 
      ? { id: { in: options.reportIds } }
      : {
          isActive: true,
          OR: [
            { nextRunAt: { lte: now } },
            { nextRunAt: null } // First run
          ]
        }

    const scheduledReports = await prisma.scheduledReport.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            integrations: {
              where: { status: 'active' },
              select: { id: true, platform: true }
            }
          }
        }
      }
    })

    results.totalReports = scheduledReports.length
    console.log(`Found ${scheduledReports.length} scheduled reports to process`)

    if (options.dryRun) {
      return NextResponse.json({
        ...results,
        message: 'Dry run completed - no reports generated',
        reports: scheduledReports.map(report => ({
          id: report.id,
          name: report.name,
          organizationName: report.organization.name,
          reportType: report.reportType,
          schedule: report.schedule,
          nextRunAt: report.nextRunAt,
          hasActiveIntegrations: report.organization.integrations.length > 0
        }))
      })
    }

    // Process reports in batches to avoid overwhelming the system
    const batchSize = options.maxConcurrent
    const batches = []
    for (let i = 0; i < scheduledReports.length; i += batchSize) {
      batches.push(scheduledReports.slice(i, i + batchSize))
    }

    console.log(`Processing ${batches.length} batches of max ${batchSize} reports each`)

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`Processing batch ${batchIndex + 1}/${batches.length}`)

      // Process batch in parallel
      const batchPromises = batch.map(async (report) => {
        try {
          console.log(`Generating report: ${report.name} (${report.id}) for ${report.organization.name}`)

          // Skip reports for organizations with no active integrations
          if (report.organization.integrations.length === 0) {
            console.log(`Skipping ${report.name} - no active integrations`)
            return { success: true, reportId: report.id, skipped: true, reason: 'no_integrations' }
          }

          // Determine report timeframe
          const timeframe = getReportTimeframe(report.reportType)
          
          // Parse recipients
          const recipients = JSON.parse(report.recipients as string || '[]') as Array<{
            email: string
            name?: string
          }>

          if (recipients.length === 0) {
            console.log(`Skipping ${report.name} - no recipients configured`)
            return { success: true, reportId: report.id, skipped: true, reason: 'no_recipients' }
          }

          // Generate report
          let reportBuffer: Buffer
          let reportName: string
          
          const reportDate = new Date().toISOString().split('T')[0]
          
          if (report.format === 'html') {
            const htmlContent = await generateHTMLReport(report.organizationId, timeframe, {
              format: 'standard',
              includeInsights: true,
              includeTrends: true,
              includeComparisons: true
            })
            reportBuffer = Buffer.from(htmlContent, 'utf8')
            reportName = `${report.organization.name}-${report.reportType}-report-${reportDate}.html`
          } else {
            // Generate PDF
            reportBuffer = await generatePDFReport(report.organizationId, timeframe, {
              format: 'standard',
              includeInsights: true,
              includeTrends: true,
              includeComparisons: true
            })
            reportName = `${report.organization.name}-${report.reportType}-report-${reportDate}.pdf`
          }

          // Send emails to all recipients
          const emailResult = await sendBatchReportEmails(
            report.organizationId,
            recipients,
            {
              reportTitle: `${capitalizeFirst(report.reportType)} Analytics Report`,
              reportType: report.reportType as any,
              attachmentBuffer: reportBuffer,
              attachmentName: reportName,
              attachmentType: report.format as any,
              includeMetrics: true,
              customMessage: report.description || undefined
            }
          )

          // Update report last run and next run times
          const nextRunAt = calculateNextRunTime(report.schedule)
          await prisma.scheduledReport.update({
            where: { id: report.id },
            data: {
              lastRunAt: now,
              nextRunAt,
              runCount: { increment: 1 }
            }
          })

          console.log(`Report ${report.name} completed: ${emailResult.totalSent} emails sent, ${emailResult.totalFailed} failed`)

          return {
            success: true,
            reportId: report.id,
            reportName: report.name,
            emailsSent: emailResult.totalSent,
            emailsFailed: emailResult.totalFailed,
            emailErrors: emailResult.errors,
            nextRunAt
          }

        } catch (error) {
          console.error(`Failed to generate report ${report.id}:`, error)
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push({
            reportId: report.id,
            error: errorMessage
          })
          
          return {
            success: false,
            reportId: report.id,
            error: errorMessage
          }
        }
      })

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Update results
      batchResults.forEach(result => {
        if (result.success && !result.skipped) {
          results.successfulReports++
          results.totalEmailsSent += result.emailsSent || 0
          results.totalEmailsFailed += result.emailsFailed || 0
        } else if (!result.success) {
          results.failedReports++
        }
      })

      // Small delay between batches to prevent overwhelming the system
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }

    results.executionTimeMs = Date.now() - startTime
    
    console.log(`Report generation completed in ${results.executionTimeMs}ms`)
    console.log(`Results: ${results.successfulReports}/${results.totalReports} reports processed successfully`)
    console.log(`Emails: ${results.totalEmailsSent} sent, ${results.totalEmailsFailed} failed`)

    if (results.errors.length > 0) {
      console.warn(`Errors occurred for ${results.errors.length} reports:`, results.errors)
    }

    return NextResponse.json({
      ...results,
      message: `Successfully processed ${results.successfulReports}/${results.totalReports} scheduled reports`
    })

  } catch (error) {
    console.error('Cron job failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Cron job execution failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Basic health check - verify database connectivity
    const activeReportsCount = await prisma.scheduledReport.count({
      where: { isActive: true }
    })

    const recentReports = await prisma.scheduledReport.count({
      where: {
        lastRunAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    const upcomingReports = await prisma.scheduledReport.count({
      where: {
        isActive: true,
        nextRunAt: {
          gte: new Date(),
          lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // Next 24 hours
        }
      }
    })

    return NextResponse.json({
      status: 'healthy',
      service: 'reports-cron',
      timestamp: new Date().toISOString(),
      stats: {
        activeReports: activeReportsCount,
        reportsRunLast24h: recentReports,
        upcomingReportsNext24h: upcomingReports
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      service: 'reports-cron',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

/**
 * Helper function to get report timeframe based on report type
 */
function getReportTimeframe(reportType: string): { start: Date; end: Date } {
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
  
  return { start: startDate, end: endDate }
}

/**
 * Calculate next run time based on cron schedule
 * Simplified implementation - in production use a proper cron parser
 */
function calculateNextRunTime(schedule: string): Date {
  const now = new Date()
  const nextRun = new Date(now)
  
  // Simple schedule parsing - extend this for full cron support
  switch (schedule) {
    case '0 9 * * 1': // Weekly on Monday at 9 AM
      nextRun.setDate(now.getDate() + (7 - now.getDay() + 1) % 7 || 7)
      nextRun.setHours(9, 0, 0, 0)
      break
    case '0 9 1 * *': // Monthly on 1st at 9 AM
      nextRun.setMonth(now.getMonth() + 1, 1)
      nextRun.setHours(9, 0, 0, 0)
      break
    case '0 9 1 1,4,7,10 *': // Quarterly on 1st at 9 AM
      const currentMonth = now.getMonth()
      const quarterStarts = [0, 3, 6, 9] // Jan, Apr, Jul, Oct
      let nextQuarter = quarterStarts.find(month => month > currentMonth)
      if (!nextQuarter) {
        nextQuarter = quarterStarts[0]
        nextRun.setFullYear(now.getFullYear() + 1)
      }
      nextRun.setMonth(nextQuarter, 1)
      nextRun.setHours(9, 0, 0, 0)
      break
    default:
      // Default to weekly
      nextRun.setDate(now.getDate() + 7)
      nextRun.setHours(9, 0, 0, 0)
  }
  
  // If next run time is in the past, add the appropriate interval
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 7) // Add a week as fallback
  }
  
  return nextRun
}

/**
 * Helper function to capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}