// src/app/api/integrations/google-analytics/disconnect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { integrationId } = body

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to this integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        platform: 'google_analytics',
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['owner', 'admin'] }
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or access denied' },
        { status: 404 }
      )
    }

    // Disconnect integration (soft delete - keep data)
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        status: 'disconnected',
        accessToken: null,
        refreshToken: null,
        metadata: {
          ...(integration.metadata as any || {}),
          disconnectedAt: new Date().toISOString(),
          disconnectedBy: session.user.id
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Google Analytics integration disconnected successfully'
    })

  } catch (error) {
    console.error('Google Analytics disconnect error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}