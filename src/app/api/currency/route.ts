// src/app/api/currency/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getExchangeRates, convertCurrencyLive, getCurrencyDisplayInfo } from '@/lib/currency/utils'
import { SUPPORTED_CURRENCIES, getCurrencyOptions } from '@/lib/currency/config'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'rates':
        const baseCurrency = searchParams.get('base') || 'INR'
        const rates = await getExchangeRates(baseCurrency)
        return NextResponse.json({ success: true, rates, baseCurrency })

      case 'currencies':
        const options = getCurrencyOptions()
        return NextResponse.json({ success: true, currencies: options })

      case 'supported':
        return NextResponse.json({ success: true, currencies: SUPPORTED_CURRENCIES })

      case 'info':
        const currencyCode = searchParams.get('code')
        if (!currencyCode) {
          return NextResponse.json({ error: 'Currency code required' }, { status: 400 })
        }
        const info = getCurrencyDisplayInfo(currencyCode)
        return NextResponse.json({ success: true, info })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Currency API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, amount, fromCurrency, toCurrency } = body

    if (action === 'convert') {
      if (!amount || !fromCurrency || !toCurrency) {
        return NextResponse.json(
          { error: 'Amount, fromCurrency, and toCurrency are required' },
          { status: 400 }
        )
      }

      const result = await convertCurrencyLive(
        parseFloat(amount),
        fromCurrency,
        toCurrency
      )

      return NextResponse.json({ success: true, ...result })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Currency conversion error:', error)
    return NextResponse.json(
      { error: 'Conversion failed' },
      { status: 500 }
    )
  }
}