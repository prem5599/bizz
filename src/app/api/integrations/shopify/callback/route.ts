// src/app/api/integrations/shopify/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ShopifyIntegration } from '@/lib/integrations/shopify'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'

// Shopify API version 2024-10 - matches OAuth route
const SHOPIFY_API_VERSION = '2024-10'

// Expected scopes that should be granted - matches OAuth route
const REQUIRED_SCOPES = [
  'read_orders',
  'read_customers', 
  'read_products',
  'read_analytics',
  'read_reports',
  'read_inventory',
  'read_fulfillments',
  'read_checkouts'
]

/**
 * Shopify API Response Types (2024-10)
 */
interface ShopifyTokenResponse {
  access_token: string
  scope: string
  expires_in?: number
  associated_user_scope?: string
  associated_user?: {
    id: number
    first_name: string
    last_name: string
    email: string
    account_owner: boolean
  }
}

interface ShopifyShopResponse {
  shop: {
    id: number
    name: string
    email: string
    domain: string
    myshopify_domain: string
    plan_name: string
    plan_display_name: string
    timezone: string
    iana_timezone: string
    currency: string
    money_format: string
    weight_unit: string
    province_code: string | null
    country_code: string
    country_name: string
    created_at: string
    updated_at: string
    address1: string | null
    address2: string | null
    city: string | null
    zip: string | null
    phone: string | null
    latitude: number | null
    longitude: number | null
    primary_locale: string
    shop_owner: string
    money_with_currency_format: string
    money_in_emails_format: string
    eligible_for_card_reader_giveaway: boolean
    eligible_for_payments: boolean
    google_apps_domain: string | null
    google_apps_login_enabled: boolean | null
    has_discounts: boolean
    has_gift_cards: boolean
    myshopify_domain: string
    password_enabled: boolean
    phone: string | null
    plan_name: string
    pre_launch_enabled: boolean
    requires_extra_payments_agreement: boolean
    setup_required: boolean
    tax_shipping: boolean | null
    taxes_included: boolean | null
    county_taxes: boolean
    checkout_api_supported: boolean
    multi_location_enabled: boolean
    force_ssl: boolean
    has_storefront: boolean
    cookie_consent_level: string
  }
}

/**
 * Validate OAuth state parameter using same logic as OAuth route
 */
function validateState(state: string): { isValid: boolean; organizationId?: string; shopDomain?: string; error?: string } {
  try {
    const decoded = Buffer.from(state, 'base64url').toString()
    const parts = decoded.split(':')
    
    if (parts.length !== 5) {
      return { isValid: false, error: 'Invalid state format' }
    }
    
    const [orgId, shop, timestamp, nonce, signature] = parts
    const data = `${orgId}:${shop}:${timestamp}:${nonce}`
    
    // Verify HMAC signature
    const secret = process.env.NEXTAUTH_SECRET || 'fallback-secret'
    const expectedSignature = crypto.createHmac('sha256', secret).update(data).digest('hex')
    
    if (signature !== expectedSignature) {
      return { isValid: false, error: 'Invalid state signature' }
    }
    
    // Verify timestamp (state valid for 1 hour)
    const stateTime = parseInt(timestamp)
    const now = Date.now()
    if (now - stateTime > 3600000) {
      return { isValid: false, error: 'State expired' }
    }
    
    return { 
      isValid: true, 
      organizationId: orgId, 
      shopDomain: shop 
    }
  } catch (error) {
    console.error('State validation error:', error)
    return { isValid: false, error: 'State validation failed' }
  }
}

/**
 * Verify Shopify HMAC signature for callback parameters
 * Updated for 2024-10 specifications
 */
function verifyShopifyCallbackHmac(queryString: string, hmacFromQuery: string): boolean {
  try {
    const secret = process.env.SHOPIFY_CLIENT_SECRET
    if (!secret) {
      console.error('SHOPIFY_CLIENT_SECRET not configured')
      return false
    }

    // Remove hmac and signature parameters from query string for verification
    const params = new URLSearchParams(queryString)
    params.delete('hmac')
    params.delete('signature')
    
    // Sort parameters alphabetically and create query string
    const sortedParams = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&')

    // Generate HMAC signature
    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(sortedParams, 'utf8')
      .digest('hex')

    // Compare signatures using timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(calculatedHmac, 'hex'),
      Buffer.from(hmacFromQuery, 'hex')
    )
  } catch (error) {
    console.error('HMAC verification error:', error)
    return false
  }
}

