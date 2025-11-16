// src/middleware/currency.ts
import { NextRequest, NextResponse } from 'next/server'
import { getExchangeRates } from '@/lib/currency/utils'
import { DEFAULT_CURRENCY } from '@/lib/currency/config'

interface CurrencyContext {
  baseCurrency: string
  userCurrency: string
  exchangeRates: Record<string, number>
  locale: string
}

/**
 * Currency middleware to handle currency context in requests
 */
export async function currencyMiddleware(request: NextRequest) {
  const response = NextResponse.next()
  
  try {
    // Get currency preferences from headers, cookies, or defaults
    const userCurrency = request.cookies.get('user-currency')?.value || 
                        request.headers.get('x-user-currency') || 
                        DEFAULT_CURRENCY
    
    const baseCurrency = DEFAULT_CURRENCY
    const locale = request.cookies.get('user-locale')?.value || 
                   request.headers.get('accept-language')?.split(',')[0] || 
                   'en-IN'

    // For API routes, add currency context to headers
    if (request.nextUrl.pathname.startsWith('/api/')) {
      response.headers.set('x-base-currency', baseCurrency)
      response.headers.set('x-user-currency', userCurrency)
      response.headers.set('x-user-locale', locale)
      
      // Add exchange rates for currency conversion endpoints
      if (request.nextUrl.pathname.includes('/api/integrations/') || 
          request.nextUrl.pathname.includes('/api/analytics/')) {
        try {
          const rates = await getExchangeRates(baseCurrency)
          response.headers.set('x-exchange-rates', JSON.stringify(rates))
        } catch (error) {
          console.warn('Failed to fetch exchange rates in middleware:', error)
        }
      }
    }

    // Set currency cookie if not present
    if (!request.cookies.get('user-currency')) {
      response.cookies.set('user-currency', userCurrency, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: false,
        sameSite: 'lax',
        secure: false
      })
    }

    // Set locale cookie if not present
    if (!request.cookies.get('user-locale')) {
      response.cookies.set('user-locale', locale, {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: false,
        sameSite: 'lax',
        secure: false
      })
    }

    return response

  } catch (error) {
    console.error('Currency middleware error:', error)
    return response
  }
}

/**
 * Extract currency context from request
 */
export function getCurrencyContext(request: NextRequest): CurrencyContext {
  const baseCurrency = request.headers.get('x-base-currency') || DEFAULT_CURRENCY
  const userCurrency = request.headers.get('x-user-currency') || DEFAULT_CURRENCY
  const locale = request.headers.get('x-user-locale') || 'en-IN'
  
  let exchangeRates: Record<string, number> = {}
  try {
    const ratesHeader = request.headers.get('x-exchange-rates')
    if (ratesHeader) {
      exchangeRates = JSON.parse(ratesHeader)
    }
  } catch (error) {
    console.warn('Failed to parse exchange rates from headers')
  }

  return {
    baseCurrency,
    userCurrency,
    exchangeRates,
    locale
  }
}

/**
 * Convert amount using middleware-provided exchange rates
 */
export function convertWithContext(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  context: CurrencyContext
): number {
  if (fromCurrency === toCurrency) return amount

  const fromRate = context.exchangeRates[fromCurrency] || 1
  const toRate = context.exchangeRates[toCurrency] || 1

  // Convert through base currency
  if (fromCurrency === context.baseCurrency) {
    return amount * toRate
  } else if (toCurrency === context.baseCurrency) {
    return amount / fromRate
  } else {
    return (amount / fromRate) * toRate
  }
}