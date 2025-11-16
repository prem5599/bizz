// src/app/api/integrations/stripe/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { handleStripeWebhook } from '@/lib/integrations/stripe'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')
    
    if (!signature) {
      console.error('Missing Stripe signature header')
      return NextResponse.json(
        { error: 'Missing signature' },
        { status: 400 }
      )
    }

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('STRIPE_WEBHOOK_SECRET environment variable not set')
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 500 }
      )
    }

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET)
      .update(body, 'utf8')
      .digest('hex')

    const providedSignature = signature.split(',').find(sig => 
      sig.trim().startsWith('v1=')
    )?.replace('v1=', '')

    if (!providedSignature || !crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(providedSignature, 'hex')
    )) {
      console.error('Invalid Stripe webhook signature')
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 400 }
      )
    }

    // Parse webhook event
    let event
    try {
      event = JSON.parse(body)
    } catch (error) {
      console.error('Invalid JSON in webhook body:', error)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Get organization ID from query params
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('org')

    if (!organizationId) {
      console.error('Missing organization ID in webhook URL')
      return NextResponse.json(
        { error: 'Missing organization ID' },
        { status: 400 }
      )
    }

    // Find the Stripe integration for this organization
    let integration
    
    // Try to find by Stripe account ID if available
    if (event.account) {
      integration = await prisma.integration.findFirst({
        where: {
          organizationId,
          platform: 'stripe',
          platformAccountId: event.account,
          status: 'active'
        }
      })
    }

    // Fallback: find any active Stripe integration for this org
    if (!integration) {
      integration = await prisma.integration.findFirst({
        where: {
          organizationId,
          platform: 'stripe',
          status: 'active'
        }
      })
    }

    if (!integration) {
      console.error(`No active Stripe integration found for organization ${organizationId}`)
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    console.log(`Processing Stripe webhook ${event.type} for integration ${integration.id}`)

    // Log webhook event to database
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        integrationId: integration.id,
        topic: event.type,
        status: 'received',
        externalId: event.id,
        metadata: JSON.stringify({
          eventType: event.type,
          accountId: event.account,
          livemode: event.livemode,
          apiVersion: event.api_version,
          requestId: event.request?.id,
          objectId: event.data?.object?.id,
          source: 'stripe_webhook'
        })
      }
    })

    try {
      // Handle the webhook event
      const result = await handleStripeWebhook(integration.id, event)

      if (!result.success) {
        // Update webhook event status to failed
        await prisma.webhookEvent.update({
          where: { id: webhookEvent.id },
          data: {
            status: 'failed',
            error: result.error,
            processedAt: new Date()
          }
        })

        console.error(`Webhook processing failed:`, result.error)
        return NextResponse.json(
          { error: 'Webhook processing failed', details: result.error },
          { status: 500 }
        )
      }

      // Update webhook event status to processed
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'processed',
          processedAt: new Date(),
          metadata: JSON.stringify({
            ...JSON.parse(webhookEvent.metadata),
            processed: result.processed,
            processingDuration: Date.now() - webhookEvent.receivedAt.getTime()
          })
        }
      })

      // Log successful webhook processing
      console.log(`Stripe webhook ${event.type} processed successfully: ${result.processed} data points`)

      // Update integration last activity
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          metadata: JSON.stringify({
            ...((integration.metadata as any) || {}),
            lastWebhookAt: new Date().toISOString(),
            lastWebhookType: event.type,
            lastWebhookProcessed: result.processed,
            totalWebhooksProcessed: ((integration.metadata as any)?.totalWebhooksProcessed || 0) + 1
          })
        }
      })

    } catch (processingError) {
      // Update webhook event status to failed
      await prisma.webhookEvent.update({
        where: { id: webhookEvent.id },
        data: {
          status: 'failed',
          error: processingError instanceof Error ? processingError.message : 'Unknown processing error',
          processedAt: new Date()
        }
      })

      throw processingError
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      eventType: event.type
    })

  } catch (error) {
    console.error('Stripe webhook processing error:', error)
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// Handle GET requests for webhook endpoint verification
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const organizationId = searchParams.get('org')

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Organization ID required' },
      { status: 400 }
    )
  }

  // Find active Stripe integration
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId,
      platform: 'stripe',
      status: 'active'
    },
    select: {
      id: true,
      platformAccountId: true,
      metadata: true,
      createdAt: true
    }
  })

  if (!integration) {
    return NextResponse.json(
      { error: 'No active Stripe integration found' },
      { status: 404 }
    )
  }

  const metadata = integration.metadata ? JSON.parse(integration.metadata as string) : {}

  return NextResponse.json({
    success: true,
    webhook: {
      organizationId,
      integrationId: integration.id,
      platformAccountId: integration.platformAccountId,
      webhooksConfigured: metadata.webhooksConfigured || false,
      webhookEndpoint: request.url,
      integrationCreated: integration.createdAt
    }
  })
}