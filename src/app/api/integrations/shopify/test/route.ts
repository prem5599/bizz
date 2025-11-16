// src/app/api/integrations/shopify/test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * Test Shopify connection without creating integration
 * Validates credentials and returns store information
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { domain, accessToken, clientId, method } = body

    console.log('🧪 Testing Shopify connection:', {
      domain: domain ? `${domain.substring(0, 5)}...` : 'NOT_PROVIDED',
      method,
      hasAccessToken: !!accessToken,
      hasClientId: !!clientId
    })

    // Validate required fields
    if (!domain || !method) {
      return NextResponse.json(
        { 
          error: 'Domain and method are required',
          details: 'Please provide both shop domain and authentication method'
        },
        { status: 400 }
      )
    }

    // Clean and validate domain
    let cleanDomain = domain.trim().toLowerCase()
    cleanDomain = cleanDomain.replace(/^https?:\/\//, '')
    cleanDomain = cleanDomain.replace(/^www\./, '')
    cleanDomain = cleanDomain.replace(/\.myshopify\.com\/?$/, '')
    cleanDomain = cleanDomain.replace(/\/.*$/, '')

    if (!cleanDomain || cleanDomain.length === 0) {
      return NextResponse.json(
        { 
          error: 'Invalid shop domain',
          details: 'Please provide a valid Shopify store domain'
        },
        { status: 400 }
      )
    }

    console.log('🧹 Cleaned domain:', cleanDomain)

    // Test connection based on method
    let testResult: any

    if (method === 'private_app') {
      testResult = await testPrivateAppConnection(cleanDomain, accessToken)
    } else if (method === 'oauth') {
      testResult = await testOAuthConfiguration(cleanDomain, clientId)
    } else {
      return NextResponse.json(
        { 
          error: 'Invalid authentication method',
          details: 'Method must be either "private_app" or "oauth"'
        },
        { status: 400 }
      )
    }

    console.log('✅ Connection test successful:', testResult.shopName)

    return NextResponse.json({
      success: true,
      method,
      shopName: testResult.shopName,
      shopId: testResult.shopId,
      domain: cleanDomain,
      plan: testResult.plan,
      country: testResult.country,
      currency: testResult.currency,
      timezone: testResult.timezone,
      email: testResult.email,
      createdAt: testResult.createdAt
    })

  } catch (error) {
    console.error('❌ Shopify connection test failed:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const statusCode = getErrorStatusCode(errorMessage)

    return NextResponse.json(
      { 
        success: false,
        error: errorMessage,
        details: getErrorDetails(errorMessage)
      },
      { status: statusCode }
    )
  }
}

/**
 * Test Private App connection using access token
 */
async function testPrivateAppConnection(domain: string, accessToken: string) {
  console.log('🔑 Testing Private App connection...')

  if (!accessToken || !accessToken.trim()) {
    throw new Error('Access token is required for private app connection')
  }

  const cleanToken = accessToken.trim()
  
  if (!cleanToken.startsWith('shpat_')) {
    throw new Error('Invalid access token format. Private app tokens must start with "shpat_"')
  }

  const apiUrl = `https://${domain}.myshopify.com/admin/api/2023-10/shop.json`
  
  console.log('📡 Making API request to:', apiUrl.replace(domain, '***'))

  const response = await fetch(apiUrl, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': cleanToken,
      'Content-Type': 'application/json',
      'User-Agent': 'BizInsights-Integration/1.0'
    }
  })

  console.log('📊 API Response status:', response.status)

  if (!response.ok) {
    await handleShopifyAPIError(response, 'private_app')
  }

  const data = await response.json()
  
  if (!data.shop) {
    throw new Error('Invalid response format from Shopify API')
  }

  const shop = data.shop

  // Test a few more endpoints to validate permissions
  await testAdditionalEndpoints(domain, cleanToken, 'private_app')

  return {
    shopName: shop.name,
    shopId: shop.id,
    plan: shop.plan_name || shop.plan_display_name,
    country: shop.country_name || shop.country,
    currency: shop.currency,
    timezone: shop.iana_timezone,
    email: shop.email,
    createdAt: shop.created_at,
    domain: shop.domain,
    myshopifyDomain: shop.myshopify_domain
  }
}

/**
 * Test OAuth configuration by checking app availability
 */
async function testOAuthConfiguration(domain: string, clientId: string) {
  console.log('🔗 Testing OAuth configuration...')

  if (!clientId || !clientId.trim()) {
    throw new Error('Client ID is required for OAuth connection')
  }

  const cleanClientId = clientId.trim()

  // Test if the OAuth app exists by making a request to the authorization endpoint
  // This doesn't actually authorize, but validates if the app exists
  const authUrl = `https://${domain}.myshopify.com/admin/oauth/authorize?client_id=${encodeURIComponent(cleanClientId)}&scope=read_products&redirect_uri=https://example.com&state=test`
  
  console.log('🔍 Testing OAuth app existence...')

  const response = await fetch(authUrl, {
    method: 'HEAD',
    redirect: 'manual' // Don't follow redirects
  })

  console.log('📊 OAuth test response status:', response.status)

  // For OAuth apps, we can't test full functionality without going through the flow
  // But we can validate that the store exists and the app is configured
  if (response.status === 302 || response.status === 200) {
    // Redirect or OK means the app exists and store is valid
    
    // Get basic store info using the public API or storefront API
    const storeInfo = await getPublicStoreInfo(domain)
    
    return {
      shopName: storeInfo.name,
      shopId: null, // Not available in public API
      plan: null, // Not available in public API
      country: storeInfo.country,
      currency: storeInfo.currency,
      timezone: null, // Not available in public API
      email: null, // Not available in public API
      createdAt: null, // Not available in public API
      domain: `${domain}.myshopify.com`,
      myshopifyDomain: `${domain}.myshopify.com`
    }
  } else if (response.status === 404) {
    throw new Error(`Store "${domain}" not found. Please check your shop domain.`)
  } else if (response.status === 401 || response.status === 403) {
    throw new Error(`OAuth app with client ID "${cleanClientId}" not found or not authorized for this store.`)
  } else {
    throw new Error(`Failed to validate OAuth configuration. Status: ${response.status}`)
  }
}