/**
 * Exchange authorization code for access token using 2024-10 API
 */
async function exchangeCodeForToken(shop: string, code: string): Promise<ShopifyTokenResponse> {
  const clientId = process.env.SHOPIFY_CLIENT_ID
  const clientSecret = process.env.SHOPIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error('Shopify OAuth credentials not configured')
  }

  const tokenUrl = `https://${shop}.myshopify.com/admin/oauth/access_token`
  
  try {
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BizInsights Analytics Platform',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.error_description || errorData?.error || await response.text()
      
      throw new Error(`Token exchange failed: ${response.status} ${response.statusText} - ${errorMessage}`)
    }

    const tokenData = await response.json()
    
    // Validate response has required fields
    if (!tokenData.access_token || !tokenData.scope) {
      throw new Error('Invalid token response: missing access_token or scope')
    }

    return tokenData
  } catch (error) {
    console.error('Token exchange error:', error)
    throw error
  }
}

/**
 * Fetch shop information using 2024-10 API
 */
async function fetchShopInfo(shop: string, accessToken: string): Promise<ShopifyShopResponse> {
  const shopUrl = `https://${shop}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/shop.json`
  
  try {
    const response = await fetch(shopUrl, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
        'User-Agent': 'BizInsights Analytics Platform'
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.errors || await response.text()
      throw new Error(`Shop info fetch failed: ${response.status} ${response.statusText} - ${errorMessage}`)
    }

    const shopData = await response.json()
    
    if (!shopData.shop) {
      throw new Error('Invalid shop response: missing shop data')
    }

    return shopData
  } catch (error) {
    console.error('Shop info fetch error:', error)
    throw error
  }
}

/**
 * Validate granted scopes match requested scopes
 */
function validateScopes(grantedScopes: string): { isValid: boolean; missing: string[]; granted: string[] } {
  const granted = grantedScopes.split(',').map(s => s.trim()).filter(Boolean)
  const missing = REQUIRED_SCOPES.filter(scope => !granted.includes(scope))
  
  return {
    isValid: missing.length === 0,
    missing,
    granted
  }
}

/**
 * Initialize automatic data sync in background
 */
async function initializeDataSync(integrationId: string, shopDomain: string, accessToken: string): Promise<void> {
  try {
    console.log(`🔄 Starting background data sync for integration ${integrationId}`)
    
    // Initialize Shopify client
    const shopify = new ShopifyIntegration(accessToken, shopDomain)
    
    // Start historical data sync (30 days) in background
    // This will not block the callback response
    setImmediate(async () => {
      try {
        await shopify.syncHistoricalData(integrationId, 30)
        console.log(`✅ Historical data sync completed for integration ${integrationId}`)
        
        // Update last sync time
        await prisma.integration.update({
          where: { id: integrationId },
          data: { lastSyncAt: new Date() }
        })
      } catch (syncError) {
        console.error(`❌ Historical data sync failed for integration ${integrationId}:`, syncError)
        
        // Update integration with sync error but keep it active
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            metadata: {
              update: {
                lastSyncError: {
                  message: syncError instanceof Error ? syncError.message : 'Unknown sync error',
                  timestamp: new Date().toISOString()
                }
              }
            }
          }
        })
      }
    })
    
  } catch (error) {
    console.error('Failed to initialize data sync:', error)
    // Don't throw here - sync failure shouldn't block integration completion
  }
}

/**
 * Setup webhooks for real-time updates using 2024-10 API
 */
