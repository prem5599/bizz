// src/app/api/integrations/shopify/private-app/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ShopifyIntegration } from '@/lib/integrations/shopify'

export const dynamic = 'force-dynamic'

// Shopify API version 2024-10 - matches OAuth implementation
const SHOPIFY_API_VERSION = '2024-10'

// Required scopes for full functionality - matches OAuth implementation
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
    eligible_for_payments: boolean
    has_storefront: boolean
    multi_location_enabled: boolean
    checkout_api_supported: boolean
    cookie_consent_level: string
  }
}

interface ShopifyAccessScopesResponse {
  access_scopes: Array<{
    handle: string
  }>
}

/**
 * Validate shop domain using same logic as OAuth route
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
 * Validate private app access token format
 */
function validateAccessToken(token: string): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Access token is required' }
  }

  const trimmedToken = token.trim()

  if (!trimmedToken.startsWith('shpat_')) {
    return { 
      isValid: false, 
      error: 'Invalid access token format. Private app tokens must start with "shpat_"' 
    }
  }

  if (trimmedToken.length < 20) {
    return { 
      isValid: false, 
      error: 'Access token appears to be incomplete. Please check your token.' 
    }
  }

  // Check for common token format issues
  if (trimmedToken.includes(' ') || trimmedToken.includes('\n') || trimmedToken.includes('\t')) {
    return { 
      isValid: false, 
      error: 'Access token contains invalid characters. Please copy the token carefully.' 
    }
  }

  return { isValid: true }
}

/**
 * Make authenticated Shopify API request with retry logic
 */
