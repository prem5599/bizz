// src/app/api/integrations/shopify/oauth/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Shopify API version 2024-10
const SHOPIFY_API_VERSION = '2024-10'

// Required Shopify OAuth scopes for comprehensive analytics
const REQUIRED_SCOPES = [
  'read_orders',
  'read_customers', 
  'read_products',
  'read_analytics',
  'read_reports',
  'read_inventory',
  'read_fulfillments',
  'read_checkouts'
].join(',')

/**
 * Validate shop domain according to Shopify standards
 */
function validateShopDomain(shopDomain: string): { isValid: boolean; cleanDomain: string; error?: string } {
  if (!shopDomain) {
    return { isValid: false, cleanDomain: '', error: 'Shop domain is required' }
  }

  // Clean and normalize the domain
  let cleanDomain = shopDomain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\.myshopify\.com.*$/, '') // Remove .myshopify.com and any path
    .replace(/\/.*$/, '') // Remove any remaining path
    .replace(/[^a-z0-9\-]/g, '') // Only allow alphanumeric and hyphens

  // Validate domain format
  if (!cleanDomain || cleanDomain.length < 3 || cleanDomain.length > 60) {
    return { 
      isValid: false, 
      cleanDomain: '', 
      error: 'Shop domain must be 3-60 characters and contain only letters, numbers, and hyphens' 
    }
  }

  // Check for valid Shopify domain format
  if (!/^[a-z0-9][a-z0-9\-]*[a-z0-9]$/.test(cleanDomain) && cleanDomain.length > 1) {
    return { 
      isValid: false, 
      cleanDomain: '', 
      error: 'Invalid shop domain format. Must start and end with alphanumeric characters' 
    }
  }

  return { isValid: true, cleanDomain }
}

/**
 * Generate secure OAuth state parameter with HMAC
 */
function generateSecureState(organizationId: string, shopDomain: string): string {
  const timestamp = Date.now().toString()
  const nonce = crypto.randomBytes(16).toString('hex')
  const data = `${organizationId}:${shopDomain}:${timestamp}:${nonce}`
  
  // Create HMAC signature for state validation
  const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex')
  
  return Buffer.from(`${data}:${signature}`).toString('base64url')
}

/**
 * Validate OAuth state parameter
 */
function validateState(state: string, expectedOrgId: string, expectedShop: string): boolean {
  try {
    const decoded = Buffer.from(state, 'base64url').toString()
    const parts = decoded.split(':')
    
    if (parts.length !== 5) return false
    
    const [orgId, shop, timestamp, nonce, signature] = parts
    const data = `${orgId}:${shop}:${timestamp}:${nonce}`
    
    // Verify signature
    const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex')
    
    if (signature !== expectedSignature) return false
    
    // Verify organization and shop match
    if (orgId !== expectedOrgId || shop !== expectedShop) return false
    
    // Verify timestamp (state valid for 1 hour)
    const stateTime = parseInt(timestamp)
    const now = Date.now()
    if (now - stateTime > 3600000) return false // 1 hour expiry
    
    return true
  } catch (error) {
    console.error('State validation error:', error)
    return false
  }
}

/**
 * Check if Shopify OAuth is properly configured
 */
function validateShopifyConfig(): { isValid: boolean; error?: string } {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET
  const appUrl = process.env.NEXTAUTH_URL

  if (!clientId || clientId === 'your_shopify_app_client_id' || clientId.trim() === '') {
    return { 
      isValid: false, 
      error: 'SHOPIFY_CLIENT_ID not configured. Please set up your Shopify app credentials in the environment variables.' 
    }
  }

  if (!clientSecret || clientSecret === 'your_shopify_app_client_secret' || clientSecret.trim() === '') {
    return { 
      isValid: false, 
      error: 'SHOPIFY_CLIENT_SECRET not configured. Please set up your Shopify app credentials in the environment variables.' 
    }
  }

  if (!appUrl) {
    return { 
      isValid: false, 
      error: 'NEXTAUTH_URL not configured. This is required for OAuth callback URL.' 
    }
  }

  // Validate callback URL format
  const callbackUrl = `${appUrl}/api/integrations/shopify/callback`
  try {
    new URL(callbackUrl)
  } catch {
    return { 
      isValid: false, 
      error: 'Invalid NEXTAUTH_URL format. Must be a valid URL (e.g., https://yourdomain.com)' 
    }
  }

  return { isValid: true }
}

/**
 * Test if shop exists and is accessible
 */
