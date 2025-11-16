// src/app/api/integrations/shopify/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { ShopifyIntegration } from '@/lib/integrations/shopify'
import { prisma } from '@/lib/prisma'

export async function POST(req: NextRequest) {
  try {
    // Get webhook headers
    const shopDomain = req.headers.get('x-shopify-shop-domain')
    const topic = req.headers.get('x-shopify-topic')
    const hmacHeader = req.headers.get('x-shopify-hmac-sha256')
    
    if (!shopDomain || !topic || !hmacHeader) {
      console.error('Missing required webhook headers:', { shopDomain, topic, hmacHeader })
      return NextResponse.json(
        { error: 'Missing required headers' },
        { status: 400 }
      )
    }

    // Get raw body for signature verification
    const body = await req.text()
    
    // Verify webhook signature
    if (!ShopifyIntegration.validateWebhookSignature(body, hmacHeader)) {
      console.error('Invalid webhook signature from:', shopDomain)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    // Parse webhook data
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

    // Get organization ID from query params (set during webhook creation)
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('org')

    if (!organizationId) {
      console.error('No organization ID in webhook URL')
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      )
    }

    // Find the integration
    const integration = await prisma.integration.findFirst({
      where: {
        organizationId,
        platform: 'shopify',
        platformAccountId: shopDomain.replace('.myshopify.com', ''),
        status: 'active'
      }
    })

    if (!integration) {
      console.error(`No active Shopify integration found for ${shopDomain} in org ${organizationId}`)
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Log webhook receipt
    await logWebhookEvent(integration.id, topic, webhookData.id?.toString() || 'unknown')

    // Process webhook based on topic
    const result = await processWebhookEvent(topic, integration, webhookData)

    if (result.success) {
      // Update integration last activity
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: {
            ...(integration.metadata as any || {}),
            lastWebhookAt: new Date().toISOString(),
            lastWebhookTopic: topic
          }
        }
      })

      return NextResponse.json({
        success: true,
        message: result.message,
        processed: result.processed
      })
    } else {
      return NextResponse.json(
        {
          error: 'Processing failed',
          message: result.message
        },
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * Process different webhook events
 */
async function processWebhookEvent(
  topic: string,
  integration: any,
  webhookData: any
): Promise<{ success: boolean; message: string; processed?: number }> {
  try {
    const shopifyIntegration = new ShopifyIntegration(
      integration.accessToken,
      integration.platformAccountId
    )

    switch (topic) {
      case 'orders/create':
        return await handleOrderCreate(shopifyIntegration, integration, webhookData)
      
      case 'orders/updated':
        return await handleOrderUpdate(shopifyIntegration, integration, webhookData)
      
      case 'orders/paid':
        return await handleOrderPaid(shopifyIntegration, integration, webhookData)
      
      case 'orders/cancelled':
        return await handleOrderCancelled(shopifyIntegration, integration, webhookData)
      
      case 'orders/fulfilled':
        return await handleOrderFulfilled(shopifyIntegration, integration, webhookData)
      
      case 'orders/refunded':
        return await handleOrderRefunded(shopifyIntegration, integration, webhookData)
      
      case 'app/uninstalled':
        return await handleAppUninstalled(integration, webhookData)
      
      default:
        console.log(`Unhandled webhook topic: ${topic}`)
        return {
          success: true,
          message: `Webhook topic ${topic} received but not processed`
        }
    }

  } catch (error) {
    console.error(`Error processing webhook ${topic}:`, error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown processing error'
    }
  }
}

/**
 * Handle new order creation
 */
async function handleOrderCreate(
  shopifyIntegration: ShopifyIntegration,
  integration: any,
  orderData: any
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    // Transform Shopify order to our format
    const order = (shopifyIntegration as any).transformOrder(orderData)
    
    // Process the order (save to database)
    await (shopifyIntegration as any).processOrder(order)

    // Trigger real-time dashboard update
    await triggerDashboardUpdate(integration.organizationId, 'order_created', {
      orderId: order.id,
      revenue: order.totalPrice,
      currency: order.currency
    })

    return {
      success: true,
      message: 'New order processed successfully',
      processed: 1
    }

  } catch (error) {
    console.error('Error handling order create:', error)
    throw error
  }
}

/**
 * Handle order updates
 */
async function handleOrderUpdate(
  shopifyIntegration: ShopifyIntegration,
  integration: any,
  orderData: any
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    const order = (shopifyIntegration as any).transformOrder(orderData)
    
    // Find existing data points for this order
    const existingDataPoints = await prisma.dataPoint.findMany({
      where: {
        integrationId: integration.id,
        metadata: {
          path: ['externalId'],
          equals: order.id
        }
      }
    })

    if (existingDataPoints.length > 0) {
      // Update existing order data
      for (const dataPoint of existingDataPoints) {
        await prisma.dataPoint.update({
          where: { id: dataPoint.id },
          data: {
            value: dataPoint.metricType === 'revenue' ? order.totalPrice : dataPoint.value,
            metadata: {
              ...(dataPoint.metadata as any),
              financialStatus: order.financialStatus,
              fulfillmentStatus: order.fulfillmentStatus,
              updatedAt: new Date().toISOString()
            }
          }
        })
      }

      await triggerDashboardUpdate(integration.organizationId, 'order_updated', {
        orderId: order.id,
        revenue: order.totalPrice
      })

      return {
        success: true,
        message: 'Order updated successfully',
        processed: existingDataPoints.length
      }
    } else {
      // Order doesn't exist, create it
      return await handleOrderCreate(shopifyIntegration, integration, orderData)
    }

  } catch (error) {
    console.error('Error handling order update:', error)
    throw error
  }
}

