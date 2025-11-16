// src/app/api/webhooks/shopify/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Shopify webhook data interfaces
interface ShopifyOrder {
  id: number
  name: string
  email: string
  created_at: string
  updated_at: string
  cancelled_at?: string
  financial_status: string
  fulfillment_status: string
  total_price: string
  subtotal_price: string
  total_tax: string
  currency: string
  customer?: {
    id: number
    email: string
    created_at: string
    first_name: string
    last_name: string
    orders_count: number
    total_spent: string
  }
  line_items: Array<{
    id: number
    product_id: number
    variant_id: number
    title: string
    quantity: number
    price: string
    total_discount: string
  }>
  shipping_address?: {
    country: string
    province: string
    city: string
  }
  billing_address?: {
    country: string
    province: string
    city: string
  }
}

interface ShopifyCustomer {
  id: number
  email: string
  created_at: string
  updated_at: string
  first_name: string
  last_name: string
  orders_count: number
  total_spent: string
  currency: string
  phone?: string
  accepts_marketing: boolean
  marketing_opt_in_level?: string
  addresses: Array<{
    country: string
    province: string
    city: string
  }>
}

// Verify Shopify webhook authenticity
function verifyShopifyWebhook(body: string, signature: string, secret: string): boolean {
  if (!secret) {
    console.warn('No webhook secret configured')
    return false
  }

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body, 'utf8')
  const calculatedSignature = hmac.digest('base64')
  
  return crypto.timingSafeEqual(
    Buffer.from(calculatedSignature),
    Buffer.from(signature)
  )
}

// Find integration by shop domain
async function findIntegrationByShop(shopDomain: string) {
  return await prisma.integration.findFirst({
    where: {
      platform: 'shopify',
      platformAccountId: shopDomain,
      status: 'active'
    }
  })
}

// Create webhook event record
async function createWebhookEvent(
  integrationId: string,
  topic: string,
  externalId: string,
  status: 'received' | 'processed' | 'failed' | 'signature_verification_failed' | 'invalid_json',
  error?: string,
  metadata?: any
) {
  return await prisma.webhookEvent.create({
    data: {
      integrationId,
      topic,
      externalId,
      status,
      error,
      metadata: metadata || {},
      receivedAt: new Date(),
      processedAt: status === 'processed' ? new Date() : undefined
    }
  })
}

// Process order webhook (create, update, paid, cancelled)
async function processOrderWebhook(
  integration: any,
  topic: string,
  order: ShopifyOrder
): Promise<void> {
  const dateRecorded = new Date(order.created_at)
  const orderValue = parseFloat(order.total_price)
  const isNewOrder = topic === 'orders/create'
  const isPaid = order.financial_status === 'paid'
  const isCancelled = !!order.cancelled_at

  // Create order revenue data point
  if (isNewOrder && !isCancelled) {
    await prisma.dataPoint.create({
      data: {
        integrationId: integration.id,
        metricType: 'orders',
        value: 1,
        dateRecorded,
        metadata: JSON.stringify({
          orderId: order.id,
          orderName: order.name,
          currency: order.currency,
          fulfillmentStatus: order.fulfillment_status
        })
      }
    })

    // Record order value separately
    await prisma.dataPoint.create({
      data: {
        integrationId: integration.id,
        metricType: 'order_value',
        value: orderValue,
        dateRecorded,
        metadata: JSON.stringify({
          orderId: order.id,
          orderName: order.name,
          currency: order.currency
        })
      }
    })
  }

  // Record revenue when order is paid
  if (isPaid && (topic === 'orders/paid' || (isNewOrder && isPaid))) {
    await prisma.dataPoint.create({
      data: {
        integrationId: integration.id,
        metricType: 'revenue',
        value: orderValue,
        dateRecorded: new Date(), // Use current time for when payment was received
        metadata: JSON.stringify({
          orderId: order.id,
          orderName: order.name,
          originalOrderDate: order.created_at,
          currency: order.currency,
          subtotal: order.subtotal_price,
          tax: order.total_tax
        })
      }
    })
  }

  // Handle cancellations
  if (isCancelled && topic === 'orders/cancelled') {
    await prisma.dataPoint.create({
      data: {
        integrationId: integration.id,
        metricType: 'orders_cancelled',
        value: 1,
        dateRecorded: new Date(order.cancelled_at!),
        metadata: JSON.stringify({
          orderId: order.id,
          orderName: order.name,
          originalOrderDate: order.created_at,
          cancelledOrderValue: orderValue,
          currency: order.currency
        })
      }
    })
  }

  // Process customer data if available
  if (order.customer && isNewOrder) {
    await processCustomerData(integration, order.customer, dateRecorded)
  }

  console.log(`Processed order webhook: ${topic} for order ${order.name} (${order.id})`)
}

// Process customer webhook (create, update)
async function processCustomerWebhook(
  integration: any,
  topic: string,
  customer: ShopifyCustomer
): Promise<void> {
  const dateRecorded = new Date(customer.created_at)
  const isNewCustomer = topic === 'customers/create'

  await processCustomerData(integration, customer, dateRecorded, isNewCustomer)

  console.log(`Processed customer webhook: ${topic} for customer ${customer.email} (${customer.id})`)
}