async function validateShopExists(shopDomain: string): Promise<{ exists: boolean; error?: string }> {
  try {
    const response = await fetch(`https://${shopDomain}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
      method: 'GET',
      headers: {
        'User-Agent': 'BizInsights Analytics Platform'
      }
    })

    // 401/403 means shop exists but we need auth (expected)
    // 404 means shop doesn't exist
    if (response.status === 404) {
      return { exists: false, error: 'Shop not found. Please check the shop domain and try again.' }
    }

    if (response.status === 423) {
      return { exists: false, error: 'Shop is locked or suspended.' }
    }

    // Any other status code means the shop exists (we expect 401 without auth)
    return { exists: true }
  } catch (error) {
    console.error('Shop validation error:', error)
    return { exists: false, error: 'Unable to verify shop. Please check the domain and try again.' }
  }
}

/**
 * POST /api/integrations/shopify/oauth
 * Initiate Shopify OAuth authorization flow
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Shopify OAuth 2024-10 connection initiated')
    
    // Verify authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log('❌ No valid session found')
      return NextResponse.json({ 
        error: 'Authentication required',
        code: 'UNAUTHORIZED'
      }, { status: 401 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { organizationId, shopDomain } = body
    
    if (!organizationId || !shopDomain) {
      return NextResponse.json({
        error: 'Organization ID and shop domain are required',
        code: 'MISSING_PARAMETERS',
        details: {
          organizationId: !organizationId ? 'Organization ID is required' : null,
          shopDomain: !shopDomain ? 'Shop domain is required' : null
        }
      }, { status: 400 })
    }

    console.log('🔍 Verifying user membership for organization:', organizationId)
    
    // Verify user has access to the organization
    const userMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: organizationId,
        userId: session.user.id
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true
          }
        }
      }
    })

    if (!userMembership) {
      console.log('❌ User not a member of organization')
      return NextResponse.json({
        error: 'Organization not found or access denied',
        code: 'FORBIDDEN'
      }, { status: 403 })
    }

    console.log('✅ User membership verified for:', userMembership.organization.name)

    // Validate and clean shop domain
    const domainValidation = validateShopDomain(shopDomain)
    if (!domainValidation.isValid) {
      return NextResponse.json({
        error: domainValidation.error,
        code: 'INVALID_SHOP_DOMAIN',
        provided: shopDomain
      }, { status: 400 })
    }

    const cleanShopDomain = domainValidation.cleanDomain
    console.log('✅ Domain validation passed:', cleanShopDomain)

    // Validate Shopify configuration
    const configValidation = validateShopifyConfig()
    if (!configValidation.isValid) {
      console.log('❌ Shopify OAuth not configured:', configValidation.error)
      return NextResponse.json({
        error: configValidation.error,
        code: 'OAUTH_NOT_CONFIGURED',
        suggestion: 'Please configure SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in your environment variables, or use the Private App connection method instead.'
      }, { status: 400 })
    }

    // Validate shop exists
    console.log('🔍 Validating shop exists:', cleanShopDomain)
    const shopValidation = await validateShopExists(cleanShopDomain)
    if (!shopValidation.exists) {
      return NextResponse.json({
        error: shopValidation.error || 'Shop validation failed',
        code: 'SHOP_NOT_FOUND',
        shopDomain: cleanShopDomain
      }, { status: 404 })
    }

    console.log('✅ Shop validation passed')

    // Check if integration already exists and is active
    console.log('🔍 Checking for existing integration...')
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        organizationId: organizationId,
        platform: 'shopify',
        platformAccountId: cleanShopDomain,
        status: { in: ['active', 'pending'] }
      }
    })

    if (existingIntegration) {
      console.log('❌ Active integration already exists:', existingIntegration.id)
      return NextResponse.json({
        error: 'Shopify integration already exists for this store',
        code: 'INTEGRATION_EXISTS',
        integrationId: existingIntegration.id,
        status: existingIntegration.status,
        suggestion: existingIntegration.status === 'pending' 
          ? 'Complete the existing authorization process or disconnect and try again'
          : 'Disconnect the existing integration first if you want to reconnect'
      }, { status: 409 })
    }

    console.log('✅ No existing active integration found')

    // Generate secure OAuth state
    const state = generateSecureState(organizationId, cleanShopDomain)
    
    // Create pending integration record
    const integration = await prisma.integration.create({
      data: {
        organizationId: organizationId,
        platform: 'shopify',
        platformAccountId: cleanShopDomain,
        accessToken: null,
        status: 'pending',
        lastSyncAt: null,
        metadata: JSON.stringify({
          oauthState: state,
          pendingOAuth: true,
          apiVersion: SHOPIFY_API_VERSION,
          requestedScopes: REQUIRED_SCOPES,
          createdAt: new Date().toISOString(),
          userId: session.user.id,
          userEmail: session.user.email
        })
      }
    })

    console.log('✅ Pending integration created:', integration.id)

    // Generate OAuth authorization URL
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/integrations/shopify/callback`
    const authUrl = `https://${cleanShopDomain}.myshopify.com/admin/oauth/authorize?` +
      new URLSearchParams({
        client_id: process.env.SHOPIFY_CLIENT_ID!,
        scope: REQUIRED_SCOPES,
        redirect_uri: callbackUrl,
        state: state,
        'grant_options[]': 'per-user'
      }).toString()

    console.log('🔗 OAuth URL generated for shop:', cleanShopDomain)
    
    return NextResponse.json({
      success: true,
      redirectUrl: authUrl,
      integrationId: integration.id,
      shopDomain: cleanShopDomain,
      message: 'Redirecting to Shopify for authorization...',
      metadata: {
        apiVersion: SHOPIFY_API_VERSION,
        scopes: REQUIRED_SCOPES.split(','),
        callbackUrl
      }
    })

  } catch (error) {
    console.error('❌ Shopify OAuth error:', error)
    
    // Log detailed error for debugging
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    })
    
    return NextResponse.json({
      error: 'Internal server error occurred while setting up Shopify OAuth',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET /api/integrations/shopify/oauth
 * Get OAuth configuration info (for debugging/status)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const configValidation = validateShopifyConfig()
    
    return NextResponse.json({
      configured: configValidation.isValid,
      error: configValidation.error || null,
      apiVersion: SHOPIFY_API_VERSION,
      requiredScopes: REQUIRED_SCOPES.split(','),
      callbackUrl: process.env.NEXTAUTH_URL ? 
        `${process.env.NEXTAUTH_URL}/api/integrations/shopify/callback` : null,
      hasClientId: !!process.env.SHOPIFY_CLIENT_ID && 
        process.env.SHOPIFY_CLIENT_ID !== 'your_shopify_app_client_id',
      hasClientSecret: !!process.env.SHOPIFY_CLIENT_SECRET && 
        process.env.SHOPIFY_CLIENT_SECRET !== 'your_shopify_app_client_secret'
    })
  } catch (error) {
    console.error('OAuth config check error:', error)
    return NextResponse.json({
      error: 'Failed to check OAuth configuration'
    }, { status: 500 })
  }
}