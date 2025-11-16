// src/app/api/integrations/shopify/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import crypto from 'crypto'

// Validation schema for connection request
const connectRequestSchema = z.object({
  organizationId: z.string().min(1),
  shopName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9\-]+$/, 'Invalid shop name format'),
  returnUrl: z.string().url().optional()
})

// Required Shopify scopes - using scopes from your project
const REQUIRED_SCOPES = [
  'read_products',
  'read_orders',
  'read_customers',
  'read_analytics',
  'read_reports',
  'read_inventory',
  'read_financial_data'
]

// Generate a secure state parameter for OAuth
function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Build Shopify OAuth URL
function buildShopifyAuthUrl(shopName: string, clientId: string, redirectUri: string, state: string, scopes: string[]): string {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes.join(','),
    redirect_uri: redirectUri,
    state: state,
    'grant_options[]': 'per-user'
  })

  return `https://${shopName}.myshopify.com/admin/oauth/authorize?${params.toString()}`
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

    const { organizationId, shopName, returnUrl } = validation.data

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

    // Check if Shopify integration already exists for this organization
    const existingIntegration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'shopify'
        }
      }
    })

    if (existingIntegration && existingIntegration.status === 'active') {
      return NextResponse.json(
        { error: 'Shopify integration already exists for this organization' },
        { status: 409 }
      )
    }

    // Get environment variables
    const clientId = process.env.SHOPIFY_CLIENT_ID
    const clientSecret = process.env.SHOPIFY_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      console.error('Missing Shopify OAuth credentials')
      return NextResponse.json(
        { error: 'Integration not configured properly' },
        { status: 500 }
      )
    }

    // Generate state parameter for security
    const state = generateState()

    // Store the connection attempt in database for verification
    const connectionAttempt = await prisma.integration.upsert({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'shopify'
        }
      },
      create: {
        organizationId,
        platform: 'shopify',
        platformAccountId: `${shopName}.myshopify.com`,
        status: 'pending',
        metadata: {
          shopName,
          state,
          connectionInitiatedBy: session.user.id,
          connectionInitiatedAt: new Date().toISOString(),
          returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/${organizationMember.organization.slug}/integrations`,
          scopes: REQUIRED_SCOPES
        }
      },
      update: {
        platformAccountId: `${shopName}.myshopify.com`,
        status: 'pending',
        metadata: {
          shopName,
          state,
          connectionInitiatedBy: session.user.id,
          connectionInitiatedAt: new Date().toISOString(),
          returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/${organizationMember.organization.slug}/integrations`,
          scopes: REQUIRED_SCOPES,
          // Preserve any existing metadata
          ...(existingIntegration?.metadata as any || {})
        },
        updatedAt: new Date()
      }
    })

    // Build the redirect URI
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/shopify/callback`

    // Build Shopify OAuth URL
    const authUrl = buildShopifyAuthUrl(
      shopName,
      clientId,
      redirectUri,
      state,
      REQUIRED_SCOPES
    )

    return NextResponse.json({
      success: true,
      authUrl,
      integration: {
        id: connectionAttempt.id,
        platform: connectionAttempt.platform,
        shopName,
        status: connectionAttempt.status,
        scopes: REQUIRED_SCOPES
      },
      message: 'Redirecting to Shopify for authorization...'
    })

  } catch (error) {
    console.error('Shopify connect API error:', error)
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

    // Get existing Shopify integration
    const integration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'shopify'
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
          shopName: (integration.metadata as any)?.shopName,
          scopes: (integration.metadata as any)?.scopes
        }
      }
    })

  } catch (error) {
    console.error('Shopify connection status API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}