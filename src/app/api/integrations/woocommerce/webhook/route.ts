// src/app/api/integrations/woocommerce/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

/**
 * Verify WooCommerce webhook signature
 * WooCommerce uses HMAC-SHA256 with a webhook secret
 */
function verifyWooCommerceWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  try {
    if (!secret || !signature) {
      console.warn('Missing webhook secret or signature')
      return false
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('base64')

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    )
  } catch (error) {
    console.error('Webhook signature verification error:', error)
    return false
  }
}

/**
 * Extract event type from WooCommerce webhook payload
 */
function extractEventType(headers: Headers, payload: any): string {
  // WooCommerce sends event type in X-WC-Webhook-Topic header
  const topic = headers.get('x-wc-webhook-topic')
  if (topic) {
    return topic
  }

  // Fallback: try to determine from payload structure
  if (payload) {
    if (payload.id && payload.status && payload.total !== undefined) {
      return 'order.updated'
    } else if (payload.id && payload.name && payload.price !== undefined) {
      return 'product.updated'
    } else if (payload.id && payload.email) {
      return 'customer.updated'
    }
  }

  return 'unknown'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text()
    const signature = req.headers.get('x-wc-webhook-signature')
    const source = req.headers.get('x-wc-webhook-source') || 'unknown'
    const delivery = req.headers.get('x-wc-webhook-delivery-id')

    console.log('WooCommerce webhook received:', {
      source,
      delivery,
      hasSignature: !!signature,
      bodyLength: body.length
    })

    // Get organization ID from query params
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('org')

    if (!organizationId) {
      console.error('Missing organization ID in webhook URL')
      return NextResponse.json(
        { error: 'Missing organization ID' },
        { status: 400 }
      )
    }

    // Find the WooCommerce integration for this organization
    const integration = await prisma.integration.findFirst({
      where: {
        organizationId,
        platform: 'woocommerce',
        status: 'active'
      }
    })

    if (!integration) {
      console.error(`No active WooCommerce integration found for organization ${organizationId}`)
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Parse webhook payload
    let webhookData
    try {
      webhookData = JSON.parse(body)
    } catch (error) {
      console.error('Invalid JSON in webhook body:', error)
      return NextResponse.json(
        { error: 'Invalid JSON' },
        { status: 400 }
      )
    }

    // Extract event type
    const eventType = extractEventType(req.headers, webhookData)

    // Verify webhook signature if secret is configured
    const metadata = integration.metadata as any
    const webhookSecret = metadata?.webhookSecret || process.env.WOOCOMMERCE_WEBHOOK_SECRET

    if (webhookSecret && signature) {
      if (!verifyWooCommerceWebhookSignature(body, signature, webhookSecret)) {
        console.error('Invalid WooCommerce webhook signature')
        
        // Log failed signature verification
        await prisma.webhookEvent.create({
          data: {
            integrationId: integration.id,
            topic: eventType,
            status: 'signature_verification_failed',
            externalId: delivery || `wc_${Date.now()}`,
            error: 'Invalid webhook signature',
            metadata: JSON.stringify({
              eventType,
              source,
              deliveryId: delivery,
              signatureProvided: !!signature,
              source: 'woocommerce_webhook'
            })
          }
        })

        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 400 }
        )
      }
    } else if (webhookSecret) {
      console.warn('Webhook secret configured but no signature provided')
    }

    console.log(`Processing WooCommerce webhook ${eventType} for integration ${integration.id}`)

    // Log webhook event to database
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        integrationId: integration.id,
        topic: eventType,
        status: 'received',
        externalId: delivery || `wc_${webhookData.id || Date.now()}`,
        metadata: JSON.stringify({
          eventType,
          source,
          deliveryId: delivery,
          objectId: webhookData.id,
          objectType: eventType.split('.')[0],
          storeUrl: metadata?.storeUrl,
          source: 'woocommerce_webhook'
        })
      }
    })

    try {
      // Import and handle the webhook event
      const { handleWooCommerceWebhook } = await import('@/lib/integrations/woocommerce')
      const result = await handleWooCommerceWebhook(integration.id, eventType, webhookData)

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
      console.log(`WooCommerce webhook ${eventType} processed successfully: ${result.processed} data points`)

      // Update integration last activity
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          metadata: JSON.stringify({
            ...metadata,
            lastWebhookAt: new Date().toISOString(),
            lastWebhookType: eventType,
            lastWebhookProcessed: result.processed,
            totalWebhooksProcessed: (metadata?.totalWebhooksProcessed || 0) + 1
          })
        }
      })

      return NextResponse.json({
        success: true,
        processed: result.processed,
        eventType: eventType
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

      console.error('WooCommerce webhook processing error:', processingError)
      
      // If the integration class doesn't exist yet, return success to avoid webhook retries
      if (processingError instanceof Error && processingError.message.includes('Cannot resolve module')) {
        console.warn('WooCommerce integration handler not available yet, acknowledging webhook')
        return NextResponse.json({ success: true, processed: 0 })
      }

      throw processingError
    }

  } catch (error) {
    console.error('WooCommerce webhook processing error:', error)
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
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const organizationId = searchParams.get('org')

  if (!organizationId) {
    return NextResponse.json(
      { error: 'Organization ID required' },
      { status: 400 }
    )
  }

  // Find active WooCommerce integration
  const integration = await prisma.integration.findFirst({
    where: {
      organizationId,
      platform: 'woocommerce',
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
      { error: 'No active WooCommerce integration found' },
      { status: 404 }
    )
  }

  const metadata = integration.metadata ? JSON.parse(integration.metadata as string) : {}

  return NextResponse.json({
    success: true,
    webhook: {
      organizationId,
      integrationId: integration.id,
      storeUrl: integration.platformAccountId,
      webhooksConfigured: metadata.webhooksConfigured || false,
      webhookEndpoint: req.url,
      integrationCreated: integration.createdAt,
      supportedEvents: [
        'order.created',
        'order.updated',
        'order.deleted',
        'product.created', 
        'product.updated',
        'product.deleted',
        'customer.created',
        'customer.updated',
        'customer.deleted',
        'coupon.created',
        'coupon.updated',
        'coupon.deleted'
      ]
    }
  })
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-WC-Webhook-Topic, X-WC-Webhook-Signature, X-WC-Webhook-Source, X-WC-Webhook-Delivery-ID'
    }
  })
}