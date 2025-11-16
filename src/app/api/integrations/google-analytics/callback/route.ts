// src/app/api/integrations/google-analytics/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GoogleAnalyticsIntegration } from '@/lib/integrations/google-analytics'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    const error = searchParams.get('error')

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=missing_code_or_state`
      )
    }

    // Exchange code for tokens
    const tokens = await GoogleAnalyticsIntegration.exchangeCodeForTokens(code)

    // Get available properties
    const properties = await GoogleAnalyticsIntegration.getAvailableProperties(tokens.access_token)

    // Decode state to get organization info
    let organizationId
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
      organizationId = stateData.organizationId
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=invalid_state`
      )
    }

    // Store tokens temporarily and redirect to property selection
    const tempData = Buffer.from(JSON.stringify({
      organizationId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      properties
    })).toString('base64')

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/integrations/google-analytics/setup?data=${tempData}`
    )

  } catch (error) {
    console.error('Google Analytics callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL}/dashboard/integrations?error=callback_failed`
    )
  }
}