/**
 * Handle order payment
 */
async function handleOrderPaid(
  shopifyIntegration: ShopifyIntegration,
  integration: any,
  orderData: any
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    const orderId = orderData.id?.toString()
    
    // Update the order's financial status
    await prisma.dataPoint.updateMany({
      where: {
        integrationId: integration.id,
        metadata: {
          path: ['externalId'],
          equals: orderId
        }
      },
      data: {
        metadata: {
          path: ['financialStatus'],
          value: 'paid'
        }
      }
    })

    await triggerDashboardUpdate(integration.organizationId, 'order_paid', {
      orderId,
      revenue: parseFloat(orderData.total_price || '0')
    })

    return {
      success: true,
      message: 'Order payment status updated',
      processed: 1
    }

  } catch (error) {
    console.error('Error handling order paid:', error)
    throw error
  }
}

/**
 * Handle order cancellation
 */
async function handleOrderCancelled(
  shopifyIntegration: ShopifyIntegration,
  integration: any,
  orderData: any
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    await (shopifyIntegration as any).handleOrderCancellation(
      orderData.id?.toString(),
      integration.id
    )

    await triggerDashboardUpdate(integration.organizationId, 'order_cancelled', {
      orderId: orderData.id?.toString(),
      revenue: -parseFloat(orderData.total_price || '0') // Negative revenue for cancelled orders
    })

    return {
      success: true,
      message: 'Order cancellation processed',
      processed: 1
    }

  } catch (error) {
    console.error('Error handling order cancellation:', error)
    throw error
  }
}

/**
 * Handle order fulfillment
 */
async function handleOrderFulfilled(
  shopifyIntegration: ShopifyIntegration,
  integration: any,
  orderData: any
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    const orderId = orderData.id?.toString()
    
    // Update fulfillment status
    await prisma.dataPoint.updateMany({
      where: {
        integrationId: integration.id,
        metadata: {
          path: ['externalId'],
          equals: orderId
        }
      },
      data: {
        metadata: {
          path: ['fulfillmentStatus'],
          value: 'fulfilled'
        }
      }
    })

    return {
      success: true,
      message: 'Order fulfillment status updated',
      processed: 1
    }

  } catch (error) {
    console.error('Error handling order fulfillment:', error)
    throw error
  }
}

/**
 * Handle order refunds
 */
