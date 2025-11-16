// src/app/api/user/preferences/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization to check for currency settings
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id
      },
      include: {
        organization: true
      }
    })

    // Default preferences
    let preferences = {
      currency: 'INR',
      timezone: 'Asia/Kolkata',
      locale: 'en-IN',
      dateFormat: 'DD/MM/YYYY',
      numberFormat: 'indian'
    }

    // If user has an organization, we could store preferences there
    // For now, we'll use localStorage on client side and return defaults
    
    return NextResponse.json(preferences)

  } catch (error) {
    console.error('User preferences GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { currency, timezone, locale, dateFormat, numberFormat } = body

    // Validate currency
    const validCurrencies = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'SGD']
    if (currency && !validCurrencies.includes(currency)) {
      return NextResponse.json({ error: 'Invalid currency' }, { status: 400 })
    }

    // For now, we'll just return success since we're storing in localStorage
    // In a real app, you might want to store these in the user table or organization settings
    
    // You could extend your user model to include preferences:
    /*
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        preferences: {
          currency,
          timezone,
          locale,
          dateFormat,
          numberFormat
        }
      }
    })
    */

    return NextResponse.json({ 
      success: true, 
      message: 'Preferences updated successfully' 
    })

  } catch (error) {
    console.error('User preferences PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}