// src/app/api/integrations/stripe/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { StripeIntegration } from '@/lib/integrations/stripe'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    // Handle OAuth errors
    if (error) {
      console.error('Stripe OAuth error:', { error, errorDescription })
      const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'stripe_auth_failed')
      redirectUrl.searchParams.set('message', errorDescription || 'Authentication failed')
      return NextResponse.redirect(redirectUrl)
    }

    // Validate required parameters
    if (!code || !state) {
      console.error('Missing required OAuth parameters:', { code: !!code, state: !!state })
      const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'invalid_request')
      redirectUrl.searchParams.set('message', 'Missing authorization code or state')
      return NextResponse.redirect(redirectUrl)
    }

    // Verify session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      const redirectUrl = new URL('/auth/signin', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('callbackUrl', '/integrations')
      return NextResponse.redirect(redirectUrl)
    }

    // Parse state to get organization info
    let organizationId: string
    let orgSlug: string
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      organizationId = stateData.organizationId
      orgSlug = stateData.orgSlug
      
      if (!organizationId || !orgSlug) {
        throw new Error('Missing organization data in state')
      }
    } catch (error) {
      console.error('Invalid state parameter:', error)
      const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'invalid_state')
      redirectUrl.searchParams.set('message', 'Invalid state parameter')
      return NextResponse.redirect(redirectUrl)
    }

    // Verify user has access to the organization
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: session.user.id,
            role: { in: ['ADMIN', 'OWNER'] }
          }
        }
      }
    })

    if (!organization) {
      console.error('User does not have access to organization:', { userId: session.user.id, organizationId })
      const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'access_denied')
      redirectUrl.searchParams.set('message', 'Access denied to organization')
      return NextResponse.redirect(redirectUrl)
    }

    // Exchange authorization code for access token
    const tokenData = await StripeIntegration.exchangeCodeForToken(code)

    // Test the connection
    const stripeIntegration = new StripeIntegration(tokenData.access_token)
    const accountInfo = await stripeIntegration.getAccountInfo()

    // Check if integration already exists
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        organizationId,
        platform: 'stripe',
        platformAccountId: tokenData.stripe_user_id
      }
    })

    let integration
    if (existingIntegration) {
      // Update existing integration
      integration = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          status: 'active',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          metadata: JSON.stringify({
            stripeUserId: tokenData.stripe_user_id,
            publishableKey: tokenData.stripe_publishable_key,
            scope: tokenData.scope,
            accountInfo: {
              id: accountInfo.id,
              businessProfile: accountInfo.business_profile,
              email: accountInfo.email,
              country: accountInfo.country,
              defaultCurrency: accountInfo.default_currency,
              chargesEnabled: accountInfo.charges_enabled,
              payoutsEnabled: accountInfo.payouts_enabled,
              detailsSubmitted: accountInfo.details_submitted
            },
            connectedAt: new Date().toISOString(),
            lastVerified: new Date().toISOString()
          })
        }
      })
      console.log('Updated existing Stripe integration:', integration.id)
    } else {
      // Create new integration
      integration = await prisma.integration.create({
        data: {
          organizationId,
          platform: 'stripe',
          platformAccountId: tokenData.stripe_user_id,
          status: 'active',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          metadata: JSON.stringify({
            stripeUserId: tokenData.stripe_user_id,
            publishableKey: tokenData.stripe_publishable_key,
            scope: tokenData.scope,
            accountInfo: {
              id: accountInfo.id,
              businessProfile: accountInfo.business_profile,
              email: accountInfo.email,
              country: accountInfo.country,
              defaultCurrency: accountInfo.default_currency,
              chargesEnabled: accountInfo.charges_enabled,
              payoutsEnabled: accountInfo.payouts_enabled,
              detailsSubmitted: accountInfo.details_submitted
            },
            connectedAt: new Date().toISOString(),
            lastVerified: new Date().toISOString()
          })
        }
      })
      console.log('Created new Stripe integration:', integration.id)
    }

    // Setup webhooks
    try {
      const webhookUrls = await stripeIntegration.setupWebhooks(organizationId)
      console.log('Stripe webhooks configured:', webhookUrls)
      
      // Update integration with webhook info
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: JSON.stringify({
            ...JSON.parse(integration.metadata as string),
            webhooks: webhookUrls,
            webhooksConfigured: true,
            webhooksConfiguredAt: new Date().toISOString()
          })
        }
      })
    } catch (webhookError) {
      console.warn('Failed to setup Stripe webhooks:', webhookError)
      // Don't fail the entire integration for webhook setup issues
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: JSON.stringify({
            ...JSON.parse(integration.metadata as string),
            webhooksConfigured: false,
            webhookError: webhookError instanceof Error ? webhookError.message : 'Unknown error'
          })
        }
      })
    }

    // Start initial sync in background
    try {
      await stripeIntegration.syncHistoricalData(integration.id, 30)
      console.log('Initial Stripe sync completed for integration:', integration.id)
      
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          lastSyncAt: new Date(),
          metadata: JSON.stringify({
            ...JSON.parse(integration.metadata as string),
            initialSyncCompleted: true,
            initialSyncCompletedAt: new Date().toISOString()
          })
        }
      })
    } catch (syncError) {
      console.warn('Initial Stripe sync failed:', syncError)
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: JSON.stringify({
            ...JSON.parse(integration.metadata as string),
            initialSyncCompleted: false,
            initialSyncError: syncError instanceof Error ? syncError.message : 'Unknown error'
          })
        }
      })
    }

    // Redirect back to integrations page with success
    const redirectUrl = new URL(`/${orgSlug}/integrations`, process.env.NEXTAUTH_URL!)
    redirectUrl.searchParams.set('success', 'stripe_connected')
    redirectUrl.searchParams.set('account', accountInfo.business_profile?.name || accountInfo.email || 'Stripe Account')
    
    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('Stripe OAuth callback error:', error)
    
    const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
    redirectUrl.searchParams.set('error', 'connection_failed')
    redirectUrl.searchParams.set('message', error instanceof Error ? error.message : 'Connection failed')
    
    return NextResponse.redirect(redirectUrl)
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { organizationId } = body

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to the organization
    const organization = await prisma.organization.findFirst({
      where: {
        id: organizationId,
        members: {
          some: {
            userId: session.user.id,
            role: { in: ['ADMIN', 'OWNER'] }
          }
        }
      }
    })

    if (!organization) {
      return NextResponse.json(
        { error: 'Access denied to organization' },
        { status: 403 }
      )
    }

    // Check required environment variables
    if (!process.env.STRIPE_CLIENT_ID) {
      console.error('STRIPE_CLIENT_ID environment variable is not set')
      return NextResponse.json(
        { error: 'Stripe integration is not properly configured' },
        { status: 500 }
      )
    }

    // Generate state parameter with organization info
    const state = Buffer.from(JSON.stringify({
      organizationId,
      orgSlug: organization.slug,
      userId: session.user.id,
      timestamp: Date.now()
    })).toString('base64')

    // Generate Stripe Connect authorization URL
    const authUrl = StripeIntegration.generateConnectUrl(state)

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Stripe authorization URL generated'
    })

  } catch (error) {
    console.error('Stripe OAuth initiation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate Stripe connection',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}