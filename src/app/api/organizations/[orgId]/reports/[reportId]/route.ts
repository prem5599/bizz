// app/api/organizations/[orgId]/reports/[reportId]/route.ts
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
      }
    })

    if (!report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    return NextResponse.json({
      report: {
        id: report.id,
        title: report.title,
        reportType: report.reportType,
        content: report.content,
        dateRangeStart: report.dateRangeStart,
        dateRangeEnd: report.dateRangeEnd,
        generatedAt: report.generatedAt,
        emailedAt: report.emailedAt
      }
    })

  } catch (error) {
    console.error('Get report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; reportId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId, reportId } = await params

    // Check permissions (only admins and owners can delete)
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: orgId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!member) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Delete the report
    const deletedReport = await prisma.report.delete({
      where: {
        id: reportId,
        organizationId: orgId
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Report deleted successfully'
    })

  } catch (error) {
    console.error('Delete report error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}