// src/app/api/integrations/google-analytics/properties/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GoogleAnalyticsIntegration } from '@/lib/integrations/google-analytics'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { accessToken } = body

    if (!accessToken) {
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 400 }
      )
    }

    // Get available properties
    const properties = await GoogleAnalyticsIntegration.getAvailableProperties(accessToken)

    return NextResponse.json({
      success: true,
      properties
    })

  } catch (error) {
    console.error('Get GA properties error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch properties' },
      { status: 500 }
    )
  }
}