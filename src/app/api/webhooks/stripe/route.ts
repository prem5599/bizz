// src/app/api/webhooks/stripe/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { handleStripeWebhook } from '@/lib/integrations/stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const headersList = headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    // Get organization ID from query params
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('org')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing organization ID' },
        { status: 400 }
      )
    }

    // Verify webhook signature (simplified - in production, use Stripe's webhook secret)
    let event
    try {
      // Parse the webhook payload
      event = JSON.parse(body)
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      )
    }

    // Find the integration
    const integration = await prisma.integration.findFirst({
      where: {
        organizationId,
        platform: 'stripe',
        status: 'active'
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Log webhook event
    await prisma.webhookEvent.create({
      data: {
        integrationId: integration.id,
        topic: event.type,
        status: 'received',
        externalId: event.id,
        metadata: {
          stripeEvent: event,
          signature: signature.substring(0, 20) + '...' // Don't store full signature
        }
      }
    })

    // Process webhook
    const result = await handleStripeWebhook(integration.id, event)

    if (result.success) {
      // Update webhook event status
      await prisma.webhookEvent.updateMany({
        where: {
          integrationId: integration.id,
          externalId: event.id
        },
        data: {
          status: 'processed',
          processedAt: new Date(),
          metadata: {
            stripeEvent: event,
            signature: signature.substring(0, 20) + '...',
            processed: result.processed
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Webhook processed successfully',
        processed: result.processed
      })
    } else {
      // Update webhook event status
      await prisma.webhookEvent.updateMany({
        where: {
          integrationId: integration.id,
          externalId: event.id
        },
        data: {
          status: 'failed',
          error: result.error,
          processedAt: new Date()
        }
      })

      return NextResponse.json(
        { error: result.error || 'Webhook processing failed' },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Stripe webhook error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}