async function handleOrderRefunded(
  shopifyIntegration: ShopifyIntegration,
  integration: any,
  orderData: any
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    const orderId = orderData.id?.toString()
    const refundAmount = parseFloat(orderData.total_price || '0')
    
    // Create a negative revenue data point for the refund
    await prisma.dataPoint.create({
      data: {
        integrationId: integration.id,
        metricType: 'revenue',
        value: -refundAmount,
        metadata: {
          externalId: orderId,
          type: 'refund',
          originalRevenue: refundAmount,
          refundedAt: new Date().toISOString()
        },
        dateRecorded: new Date()
      }
    })

    await triggerDashboardUpdate(integration.organizationId, 'order_refunded', {
      orderId,
      refundAmount
    })

    return {
      success: true,
      message: 'Order refund processed',
      processed: 1
    }

  } catch (error) {
    console.error('Error handling order refund:', error)
    throw error
  }
}

/**
 * Handle app uninstallation
 */
async function handleAppUninstalled(
  integration: any,
  webhookData: any
): Promise<{ success: boolean; message: string; processed: number }> {
  try {
    // Mark integration as disconnected
    await prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: 'disconnected',
        metadata: {
          ...(integration.metadata as any || {}),
          uninstalledAt: new Date().toISOString(),
          uninstallReason: 'app_uninstalled'
        }
      }
    })

    // Notify organization admins about disconnection
    await notifyIntegrationDisconnected(integration.organizationId, 'shopify')

    return {
      success: true,
      message: 'App uninstallation processed',
      processed: 1
    }

  } catch (error) {
    console.error('Error handling app uninstallation:', error)
    throw error
  }
}

/**
 * Log webhook events for debugging and analytics
 */
async function logWebhookEvent(
  integrationId: string,
  topic: string,
  externalId: string
): Promise<void> {
  try {
    await prisma.webhookEvent.create({
      data: {
        integrationId,
        topic,
        externalId,
        status: 'received',
        receivedAt: new Date()
      }
    })
  } catch (error) {
    // Don't fail webhook processing if logging fails
    console.error('Failed to log webhook event:', error)
  }
}

/**
 * Trigger real-time dashboard updates
 */
async function triggerDashboardUpdate(
  organizationId: string,
  eventType: string,
  data: any
): Promise<void> {
  try {
    // This could integrate with WebSocket connections, Server-Sent Events,
    // or a real-time service like Pusher/Ably for live dashboard updates
    
    // For now, we'll just log the event
    console.log(`Dashboard update triggered for org ${organizationId}:`, {
      eventType,
      data,
      timestamp: new Date().toISOString()
    })

    // In a production setup, you might:
    // 1. Send to a WebSocket service
    // 2. Update a Redis cache for real-time data
    // 3. Trigger a Server-Sent Event
    // 4. Call a real-time notification service

  } catch (error) {
    console.error('Failed to trigger dashboard update:', error)
  }
}

/**
 * Notify organization admins about integration disconnection
 */
async function notifyIntegrationDisconnected(
  organizationId: string,
  platform: string
): Promise<void> {
  try {
    // Get organization admins
    const admins = await prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: {
          in: ['owner', 'admin']
        }
      },
      include: {
        user: true
      }
    })

    // In a real implementation, send email notifications
    for (const admin of admins) {
      console.log(`Would notify ${admin.user.email} about ${platform} disconnection`)
      
      // Example: await sendEmail({
      //   to: admin.user.email,
      //   subject: `${platform} integration disconnected`,
      //   template: 'integration-disconnected',
      //   data: { platform, organizationId }
      // })
    }

  } catch (error) {
    console.error('Failed to notify admins:', error)
  }
}

/**
 * Handle webhook verification for GET requests (Shopify webhook verification)
 */
export async function GET(req: NextRequest) {
  // Shopify sometimes sends GET requests to verify webhook endpoints
  const { searchParams } = new URL(req.url)
  const challenge = searchParams.get('challenge')
  
  if (challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    })
  }

  return NextResponse.json({
    message: 'Shopify webhook endpoint',
    status: 'active',
    timestamp: new Date().toISOString()
  })
}