// src/app/api/integrations/google-analytics/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { GoogleAnalyticsIntegration } from '@/lib/integrations/google-analytics'
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
      console.error('Google Analytics OAuth error:', { error, errorDescription })
      const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'google_analytics_auth_failed')
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
    const tokenData = await GoogleAnalyticsIntegration.exchangeCodeForToken(code)

    // Test the connection and get account info
    const gaIntegration = new GoogleAnalyticsIntegration(tokenData.access_token, tokenData.refresh_token)
    const accountInfo = await gaIntegration.getAccountInfo()

    // Get available GA4 properties
    const properties = await gaIntegration.getProperties()
    
    if (properties.length === 0) {
      console.warn('No GA4 properties found for account')
      const redirectUrl = new URL('/integrations', process.env.NEXTAUTH_URL!)
      redirectUrl.searchParams.set('error', 'no_properties')
      redirectUrl.searchParams.set('message', 'No Google Analytics 4 properties found. Please create a GA4 property first.')
      return NextResponse.redirect(redirectUrl)
    }

    // Use the first property by default (can be changed later in UI)
    const selectedProperty = properties[0]

    // Check if integration already exists for this property
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        organizationId,
        platform: 'google_analytics',
        platformAccountId: selectedProperty.name
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
            accountId: accountInfo.account,
            propertyId: selectedProperty.name,
            propertyDisplayName: selectedProperty.displayName,
            measurementId: selectedProperty.measurementId,
            properties: properties.map(p => ({
              name: p.name,
              displayName: p.displayName,
              measurementId: p.measurementId,
              createTime: p.createTime,
              timeZone: p.timeZone,
              currencyCode: p.currencyCode
            })),
            tokenType: tokenData.token_type,
            scope: tokenData.scope,
            expiresIn: tokenData.expires_in,
            connectedAt: new Date().toISOString(),
            lastVerified: new Date().toISOString()
          })
        }
      })
      console.log('Updated existing Google Analytics integration:', integration.id)
    } else {
      // Create new integration
      integration = await prisma.integration.create({
        data: {
          organizationId,
          platform: 'google_analytics',
          platformAccountId: selectedProperty.name,
          status: 'active',
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          metadata: JSON.stringify({
            accountId: accountInfo.account,
            propertyId: selectedProperty.name,
            propertyDisplayName: selectedProperty.displayName,
            measurementId: selectedProperty.measurementId,
            properties: properties.map(p => ({
              name: p.name,
              displayName: p.displayName,
              measurementId: p.measurementId,
              createTime: p.createTime,
              timeZone: p.timeZone,
              currencyCode: p.currencyCode
            })),
            tokenType: tokenData.token_type,
            scope: tokenData.scope,
            expiresIn: tokenData.expires_in,
            connectedAt: new Date().toISOString(),
            lastVerified: new Date().toISOString()
          })
        }
      })
      console.log('Created new Google Analytics integration:', integration.id)
    }

    // Start initial sync in background
    try {
      await gaIntegration.syncHistoricalData(integration.id, 30)
      console.log('Initial Google Analytics sync completed for integration:', integration.id)
      
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
      console.warn('Initial Google Analytics sync failed:', syncError)
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
    redirectUrl.searchParams.set('success', 'google_analytics_connected')
    redirectUrl.searchParams.set('property', selectedProperty.displayName)
    
    return NextResponse.redirect(redirectUrl)

  } catch (error) {
    console.error('Google Analytics OAuth callback error:', error)
    
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
    if (!process.env.GOOGLE_ANALYTICS_CLIENT_ID || !process.env.GOOGLE_ANALYTICS_CLIENT_SECRET) {
      console.error('Google Analytics OAuth credentials are not configured')
      return NextResponse.json(
        { error: 'Google Analytics integration is not properly configured' },
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

    // Generate Google Analytics OAuth authorization URL
    const authUrl = GoogleAnalyticsIntegration.generateAuthUrl(state)

    return NextResponse.json({
      success: true,
      authUrl,
      message: 'Google Analytics authorization URL generated'
    })

  } catch (error) {
    console.error('Google Analytics OAuth initiation error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to initiate Google Analytics connection',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}