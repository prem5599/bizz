// src/app/api/insights/[insightId]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ insightId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { insightId } = await params

    // Get insight with organization access check
    const insight = await prisma.insight.findFirst({
      where: {
        id: insightId,
        organization: {
          members: {
            some: {
              userId: session.user.id
            }
          }
        }
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!insight) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      insight
    })

  } catch (error) {
    console.error('Get insight error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ insightId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { insightId } = await params
    const body = await req.json()
    const { isRead } = body

    // Verify access and update
    const insight = await prisma.insight.findFirst({
      where: {
        id: insightId,
        organization: {
          members: {
            some: {
              userId: session.user.id
            }
          }
        }
      }
    })

    if (!insight) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      )
    }

    const updatedInsight = await prisma.insight.update({
      where: { id: insightId },
      data: {
        isRead: isRead !== undefined ? isRead : insight.isRead
      }
    })

    return NextResponse.json({
      success: true,
      insight: updatedInsight
    })

  } catch (error) {
    console.error('Update insight error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ insightId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { insightId } = await params

    // Verify access and delete
    const insight = await prisma.insight.findFirst({
      where: {
        id: insightId,
        organization: {
          members: {
            some: {
              userId: session.user.id
            }
          }
        }
      }
    })

    if (!insight) {
      return NextResponse.json(
        { error: 'Insight not found' },
        { status: 404 }
      )
    }

    await prisma.insight.delete({
      where: { id: insightId }
    })

    return NextResponse.json({
      success: true,
      message: 'Insight deleted successfully'
    })

  } catch (error) {
    console.error('Delete insight error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