// Helper function to process customer data
async function processCustomerData(
  integration: any,
  customer: any,
  dateRecorded: Date,
  isNewCustomer: boolean = false
): Promise<void> {
  // Record new customer
  if (isNewCustomer) {
    await prisma.dataPoint.create({
      data: {
        integrationId: integration.id,
        metricType: 'customers',
        value: 1,
        dateRecorded,
        metadata: JSON.stringify({
          customerId: customer.id,
          email: customer.email,
          firstName: customer.first_name,
          lastName: customer.last_name,
          acceptsMarketing: customer.accepts_marketing
        })
      }
    })
  }

  // Record customer lifetime value
  const totalSpent = parseFloat(customer.total_spent || '0')
  if (totalSpent > 0) {
    await prisma.dataPoint.create({
      data: {
        integrationId: integration.id,
        metricType: 'customer_lifetime_value',
        value: totalSpent,
        dateRecorded: new Date(), // Use current time for LTV updates
        metadata: JSON.stringify({
          customerId: customer.id,
          email: customer.email,
          ordersCount: customer.orders_count,
          currency: customer.currency || 'USD'
        })
      }
    })
  }
}

// Process app uninstalled webhook
async function processAppUninstalled(integration: any): Promise<void> {
  await prisma.integration.update({
    where: {
      id: integration.id
    },
    data: {
      status: 'inactive',
      metadata: JSON.stringify({
        ...(typeof integration.metadata === 'string' ? JSON.parse(integration.metadata) : integration.metadata),
        uninstalledAt: new Date().toISOString()
      })
    }
  })

  console.log(`App uninstalled for integration ${integration.id}`)
}

export async function POST(req: NextRequest) {
  let body: string
  let shopDomain: string | null = null
  let topic: string | null = null

  try {
    // Get raw body for signature verification
    body = await req.text()
    
    // Get headers
    const signature = req.headers.get('x-shopify-hmac-sha256')
    shopDomain = req.headers.get('x-shopify-shop-domain')
    topic = req.headers.get('x-shopify-topic')

    if (!signature || !shopDomain || !topic) {
      console.warn('Missing required webhook headers:', { signature: !!signature, shopDomain, topic })
      return NextResponse.json({ error: 'Missing required headers' }, { status: 400 })
    }

    // Find the integration
    const integration = await findIntegrationByShop(shopDomain)
    if (!integration) {
      console.warn(`No active integration found for shop: ${shopDomain}`)
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Verify webhook signature
    const webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET
    if (!webhookSecret || !verifyShopifyWebhook(body, signature, webhookSecret)) {
      console.warn(`Invalid webhook signature for shop: ${shopDomain}`)
      
      // Record the failed verification
      await createWebhookEvent(
        integration.id,
        topic,
        'unknown',
        'signature_verification_failed',
        'Invalid webhook signature'
      )
      
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse JSON body
    let webhookData: any
    try {
      webhookData = JSON.parse(body)
    } catch (parseError) {
      console.error('Failed to parse webhook JSON:', parseError)
      
      await createWebhookEvent(
        integration.id,
        topic,
        'unknown',
        'invalid_json',
        'Failed to parse JSON body'
      )
      
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    // Extract external ID for tracking
    const externalId = webhookData.id?.toString() || 'unknown'

    try {
      // Process webhook based on topic
      switch (topic) {
        case 'orders/create':
        case 'orders/updated':
        case 'orders/paid':
        case 'orders/cancelled':
          await processOrderWebhook(integration, topic, webhookData as ShopifyOrder)
          break

        case 'customers/create':
        case 'customers/update':
          await processCustomerWebhook(integration, topic, webhookData as ShopifyCustomer)
          break

        case 'app/uninstalled':
          await processAppUninstalled(integration)
          break

        default:
          console.log(`Unhandled webhook topic: ${topic}`)
          // Still record it for monitoring
          await createWebhookEvent(
            integration.id,
            topic,
            externalId,
            'received',
            undefined,
            { note: 'Unhandled topic, webhook received but not processed' }
          )
          break
      }

      // Record successful processing
      await createWebhookEvent(
        integration.id,
        topic,
        externalId,
        'processed',
        undefined,
        { processedFields: Object.keys(webhookData) }
      )

      // Update integration last sync time
      await prisma.integration.update({
        where: {
          id: integration.id
        },
        data: {
          lastSyncAt: new Date()
        }
      })

      return NextResponse.json({ success: true, topic, externalId })

    } catch (processingError) {
      console.error(`Error processing webhook ${topic}:`, processingError)
      
      // Record the processing error
      await createWebhookEvent(
        integration.id,
        topic,
        externalId,
        'failed',
        processingError instanceof Error ? processingError.message : 'Unknown processing error',
        { webhookData: Object.keys(webhookData) }
      )

      return NextResponse.json(
        { error: 'Processing failed', topic, externalId },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// GET endpoint for webhook verification (Shopify sometimes sends GET requests)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('hub.challenge')
  
  if (challenge) {
    return new NextResponse(challenge, { status: 200 })
  }
  
  return NextResponse.json({ message: 'Shopify webhook endpoint' })
}