// src/app/api/integrations/stripe/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StripeIntegration } from '@/lib/integrations/stripe'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
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

    // Find the pending integration by state
    const integration = await prisma.integration.findFirst({
      where: {
        platform: 'stripe',
        status: 'pending',
        metadata: {
          path: ['state'],
          equals: state
        }
      },
      include: {
        organization: true
      }
    })

    if (!integration) {
      console.error('No pending integration found for state:', state)
      const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'invalid_state')
      redirectUrl.searchParams.set('message', 'Invalid or expired authorization state')
      return NextResponse.redirect(redirectUrl)
    }

    // Verify session
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      const redirectUrl = new URL('/auth/signin', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('callbackUrl', `/${integration.organization.slug}/integrations`)
      return NextResponse.redirect(redirectUrl)
    }

    // Verify user has admin access to this organization
    const organizationMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId: integration.organizationId,
        userId: session.user.id,
        role: {
          in: ['owner', 'admin']
        }
      }
    })

    if (!organizationMember) {
      console.error('User does not have admin access to organization:', { userId: session.user.id, organizationId: integration.organizationId })
      const redirectUrl = new URL(`/${integration.organization.slug}/integrations`, process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'access_denied')
      redirectUrl.searchParams.set('message', 'Admin access required')
      return NextResponse.redirect(redirectUrl)
    }

    try {
      // Exchange authorization code for access token
      const tokenData = await StripeIntegration.exchangeCodeForToken(code)

      // Test the connection and get account info
      const stripeIntegration = new StripeIntegration(tokenData.access_token)
      const accountInfo = await stripeIntegration.getAccountInfo()

      // Update the integration with token data and account info
      const updatedIntegration = await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: 'active',
          platformAccountId: tokenData.stripe_user_id,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          lastSyncAt: new Date(),
          metadata: {
            ...integration.metadata,
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
          }
        }
      })

      // Setup webhooks
      try {
        const webhookUrls = await stripeIntegration.setupWebhooks(integration.organizationId)
        console.log('Stripe webhooks configured:', webhookUrls)
        
        // Update integration with webhook info
        await prisma.integration.update({
          where: { id: updatedIntegration.id },
          data: {
            metadata: {
              ...updatedIntegration.metadata,
              webhooks: webhookUrls,
              webhooksConfigured: true,
              webhooksConfiguredAt: new Date().toISOString()
            }
          }
        })
      } catch (webhookError) {
        console.warn('Failed to setup Stripe webhooks:', webhookError)
        // Don't fail the entire integration for webhook setup issues
        await prisma.integration.update({
          where: { id: updatedIntegration.id },
          data: {
            metadata: {
              ...updatedIntegration.metadata,
              webhooksConfigured: false,
              webhookError: webhookError instanceof Error ? webhookError.message : 'Unknown error'
            }
          }
        })
      }

      // Start initial sync in background
      stripeIntegration.syncHistoricalData(updatedIntegration.id, 30)
        .then(() => {
          console.log('Initial Stripe sync completed for integration:', updatedIntegration.id)
          return prisma.integration.update({
            where: { id: updatedIntegration.id },
            data: {
              lastSyncAt: new Date(),
              metadata: {
                ...updatedIntegration.metadata,
                initialSyncCompleted: true,
                initialSyncCompletedAt: new Date().toISOString()
              }
            }
          })
        })
        .catch((syncError) => {
          console.warn('Initial Stripe sync failed:', syncError)
          return prisma.integration.update({
            where: { id: updatedIntegration.id },
            data: {
              metadata: {
                ...updatedIntegration.metadata,
                initialSyncCompleted: false,
                initialSyncError: syncError instanceof Error ? syncError.message : 'Unknown error'
              }
            }
          })
        })

      // Get return URL from metadata or use default
      const metadata = integration.metadata as any
      const returnUrl = metadata?.returnUrl || `${process.env.NEXTAUTH_URL}/${integration.organization.slug}/integrations`
      
      // Redirect back to integrations page with success
      const redirectUrl = new URL(returnUrl)
      redirectUrl.searchParams.set('success', 'stripe_connected')
      redirectUrl.searchParams.set('account', accountInfo.business_profile?.name || accountInfo.email || 'Stripe Account')
      
      return NextResponse.redirect(redirectUrl)

    } catch (tokenError) {
      console.error('Token exchange error:', tokenError)
      
      // Update integration status to failed
      await prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: 'error',
          metadata: {
            ...integration.metadata,
            error: tokenError instanceof Error ? tokenError.message : 'Token exchange failed',
            errorAt: new Date().toISOString()
          }
        }
      })

      const metadata = integration.metadata as any
      const returnUrl = metadata?.returnUrl || `${process.env.NEXTAUTH_URL}/${integration.organization.slug}/integrations`
      const redirectUrl = new URL(returnUrl)
      redirectUrl.searchParams.set('error', 'connection_failed')
      redirectUrl.searchParams.set('message', 'Failed to complete Stripe connection')
      
      return NextResponse.redirect(redirectUrl)
    }

  } catch (error) {
    console.error('Stripe OAuth callback error:', error)
    
    const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
    redirectUrl.searchParams.set('error', 'connection_failed')
    redirectUrl.searchParams.set('message', error instanceof Error ? error.message : 'Connection failed')
    
    return NextResponse.redirect(redirectUrl)
  }
}