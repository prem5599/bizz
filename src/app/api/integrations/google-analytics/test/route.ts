// src/app/api/integrations/google-analytics/test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleAnalyticsIntegration } from '@/lib/integrations/google-analytics'

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

    // Get integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        platform: 'google_analytics',
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

    if (!integration.accessToken || !integration.refreshToken || !integration.platformAccountId) {
      return NextResponse.json(
        { error: 'Integration not configured' },
        { status: 400 }
      )
    }

    // Test connection
    const ga = new GoogleAnalyticsIntegration(
      integration.accessToken,
      integration.refreshToken,
      integration.platformAccountId
    )
    
    const isConnected = await ga.testConnection()

    if (isConnected) {
      // Update integration status
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'active',
          metadata: {
            ...(integration.metadata as any || {}),
            lastTestedAt: new Date().toISOString(),
            testStatus: 'success'
          }
        }
      })

      return NextResponse.json({
        success: true,
        status: 'connected',
        message: 'Google Analytics connection is working properly'
      })
    } else {
      // Update integration status
      await prisma.integration.update({
        where: { id: integrationId },
        data: {
          status: 'error',
          metadata: {
            ...(integration.metadata as any || {}),
            lastTestedAt: new Date().toISOString(),
            testStatus: 'failed'
          }
        }
      })

      return NextResponse.json({
        success: false,
        status: 'disconnected',
        message: 'Google Analytics connection failed - please reconnect'
      })
    }

  } catch (error) {
    console.error('Google Analytics test error:', error)
    return NextResponse.json(
      { error: 'Test failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}