async function makeShopifyRequest(
  shop: string, 
  accessToken: string, 
  endpoint: string,
  options: RequestInit = {},
  retries: number = 3
): Promise<Response> {
  const url = `https://${shop}.myshopify.com/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json',
          'User-Agent': 'BizInsights Analytics Platform',
          ...options.headers
        }
      })

      // Handle rate limiting with exponential backoff
      if (response.status === 429) {
        const callLimit = response.headers.get('X-Shopify-Shop-Api-Call-Limit')
        console.log(`Rate limited. Call limit: ${callLimit}. Attempt ${attempt}/${retries}`)
        
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
      }

      return response
    } catch (error) {
      if (attempt === retries) throw error
      
      // Network error - retry with backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000))
    }
  }

  throw new Error('Max retries exceeded')
}

/**
 * Test shop connection and fetch basic info
 */
async function testShopConnection(shop: string, accessToken: string): Promise<{
  success: boolean
  shopInfo?: ShopifyShopResponse['shop']
  error?: string
  statusCode?: number
}> {
  try {
    const response = await makeShopifyRequest(shop, accessToken, 'shop.json')

    if (!response.ok) {
      const errorData = await response.json().catch(() => null)
      const errorMessage = errorData?.errors || await response.text().catch(() => 'Unknown error')
      
      let friendlyError: string
      switch (response.status) {
        case 401:
          friendlyError = 'Invalid access token. Please check your private app token and try again.'
          break
        case 403:
          friendlyError = 'Access token does not have sufficient permissions. Please check your private app settings.'
          break
        case 404:
          friendlyError = 'Shop not found. Please verify your shop domain is correct.'
          break
        case 423:
          friendlyError = 'Shop is locked or suspended.'
          break
        default:
          friendlyError = `Connection failed: ${response.status} - ${errorMessage}`
      }

      return {
        success: false,
        error: friendlyError,
        statusCode: response.status
      }
    }

    const shopData: ShopifyShopResponse = await response.json()
    
    if (!shopData.shop) {
      return {
        success: false,
        error: 'Invalid response from Shopify API'
      }
    }

    return {
      success: true,
      shopInfo: shopData.shop
    }
  } catch (error) {
    console.error('Shop connection test error:', error)
    return {
      success: false,
      error: 'Network error: Unable to connect to Shopify. Please check your internet connection and try again.'
    }
  }
}

/**
 * Fetch and validate available scopes
 */
async function validateShopScopes(shop: string, accessToken: string): Promise<{
  success: boolean
  availableScopes?: string[]
  missingScopes?: string[]
  error?: string
}> {
  try {
    const response = await makeShopifyRequest(shop, accessToken, 'access_scopes.json')

    if (!response.ok) {
      return {
        success: false,
        error: `Unable to fetch access scopes: ${response.status}`
      }
    }

    const scopesData: ShopifyAccessScopesResponse = await response.json()
    const availableScopes = scopesData.access_scopes?.map(scope => scope.handle) || []
    const missingScopes = REQUIRED_SCOPES.filter(scope => !availableScopes.includes(scope))

    return {
      success: true,
      availableScopes,
      missingScopes
    }
  } catch (error) {
    console.error('Scope validation error:', error)
    return {
      success: false,
      error: 'Unable to validate access scopes'
    }
  }
}

/**
 * Test key API endpoints to ensure permissions
 */
async function testApiEndpoints(shop: string, accessToken: string): Promise<{
  success: boolean
  endpointResults?: { [key: string]: boolean }
  error?: string
}> {
  const testEndpoints = [
    { name: 'orders', endpoint: 'orders.json?limit=1' },
    { name: 'customers', endpoint: 'customers.json?limit=1' },
    { name: 'products', endpoint: 'products.json?limit=1' }
  ]

  const results: { [key: string]: boolean } = {}

  try {
    const testPromises = testEndpoints.map(async ({ name, endpoint }) => {
      try {
        const response = await makeShopifyRequest(shop, accessToken, endpoint)
        results[name] = response.ok
        return { name, success: response.ok, status: response.status }
      } catch (error) {
        results[name] = false
        return { name, success: false, error }
      }
    })

    await Promise.all(testPromises)

    const allSuccessful = Object.values(results).every(success => success)

    return {
      success: allSuccessful,
      endpointResults: results
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to test API endpoints'
    }
  }
}

/**
 * Initialize data sync in background
 */
async function initializeDataSync(integrationId: string, shopDomain: string, accessToken: string): Promise<void> {
  try {
    console.log(`🔄 Starting background data sync for integration ${integrationId}`)
    
    // Initialize Shopify client
    const shopify = new ShopifyIntegration(accessToken, shopDomain)
    
    // Start historical data sync (30 days) in background
    setImmediate(async () => {
      try {
        const syncResult = await shopify.syncHistoricalData(integrationId, 30)
        console.log(`✅ Historical data sync completed for integration ${integrationId}:`, syncResult)
        
        // Update integration with sync results
        await prisma.integration.update({
          where: { id: integrationId },
          data: { 
            lastSyncAt: new Date(),
            metadata: {
              update: {
                lastSyncResult: syncResult,
                lastSyncAt: new Date().toISOString()
              }
            }
          }
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
 * Setup webhooks for real-time updates
 */
async function setupWebhooks(integrationId: string, shopDomain: string, accessToken: string): Promise<string[]> {
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
 * POST /api/integrations/shopify/private-app
 * Connect Shopify store using Private App credentials
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    console.log('🚀 Shopify Private App 2024-10 connection initiated')
    
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
    const { shopDomain, accessToken, organizationId } = body
    
    console.log('📋 Request data received:', {
      shopDomain: shopDomain ? `${shopDomain.substring(0, 10)}...` : 'missing',
      accessToken: accessToken ? 'provided' : 'missing',
      organizationId: organizationId || 'missing'
    })

    // Validate required fields
    if (!shopDomain || !accessToken || !organizationId) {
      const missing = []
      if (!shopDomain) missing.push('shopDomain')
      if (!accessToken) missing.push('accessToken')
      if (!organizationId) missing.push('organizationId')
      
      return NextResponse.json({
        error: 'Missing required fields',
        code: 'MISSING_PARAMETERS',
        details: {
          missing,
          required: ['shopDomain', 'accessToken', 'organizationId']
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
            slug: true,
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

    // Validate access token format
    const tokenValidation = validateAccessToken(accessToken)
    if (!tokenValidation.isValid) {
      return NextResponse.json({
        error: tokenValidation.error,
        code: 'INVALID_TOKEN_FORMAT'
      }, { status: 400 })
    }

    console.log('✅ Access token format validated')

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
      console.log('❌ Integration already exists:', existingIntegration.id)
      return NextResponse.json({
        error: 'Shopify integration already exists for this store',
        code: 'INTEGRATION_EXISTS',
        integrationId: existingIntegration.id,
        status: existingIntegration.status,
        suggestion: 'Disconnect the existing integration first if you want to reconnect'
      }, { status: 409 })
    }

    console.log('✅ No existing integration found')

    // Test shop connection
    console.log('🔗 Testing shop connection...')
    const connectionTest = await testShopConnection(cleanShopDomain, accessToken.trim())
    
    if (!connectionTest.success) {
      return NextResponse.json({
        error: connectionTest.error,
        code: 'CONNECTION_FAILED',
        statusCode: connectionTest.statusCode
      }, { status: connectionTest.statusCode || 400 })
    }

    const shopInfo = connectionTest.shopInfo!
    console.log('✅ Shop connection successful:', shopInfo.name)

    // Validate scopes
    console.log('🔍 Validating access scopes...')
    const scopeValidation = await validateShopScopes(cleanShopDomain, accessToken.trim())
    
    if (!scopeValidation.success) {
      console.log('⚠️ Could not validate scopes:', scopeValidation.error)
      // Continue without scope validation - some stores may restrict this endpoint
    } else if (scopeValidation.missingScopes && scopeValidation.missingScopes.length > 0) {
      console.log('⚠️ Missing some scopes:', scopeValidation.missingScopes)
      // Log but don't fail - private apps may have different scope configurations
    }

    // Test key API endpoints
    console.log('🧪 Testing API endpoints...')
    const endpointTest = await testApiEndpoints(cleanShopDomain, accessToken.trim())
    
    if (!endpointTest.success) {
      console.log('⚠️ Some API endpoints failed:', endpointTest.endpointResults)
      // Continue - some endpoints may fail due to scope restrictions but integration can still work
    }

    console.log('✅ API endpoint testing completed')

    // Create integration
    console.log('💾 Creating integration...')
    const integration = await prisma.integration.create({
      data: {
        organizationId: organizationId,
        platform: 'shopify',
        platformAccountId: shopInfo.myshopify_domain,
        accessToken: accessToken.trim(),
        status: 'active',
        lastSyncAt: new Date(),
        metadata: JSON.stringify({
          connectionType: 'private_app',
          apiVersion: SHOPIFY_API_VERSION,
          shopInfo: {
            id: shopInfo.id,
            name: shopInfo.name,
            email: shopInfo.email,
            domain: shopInfo.domain,
            myshopifyDomain: shopInfo.myshopify_domain,
            planName: shopInfo.plan_name,
            planDisplayName: shopInfo.plan_display_name,
            timezone: shopInfo.timezone,
            currency: shopInfo.currency,
            countryCode: shopInfo.country_code,
            countryName: shopInfo.country_name,
            primaryLocale: shopInfo.primary_locale,
            shopOwner: shopInfo.shop_owner,
            createdAt: shopInfo.created_at,
            eligibleForPayments: shopInfo.eligible_for_payments,
            hasStorefront: shopInfo.has_storefront,
            multiLocationEnabled: shopInfo.multi_location_enabled,
            checkoutApiSupported: shopInfo.checkout_api_supported
          },
          availableScopes: scopeValidation.availableScopes || [],
          missingScopes: scopeValidation.missingScopes || [],
          endpointTests: endpointTest.endpointResults || {},
          connectedAt: new Date().toISOString(),
          connectionDuration: Date.now() - startTime,
          userId: session.user.id,
          userEmail: session.user.email
        })
      }
    })

    console.log('✅ Integration created:', integration.id)

    // Setup webhooks in background
    const webhookPromise = setupWebhooks(integration.id, cleanShopDomain, accessToken.trim())

    // Initialize data sync in background (don't wait for it)
    initializeDataSync(integration.id, cleanShopDomain, accessToken.trim())

    // Wait for webhooks to complete (with timeout)
    const webhookResults = await Promise.race([
      webhookPromise,
      new Promise(resolve => setTimeout(() => resolve([]), 5000)) // 5 second timeout
    ])

    console.log(`✅ Shopify Private App integration completed in ${Date.now() - startTime}ms`)

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: 'shopify',
        platformAccountId: integration.platformAccountId,
        status: 'active',
        lastSyncAt: integration.lastSyncAt,
        createdAt: integration.createdAt
      },
      shopInfo: {
        name: shopInfo.name,
        domain: shopInfo.domain,
        myshopifyDomain: shopInfo.myshopify_domain,
        currency: shopInfo.currency,
        timezone: shopInfo.timezone,
        planName: shopInfo.plan_display_name || shopInfo.plan_name,
        country: shopInfo.country_name
      },
      organization: {
        id: organizationId,
        name: userMembership.organization.name,
        slug: userMembership.organization.slug
      },
      metadata: {
        apiVersion: SHOPIFY_API_VERSION,
        availableScopes: scopeValidation.availableScopes?.length || 0,
        missingScopes: scopeValidation.missingScopes?.length || 0,
        webhooksCreated: Array.isArray(webhookResults) ? webhookResults.length : 0,
        connectionDuration: Date.now() - startTime
      },
      message: `Shopify store "${shopInfo.name}" connected successfully via Private App`
    })

  } catch (error) {
    console.error('❌ Shopify Private App error:', error)
    
    // Log detailed error for debugging
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime
    })
    
    return NextResponse.json({
      error: 'Internal server error occurred while connecting Shopify Private App',
      code: 'INTERNAL_ERROR',
      details: process.env.NODE_ENV === 'development' 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Please try again or contact support',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET /api/integrations/shopify/private-app
 * Get private app connection info (for testing/debugging)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
      method: 'POST',
      apiVersion: SHOPIFY_API_VERSION,
      requiredFields: ['shopDomain', 'accessToken', 'organizationId'],
      tokenFormat: 'Private app tokens must start with "shpat_"',
      requiredScopes: REQUIRED_SCOPES,
      supportedFeatures: [
        'Historical data sync (30 days)',
        'Real-time webhooks',
        'Comprehensive shop information',
        'Scope validation',
        'API endpoint testing',
        'Background data processing'
      ]
    })
  } catch (error) {
    console.error('Private app info error:', error)
    return NextResponse.json({
      error: 'Failed to get private app information'
    }, { status: 500 })
  }
}