// src/app/api/integrations/stripe/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StripeIntegration } from '@/lib/integrations/stripe'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { integrationId, days = 30 } = body

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        platform: 'stripe',
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN'] }
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

    if (!integration.accessToken) {
      return NextResponse.json(
        { error: 'Integration not properly configured' },
        { status: 400 }
      )
    }

    // Start sync
    const stripe = new StripeIntegration(integration.accessToken)
    const syncResults = await stripe.syncHistoricalData(integrationId, days)

    // Update integration last sync time
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        metadata: {
          ...(integration.metadata as any || {}),
          lastManualSync: new Date().toISOString(),
          lastSyncResults: syncResults
        }
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Sync completed successfully',
      results: syncResults
    })

  } catch (error) {
    console.error('Stripe sync error:', error)
    return NextResponse.json(
      { error: 'Sync failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
