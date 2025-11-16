// app/api/organizations/[orgId]/reports/[reportId]/download/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TeamManager } from '@/lib/team/manager'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; reportId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId, reportId } = await params

    // Check permissions
    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canViewReports'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get the report
    const report = await prisma.report.findFirst({
      where: {
        id: reportId,
        organizationId: orgId
      },
      include: {
        organization: {
          select: { name: true }
        }
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    // Get the format from query params
    const { searchParams } = new URL(req.url)
    const format = searchParams.get('format') || 'json'

    // Format the report data
    const reportData = report.content as any
    const fileName = `${report.title.replace(/[^a-zA-Z0-9]/g, '_')}_${report.dateRangeStart.toISOString().split('T')[0]}`

    switch (format.toLowerCase()) {
      case 'json':
        return new NextResponse(JSON.stringify(reportData, null, 2), {
          headers: {
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${fileName}.json"`
          }
        })

      case 'csv':
        // Convert report data to CSV format
        const csvData = generateCSV(reportData)
        return new NextResponse(csvData, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="${fileName}.csv"`
          }
        })

      case 'html':
        // Generate HTML report
        const htmlReport = generateHTMLReport(report, reportData)
        return new NextResponse(htmlReport, {
          headers: {
            'Content-Type': 'text/html',
            'Content-Disposition': `attachment; filename="${fileName}.html"`
          }
        })

      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 })
    }

  } catch (error) {
    console.error('Download report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateCSV(reportData: any): string {
  const lines = [
    'Report Summary',
    `Total Revenue,${reportData.summary?.totalRevenue || 0}`,
    `Total Orders,${reportData.summary?.totalOrders || 0}`,
    `Total Customers,${reportData.summary?.totalCustomers || 0}`,
    `Average Order Value,${reportData.summary?.avgOrderValue || 0}`,
    `Performance Score,${reportData.summary?.performanceScore || 0}`,
    '',
    'Daily Metrics',
    'Date,Revenue,Orders,Customers'
  ]

  // Add daily metrics if available
  if (reportData.metrics?.revenue) {
    reportData.metrics.revenue.forEach((item: any) => {
      const orders = reportData.metrics.orders?.find((o: any) => o.date === item.date)?.value || 0
      const customers = reportData.metrics.customers?.find((c: any) => c.date === item.date)?.value || 0
      lines.push(`${item.date},${item.value},${orders},${customers}`)
    })
  }

  // Add top products if available
  if (reportData.topProducts && reportData.topProducts.length > 0) {
    lines.push('', 'Top Products', 'Product Name,Revenue,Orders,Percentage')
    reportData.topProducts.forEach((product: any) => {
      lines.push(`"${product.name}",${product.revenue},${product.orders},${product.percentage}`)
    })
  }

  return lines.join('\n')
}

function generateHTMLReport(report: any, reportData: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
        .header { border-bottom: 2px solid #3B82F6; padding-bottom: 20px; margin-bottom: 30px; }
        .title { color: #1F2937; font-size: 28px; margin-bottom: 10px; }
        .subtitle { color: #6B7280; font-size: 16px; }
        .section { margin-bottom: 30px; }
        .section-title { color: #1F2937; font-size: 20px; margin-bottom: 15px; border-left: 4px solid #3B82F6; padding-left: 15px; }
        .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: #F9FAFB; padding: 20px; border-radius: 8px; border: 1px solid #E5E7EB; }
        .metric-label { color: #6B7280; font-size: 14px; margin-bottom: 5px; }
        .metric-value { color: #1F2937; font-size: 24px; font-weight: bold; }
        .table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        .table th, .table td { text-align: left; padding: 12px; border-bottom: 1px solid #E5E7EB; }
        .table th { background: #F3F4F6; font-weight: 600; color: #374151; }
        .score { color: #10B981; font-weight: bold; }
        .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 14px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="title">${report.title}</div>
        <div class="subtitle">
            Generated on ${new Date(report.generatedAt).toLocaleDateString()} • 
            Period: ${new Date(report.dateRangeStart).toLocaleDateString()} - ${new Date(report.dateRangeEnd).toLocaleDateString()}
        </div>
    </div>

    <div class="section">
        <div class="section-title">Performance Summary</div>
        <div class="metric-grid">
            <div class="metric-card">
                <div class="metric-label">Total Revenue</div>
                <div class="metric-value">$${(reportData.summary?.totalRevenue || 0).toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Total Orders</div>
                <div class="metric-value">${(reportData.summary?.totalOrders || 0).toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Total Customers</div>
                <div class="metric-value">${(reportData.summary?.totalCustomers || 0).toLocaleString()}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Average Order Value</div>
                <div class="metric-value">$${(reportData.summary?.avgOrderValue || 0).toFixed(2)}</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Performance Score</div>
                <div class="metric-value score">${(reportData.summary?.performanceScore || 0).toFixed(1)}/100</div>
            </div>
        </div>
    </div>

    ${reportData.topProducts && reportData.topProducts.length > 0 ? `
    <div class="section">
        <div class="section-title">Top Products</div>
        <table class="table">
            <thead>
                <tr>
                    <th>Product Name</th>
                    <th>Revenue</th>
                    <th>Orders</th>
                    <th>Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${reportData.topProducts.map((product: any) => `
                    <tr>
                        <td>${product.name}</td>
                        <td>$${product.revenue.toFixed(2)}</td>
                        <td>${product.orders}</td>
                        <td>${product.percentage.toFixed(1)}%</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
    ` : ''}

    ${reportData.insights && reportData.insights.length > 0 ? `
    <div class="section">
        <div class="section-title">Key Insights</div>
        ${reportData.insights.map((insight: any) => `
            <div style="background: #FEF3C7; padding: 15px; margin-bottom: 10px; border-radius: 6px; border-left: 4px solid #F59E0B;">
                <strong>${insight.title}</strong><br>
                ${insight.description}
            </div>
        `).join('')}
    </div>
    ` : ''}

    <div class="footer">
        Report generated by BizInsights • ${report.organization?.name || 'Organization'}
    </div>
</body>
</html>`
}