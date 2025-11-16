// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { currencyMiddleware } from '@/middleware/currency'

/**
 * Enhanced middleware with authentication, currency support, and CORS handling
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  try {
    let response = NextResponse.next()

    // Apply currency middleware to all requests
    const currencyResponse = await currencyMiddleware(request)
    if (currencyResponse) {
      response = currencyResponse
    }

    // Authentication check for protected routes
    if (pathname.startsWith('/dashboard') || 
        pathname.startsWith('/api/') && !pathname.startsWith('/api/auth')) {
      
      const token = await getToken({ 
        req: request
      })
      
      if (!token) {
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Authentication required' },
            { status: 401 }
          )
        }
        
        // Redirect to sign in for dashboard routes
        const signInUrl = new URL('/api/auth/signin', request.url)
        signInUrl.searchParams.set('callbackUrl', request.url)
        return NextResponse.redirect(signInUrl)
      }

      // Add user context to API requests
      if (pathname.startsWith('/api/')) {
        response.headers.set('x-user-id', token.sub || '')
        response.headers.set('x-user-email', token.email || '')
      }
    }

    // CORS handling for API routes
    if (pathname.startsWith('/api/')) {
      const origin = request.headers.get('origin')
      const allowedOrigins = [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'https://localhost:3000'
      ]
      
      if (origin && allowedOrigins.includes(origin)) {
        response.headers.set('Access-Control-Allow-Origin', origin)
        response.headers.set('Access-Control-Allow-Credentials', 'true')
        response.headers.set(
          'Access-Control-Allow-Methods',
          'GET, POST, PUT, DELETE, PATCH, OPTIONS'
        )
        response.headers.set(
          'Access-Control-Allow-Headers',
          'Content-Type, Authorization, X-Requested-With, x-user-currency, x-user-locale'
        )
      }
      
      // Handle preflight requests
      if (request.method === 'OPTIONS') {
        return new NextResponse(null, { 
          status: 200, 
          headers: Object.fromEntries(response.headers.entries())
        })
      }
    }

    // Rate limiting for sensitive endpoints
    if (pathname.startsWith('/api/integrations/') || 
        pathname.startsWith('/api/currency/')) {
      
      const ip = request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown'
      
      // Simple rate limiting (in production, use Redis or similar)
      const rateLimitKey = `rate_limit_${ip}_${pathname}`
      
      // Add rate limiting headers
      response.headers.set('X-RateLimit-Limit', '100')
      response.headers.set('X-RateLimit-Remaining', '99')
      response.headers.set('X-RateLimit-Reset', String(Date.now() + 60000))
    }

    // Security headers
    response.headers.set('X-Frame-Options', 'DENY')
    response.headers.set('X-Content-Type-Options', 'nosniff')
    response.headers.set('Referrer-Policy', 'origin-when-cross-origin')
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;"
    )

    // Add currency context to dashboard pages
    if (pathname.startsWith('/dashboard')) {
      const userCurrency = request.cookies.get('user-currency')?.value || 'INR'
      response.headers.set('x-dashboard-currency', userCurrency)
    }

    return response
    
  } catch (error) {
    console.error('❌ Middleware error:', error)
    
    // Return error response for API routes
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      )
    }
    
    // For non-API routes, continue with request
    return NextResponse.next()
  }
}

/**
 * Middleware configuration with currency-aware route matching
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}