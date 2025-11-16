// src/app/api/integrations/stripe/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Validation schema for connection request
const connectRequestSchema = z.object({
  organizationId: z.string().min(1),
  returnUrl: z.string().url().optional()
})

// Generate a secure state parameter for OAuth
function generateState(): string {
  return crypto.randomBytes(32).toString('hex')
}

// Build Stripe Connect OAuth URL
function buildStripeConnectUrl(clientId: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'read_write',
    redirect_uri: redirectUri,
    state: state,
    'stripe_user[business_type]': 'company',
    'stripe_user[country]': 'US'
  })

  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`
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

    const { organizationId, returnUrl } = validation.data

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

    // Check if Stripe integration already exists for this organization
    const existingIntegration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'stripe'
        }
      }
    })

    if (existingIntegration && existingIntegration.status === 'active') {
      return NextResponse.json(
        { error: 'Stripe integration already exists for this organization' },
        { status: 409 }
      )
    }

    // Get environment variables
    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID
    const clientSecret = process.env.STRIPE_SECRET_KEY

    if (!clientId || !clientSecret) {
      console.error('Missing Stripe Connect OAuth credentials')
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
          platform: 'stripe'
        }
      },
      create: {
        organizationId,
        platform: 'stripe',
        status: 'pending',
        metadata: {
          state,
          connectionInitiatedBy: session.user.id,
          connectionInitiatedAt: new Date().toISOString(),
          returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/${organizationMember.organization.slug}/integrations`,
          connectType: 'express'
        }
      },
      update: {
        status: 'pending',
        metadata: {
          state,
          connectionInitiatedBy: session.user.id,
          connectionInitiatedAt: new Date().toISOString(),
          returnUrl: returnUrl || `${process.env.NEXTAUTH_URL}/${organizationMember.organization.slug}/integrations`,
          connectType: 'express',
          // Preserve any existing metadata
          ...(existingIntegration?.metadata as any || {})
        },
        updatedAt: new Date()
      }
    })

    // Build the redirect URI
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/integrations/stripe/callback`

    // Build Stripe Connect OAuth URL
    const authUrl = buildStripeConnectUrl(
      clientId,
      state,
      redirectUri
    )

    return NextResponse.json({
      success: true,
      authUrl,
      integration: {
        id: connectionAttempt.id,
        platform: connectionAttempt.platform,
        status: connectionAttempt.status,
        connectType: 'express'
      },
      message: 'Redirecting to Stripe Connect for authorization...'
    })

  } catch (error) {
    console.error('Stripe connect API error:', error)
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

    // Get existing Stripe integration
    const integration = await prisma.integration.findUnique({
      where: {
        organizationId_platform: {
          organizationId,
          platform: 'stripe'
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
          connectType: (integration.metadata as any)?.connectType,
          stripeAccountId: (integration.metadata as any)?.stripeAccountId
        }
      }
    })

  } catch (error) {
    console.error('Stripe connection status API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}




    