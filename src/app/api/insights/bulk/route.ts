// src/app/api/insights/bulk/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { organizationId, insightIds, action } = body

    if (!organizationId || !action) {
      return NextResponse.json(
        { error: 'Organization ID and action are required' },
        { status: 400 }
      )
    }

    // For actions other than 'markAllAsRead', require insightIds
    if (action !== 'markAllAsRead' && (!insightIds || !Array.isArray(insightIds))) {
      return NextResponse.json(
        { error: 'Insight IDs array is required for this action' },
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
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    let updateData: Record<string, unknown> = {}
    let message = ''

    switch (action) {
      case 'markRead':
      case 'markAsRead':
        updateData = { isRead: true }
        message = `Marked ${insightIds?.length || 0} insights as read`
        break
      
      case 'markUnread':
      case 'markAsUnread':
        updateData = { isRead: false }
        message = `Marked ${insightIds?.length || 0} insights as unread`
        break
      
      case 'markAllAsRead':
        updateData = { isRead: true }
        message = `Marked all insights as read`
        break
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        )
    }

    // Update insights
    let result: { count: number }
    if (action === 'markAllAsRead') {
      // Mark all insights in the organization as read
      result = await prisma.insight.updateMany({
        where: {
          organizationId
        },
        data: updateData
      })
    } else {
      // Mark specific insights
      result = await prisma.insight.updateMany({
        where: {
          id: { in: insightIds },
          organizationId
        },
        data: updateData
      })
    }

    return NextResponse.json({
      success: true,
      message: action === 'markAllAsRead' ? 
        `Marked ${result.count} insights as read` : 
        message,
      updated: result.count
    })

  } catch (error) {
    console.error('Bulk insights update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { organizationId, insightIds } = body

    if (!organizationId || !insightIds || !Array.isArray(insightIds)) {
      return NextResponse.json(
        { error: 'Organization ID and insight IDs array are required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Delete insights
    const result = await prisma.insight.deleteMany({
      where: {
        id: { in: insightIds },
        organizationId
      }
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${result.count} insights`,
      deleted: result.count
    })

  } catch (error) {
    console.error('Bulk insights delete error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}