/**
 * Get basic store information from public APIs
 */
async function getPublicStoreInfo(domain: string) {
  try {
    // Try to get store info from the shop's public JSON endpoint
    const publicUrl = `https://${domain}.myshopify.com/shop.json`
    
    const response = await fetch(publicUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'BizInsights-Integration/1.0',
        'Accept': 'application/json'
      }
    })

    if (response.ok) {
      const data = await response.json()
      return {
        name: data.shop?.name || `${domain} Store`,
        country: data.shop?.country || null,
        currency: data.shop?.currency || null
      }
    }
  } catch (error) {
    console.log('ℹ️ Could not fetch public store info:', error)
  }

  // Fallback to basic info
  return {
    name: `${domain} Store`,
    country: null,
    currency: null
  }
}

/**
 * Test additional endpoints to validate permissions
 */
async function testAdditionalEndpoints(domain: string, accessToken: string, method: string) {
  console.log('🔍 Testing additional endpoints for permission validation...')

  const endpoints = [
    { path: '/admin/api/2023-10/orders.json?limit=1', name: 'Orders' },
    { path: '/admin/api/2023-10/products.json?limit=1', name: 'Products' },
    { path: '/admin/api/2023-10/customers.json?limit=1', name: 'Customers' }
  ]

  const results = []

  for (const endpoint of endpoints) {
    try {
      const url = `https://${domain}.myshopify.com${endpoint.path}`
      const response = await fetch(url, {
        method: 'GET',
        headers: method === 'private_app' ? {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        } : {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      results.push({
        endpoint: endpoint.name,
        status: response.status,
        accessible: response.ok
      })

      console.log(`📋 ${endpoint.name} endpoint: ${response.status} ${response.ok ? '✅' : '❌'}`)
      
    } catch (error) {
      console.log(`❌ Failed to test ${endpoint.name} endpoint:`, error)
      results.push({
        endpoint: endpoint.name,
        status: 0,
        accessible: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return results
}

/**
 * Handle Shopify API errors with detailed messages
 */
async function handleShopifyAPIError(response: Response, method: string) {
  let errorMessage = 'Connection failed'
  let errorDetails = ''

  try {
    const errorData = await response.text()
    
    switch (response.status) {
      case 401:
        errorMessage = method === 'private_app' 
          ? 'Invalid access token. Please check your private app token.'
          : 'Invalid credentials. Please check your OAuth configuration.'
        errorDetails = 'Authentication failed. Verify your credentials are correct and have not expired.'
        break
        
      case 403:
        errorMessage = 'Access forbidden. Insufficient permissions.'
        errorDetails = 'Your app does not have the required permissions to access this store.'
        break
        
      case 404:
        errorMessage = 'Store not found. Please check your shop domain.'
        errorDetails = 'The specified Shopify store could not be found. Verify the domain is correct.'
        break
        
      case 429:
        errorMessage = 'Rate limit exceeded. Please try again later.'
        errorDetails = 'Too many requests. Wait a moment before testing again.'
        break
        
      case 500:
      case 502:
      case 503:
        errorMessage = 'Shopify server error. Please try again later.'
        errorDetails = 'Shopify is experiencing technical difficulties.'
        break
        
      default:
        errorMessage = `Connection failed with status ${response.status}`
        errorDetails = errorData || 'Unknown error occurred'
    }
  } catch (parseError) {
    errorMessage = `Connection failed with status ${response.status}`
    errorDetails = 'Could not parse error response'
  }

  const error = new Error(errorMessage)
  ;(error as any).details = errorDetails
  ;(error as any).status = response.status
  throw error
}

/**
 * Get appropriate HTTP status code for error
 */
function getErrorStatusCode(errorMessage: string): number {
  if (errorMessage.includes('Authentication') || errorMessage.includes('Invalid access token')) {
    return 401
  }
  if (errorMessage.includes('permissions') || errorMessage.includes('forbidden')) {
    return 403
  }
  if (errorMessage.includes('not found') || errorMessage.includes('Store not found')) {
    return 404
  }
  if (errorMessage.includes('Rate limit')) {
    return 429
  }
  if (errorMessage.includes('required') || errorMessage.includes('Invalid') || errorMessage.includes('format')) {
    return 400
  }
  return 500
}

/**
 * Get detailed error explanation for common issues
 */
function getErrorDetails(errorMessage: string): string {
  if (errorMessage.includes('shpat_')) {
    return 'Private app access tokens must start with "shpat_". Please check your token format.'
  }
  if (errorMessage.includes('Client ID')) {
    return 'OAuth client ID is required. Please check your app configuration in the Partner Dashboard.'
  }
  if (errorMessage.includes('Store not found')) {
    return 'Please verify your shop domain. It should be in the format "your-store" (without .myshopify.com).'
  }
  if (errorMessage.includes('Invalid access token')) {
    return 'Please verify your access token is correct and has not been revoked or expired.'
  }
  if (errorMessage.includes('permissions')) {
    return 'Your app may not have the required API permissions. Check your app configuration in Shopify.'
  }
  if (errorMessage.includes('Rate limit')) {
    return 'Please wait a few minutes before testing again to avoid rate limiting.'
  }
  return 'Please check your configuration and try again. Contact support if the issue persists.'
}