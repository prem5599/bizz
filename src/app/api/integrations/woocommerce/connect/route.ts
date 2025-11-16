// src/app/api/integrations/woocommerce/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Validation schema for connection request
const connectRequestSchema = z.object({
  organizationId: z.string().min(1),
  storeUrl: z.string().url('Invalid store URL format'),
  consumerKey: z.string().min(1, 'Consumer key is required'),
  consumerSecret: z.string().min(1, 'Consumer secret is required'),
  returnUrl: z.string().url().optional()
})

// Normalize store URL to ensure consistent format
function normalizeStoreUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // Remove trailing slash and ensure https
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname.replace(/\/$/, '')}`
  } catch (error) {
    throw new Error('Invalid store URL format')
  }
}

// Test WooCommerce connection with provided credentials
async function testWooCommerceConnection(storeUrl: string, consumerKey: string, consumerSecret: string): Promise<{
  success: boolean
  storeInfo?: any
  error?: string
}> {
  try {
    const normalizedUrl = normalizeStoreUrl(storeUrl)
    const apiUrl = `${normalizedUrl}/wp-json/wc/v3/system_status`
    
    // Create Basic Auth header
    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'User-Agent': 'BizInsights Analytics Platform v2.0'
      },
      // Set timeout for connection test
      signal: AbortSignal.timeout(10000)
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      
      switch (response.status) {
        case 401:
          return { success: false, error: 'Invalid consumer key or secret' }
        case 403:
          return { success: false, error: 'Access denied. Please check API permissions.' }
        case 404:
          return { success: false, error: 'WooCommerce REST API not found. Ensure WooCommerce is installed and REST API is enabled.' }
        default:
          return { success: false, error: `Connection failed: ${response.status} ${response.statusText}` }
      }
    }

    const systemStatus = await response.json()
    
    // Get basic store information
    const storeInfoUrl = `${normalizedUrl}/wp-json/wc/v3/settings/general`
    const storeInfoResponse = await fetch(storeInfoUrl, {
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    })

    let storeInfo: any = {}
    if (storeInfoResponse.ok) {
      const settings = await storeInfoResponse.json()
      storeInfo = {
        title: settings.find((s: any) => s.id === 'woocommerce_store_name')?.value || 'WooCommerce Store',
        currency: settings.find((s: any) => s.id === 'woocommerce_currency')?.value || 'USD',
        country: settings.find((s: any) => s.id === 'woocommerce_default_country')?.value?.split(':')[0] || 'US',
        version: systemStatus.environment?.version || 'Unknown'
      }
    }

    return {
      success: true,
      storeInfo: {
        ...storeInfo,
        environment: systemStatus.environment,
        database: systemStatus.database,
        restApiVersion: 'v3'
      }
    }
  } catch (error) {
    console.error('WooCommerce connection test error:', error)
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { success: false, error: 'Connection timeout. Please check your store URL and try again.' }
      }
      return { success: false, error: error.message }
    }
    
    return { success: false, error: 'Failed to connect to WooCommerce store' }
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()

    // Validate request body
    const validation = connectRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validation.error.errors },
        { status: 400 }
      )
    }

    const { organizationId, storeUrl, consumerKey, consumerSecret, returnUrl } = validation.data

    // Verify user has admin access to this organization
    const organizationMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: {
          in: ['owner', 'admin'] // Only admins can connect integrations
        }
      },
      include: {
        organization: true
      }
    })

    if (!organizationMember) {
      return NextResponse.json({ error: 'Access denied - admin role required' }, { status: 403 })
    }

    // Normalize store URL
    const normalizedStoreUrl = normalizeStoreUrl(storeUrl)

    // Check if WooCommerce integration already exists for this organization
    const existingIntegration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'woocommerce'
        }
      }
    })

    if (existingIntegration && existingIntegration.status === 'active') {
      return NextResponse.json(
        { error: 'WooCommerce integration already exists for this organization' },
        { status: 409 }
      )
    }

    // Test the connection with provided credentials
    const connectionTest = await testWooCommerceConnection(normalizedStoreUrl, consumerKey, consumerSecret)

    if (!connectionTest.success) {
      return NextResponse.json(
        { error: connectionTest.error || 'Connection test failed' },
        { status: 400 }
      )
    }

    // Create or update the integration
    const integration = await prisma.integration.upsert({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'woocommerce'
        }
      },
      create: {
        organizationId,
        platform: 'woocommerce',
        platformAccountId: normalizedStoreUrl,
        accessToken: Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'),
        status: 'active',
        lastSyncAt: new Date(),
        metadata: {
          storeUrl: normalizedStoreUrl,
          consumerKey,
          storeInfo: connectionTest.storeInfo,
          connectedAt: new Date().toISOString(),
          connectedBy: session.user.id,
          version: 'v3',
          returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/${organizationMember.organization.slug}/integrations`
        }
      },
      update: {
        platformAccountId: normalizedStoreUrl,
        accessToken: Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64'),
        status: 'active',
        lastSyncAt: new Date(),
        metadata: {
          storeUrl: normalizedStoreUrl,
          consumerKey,
          storeInfo: connectionTest.storeInfo,
          connectedAt: new Date().toISOString(),
          connectedBy: session.user.id,
          version: 'v3',
          returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/${organizationMember.organization.slug}/integrations`,
          // Preserve existing metadata
          ...(existingIntegration?.metadata as any || {})
        },
        updatedAt: new Date()
      }
    })

    // Import and setup WooCommerce client for initial sync
    try {
      const { WooCommerceIntegration } = await import('@/lib/integrations/woocommerce')
      const wooCommerce = new WooCommerceIntegration(normalizedStoreUrl, consumerKey, consumerSecret)

      // Setup webhooks in background
      wooCommerce.setupWebhooks(organizationId).catch(error => {
        console.warn('Failed to setup WooCommerce webhooks:', error)
      })

      // Start historical data sync in background
      wooCommerce.syncHistoricalData(integration.id, 30).catch(error => {
        console.error('Background sync failed:', error)
      })
    } catch (importError) {
      console.warn('WooCommerce integration class not available yet:', importError)
      // Don't fail the connection if the integration class isn't ready
    }

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: integration.platform,
        storeUrl: normalizedStoreUrl,
        storeName: connectionTest.storeInfo?.title || 'WooCommerce Store',
        status: integration.status,
        version: 'v3',
        currency: connectionTest.storeInfo?.currency || 'USD',
        country: connectionTest.storeInfo?.country || 'US'
      },
      message: 'WooCommerce store connected successfully'
    })

  } catch (error) {
    console.error('WooCommerce connect API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check connection status
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 })
    }

    // Verify user has access to this organization
    const organizationMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id
      }
    })

    if (!organizationMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get existing WooCommerce integration
    const integration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'woocommerce'
        }
      },
      include: {
        _count: {
          select: {
            dataPoints: true
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json({
        connected: false,
        integration: null
      })
    }

    const metadata = integration.metadata as any

    return NextResponse.json({
      connected: integration.status === 'active',
      integration: {
        id: integration.id,
        platform: integration.platform,
        platformAccountId: integration.platformAccountId,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt?.toISOString() || null,
        dataPointsCount: integration._count.dataPoints,
        createdAt: integration.createdAt.toISOString(),
        metadata: {
          storeUrl: metadata?.storeUrl,
          storeName: metadata?.storeInfo?.title,
          currency: metadata?.storeInfo?.currency,
          country: metadata?.storeInfo?.country,
          version: metadata?.version,
          connectedAt: metadata?.connectedAt
        }
      }
    })

  } catch (error) {
    console.error('WooCommerce connection status API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}