async function setupWebhooks(integrationId: string, shopDomain: string, accessToken: string): Promise<any[]> {
  try {
    const shopify = new ShopifyIntegration(accessToken, shopDomain)
    const webhookUrls = await shopify.setupWebhooks(integrationId)
    console.log(`✅ Created ${webhookUrls.length} webhooks for integration ${integrationId}`)
    return webhookUrls
  } catch (error) {
    console.error('Webhook setup failed:', error)
    // Return empty array - webhook failure shouldn't block integration
    return []
  }
}

/**
 * GET /api/integrations/shopify/callback
 * Handle Shopify OAuth callback with 2024-10 API
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🚀 Shopify OAuth 2024-10 callback received')
    
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const shop = searchParams.get('shop')
    const state = searchParams.get('state')
    const hmac = searchParams.get('hmac')
    const timestamp = searchParams.get('timestamp')

    console.log('📥 Callback parameters:', { 
      hasCode: !!code, 
      shop, 
      hasState: !!state, 
      hasHmac: !!hmac,
      timestamp 
    })

    // Validate required parameters
    if (!code || !shop || !state || !hmac) {
      console.log('❌ Missing required callback parameters')
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=missing_parameters&details=${encodeURIComponent('Missing required OAuth callback parameters')}`
      )
    }

    // Validate HMAC signature first (security)
    const queryString = request.url.split('?')[1] || ''
    if (!verifyShopifyCallbackHmac(queryString, hmac)) {
      console.log('❌ Invalid HMAC signature')
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=invalid_signature&details=${encodeURIComponent('OAuth callback signature validation failed')}`
      )
    }

    console.log('✅ HMAC signature verified')

    // Validate and decode state parameter
    const stateValidation = validateState(state)
    if (!stateValidation.isValid) {
      console.log('❌ Invalid state parameter:', stateValidation.error)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=invalid_state&details=${encodeURIComponent(stateValidation.error || 'State validation failed')}`
      )
    }

    const { organizationId, shopDomain } = stateValidation
    console.log('✅ State validated for org:', organizationId, 'shop:', shopDomain)

    // Verify shop domain matches what we expect
    const normalizedShop = shop.replace('.myshopify.com', '')
    if (normalizedShop !== shopDomain) {
      console.log('❌ Shop domain mismatch:', normalizedShop, 'vs', shopDomain)
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=shop_mismatch&details=${encodeURIComponent('Shop domain does not match authorization request')}`
      )
    }

    // Find the pending integration
    const pendingIntegration = await prisma.integration.findFirst({
      where: {
        organizationId: organizationId!,
        platform: 'shopify',
        platformAccountId: shopDomain,
        status: 'pending'
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    if (!pendingIntegration) {
      console.log('❌ No pending integration found')
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=integration_not_found&details=${encodeURIComponent('No pending integration found for this shop')}`
      )
    }

    console.log('✅ Found pending integration:', pendingIntegration.id)

    try {
      // Exchange code for access token
      console.log('🔄 Exchanging authorization code for access token...')
      const tokenResponse = await exchangeCodeForToken(normalizedShop, code)
      console.log('✅ Access token obtained')

      // Validate granted scopes
      const scopeValidation = validateScopes(tokenResponse.scope)
      if (!scopeValidation.isValid) {
        console.log('❌ Insufficient scopes granted:', scopeValidation.missing)
        
        // Update integration with scope error
        await prisma.integration.update({
          where: { id: pendingIntegration.id },
          data: {
            status: 'error',
            metadata: JSON.stringify({
              error: 'insufficient_scopes',
              message: `Missing required scopes: ${scopeValidation.missing.join(', ')}`,
              grantedScopes: scopeValidation.granted,
              requiredScopes: REQUIRED_SCOPES,
              timestamp: new Date().toISOString()
            })
          }
        })

        return NextResponse.redirect(
          `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=insufficient_scopes&details=${encodeURIComponent(`Missing required permissions: ${scopeValidation.missing.join(', ')}`)}`
        )
      }

      console.log('✅ All required scopes granted')

      // Fetch shop information
      console.log('🔄 Fetching shop information...')
      const shopInfo = await fetchShopInfo(normalizedShop, tokenResponse.access_token)
      console.log('✅ Shop info retrieved:', shopInfo.shop.name)

      // Setup webhooks in background
      const webhookPromise = setupWebhooks(pendingIntegration.id, normalizedShop, tokenResponse.access_token)

      // Update integration with success data
      console.log('💾 Updating integration with connection data...')
      const updatedIntegration = await prisma.integration.update({
        where: { id: pendingIntegration.id },
        data: {
          accessToken: tokenResponse.access_token,
          status: 'active',
          platformAccountId: shopInfo.shop.myshopify_domain,
          lastSyncAt: new Date(),
          metadata: JSON.stringify({
            apiVersion: SHOPIFY_API_VERSION,
            grantedScopes: scopeValidation.granted,
            shopInfo: {
              id: shopInfo.shop.id,
              name: shopInfo.shop.name,
              email: shopInfo.shop.email,
              domain: shopInfo.shop.domain,
              myshopifyDomain: shopInfo.shop.myshopify_domain,
              planName: shopInfo.shop.plan_name,
              planDisplayName: shopInfo.shop.plan_display_name,
              timezone: shopInfo.shop.timezone,
              currency: shopInfo.shop.currency,
              countryCode: shopInfo.shop.country_code,
              countryName: shopInfo.shop.country_name,
              primaryLocale: shopInfo.shop.primary_locale,
              shopOwner: shopInfo.shop.shop_owner,
              createdAt: shopInfo.shop.created_at,
              eligibleForPayments: shopInfo.shop.eligible_for_payments,
              hasStorefront: shopInfo.shop.has_storefront,
              multiLocationEnabled: shopInfo.shop.multi_location_enabled,
              checkoutApiSupported: shopInfo.shop.checkout_api_supported
            },
            associatedUser: tokenResponse.associated_user,
            connectedAt: new Date().toISOString(),
            connectionDuration: Date.now() - startTime
          })
        }
      })

      console.log('✅ Integration updated successfully')

      // Wait for webhooks to complete (with timeout)
      const webhookResults = await Promise.race([
        webhookPromise,
        new Promise(resolve => setTimeout(() => resolve([]), 5000)) // 5 second timeout
      ])

      // Initialize data sync in background (don't wait for it)
      initializeDataSync(updatedIntegration.id, normalizedShop, tokenResponse.access_token)

      // Determine redirect URL
      const orgSlug = pendingIntegration.organization.slug
      const successUrl = `${process.env.NEXTAUTH_URL}/${orgSlug}/integrations?success=shopify_connected&shop=${encodeURIComponent(shopInfo.shop.name)}&scopes=${scopeValidation.granted.length}`

      console.log(`✅ Shopify integration completed in ${Date.now() - startTime}ms`)
      
      return NextResponse.redirect(successUrl)

    } catch (exchangeError) {
      console.error('❌ OAuth exchange/setup error:', exchangeError)
      
      // Update integration with specific error
      await prisma.integration.update({
        where: { id: pendingIntegration.id },
        data: {
          status: 'error',
          metadata: JSON.stringify({
            error: 'oauth_exchange_failed',
            message: exchangeError instanceof Error ? exchangeError.message : 'OAuth exchange failed',
            timestamp: new Date().toISOString(),
            duration: Date.now() - startTime
          })
        }
      })

      const orgSlug = pendingIntegration.organization.slug
      const errorUrl = `${process.env.NEXTAUTH_URL}/${orgSlug}/integrations?error=connection_failed&details=${encodeURIComponent(exchangeError instanceof Error ? exchangeError.message : 'Connection failed')}`
      
      return NextResponse.redirect(errorUrl)
    }

  } catch (error) {
    console.error('❌ Shopify callback error:', error)
    
    const errorDetails = error instanceof Error ? error.message : 'Unknown callback error'
    const fallbackUrl = `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=callback_error&details=${encodeURIComponent(errorDetails)}`
    
    return NextResponse.redirect(fallbackUrl)
  }
}

/**
 * POST /api/integrations/shopify/callback
 * Not supported for OAuth callback
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({
    error: 'Method not allowed',
    message: 'POST requests are not supported for OAuth callback. Use GET method.',
    supportedMethods: ['GET']
  }, { status: 405 })
}