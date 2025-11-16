// src/app/api/integrations/google-analytics/connect/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleAnalyticsIntegration } from '@/lib/integrations/google-analytics'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { organizationId, accessToken, refreshToken, propertyId } = body

    if (!organizationId || !accessToken || !refreshToken || !propertyId) {
      return NextResponse.json(
        { error: 'Organization ID, tokens, and property ID are required' },
        { status: 400 }
      )
    }

    // Verify user has admin access to organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Test Google Analytics connection
    const ga = new GoogleAnalyticsIntegration(accessToken, refreshToken, propertyId)
    const isConnected = await ga.testConnection()

    if (!isConnected) {
      return NextResponse.json(
        { error: 'Invalid credentials or connection failed' },
        { status: 400 }
      )
    }

    // Get property info
    const propertyInfo = await ga.getProperty()

    // Check if integration already exists
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        organizationId,
        platform: 'google_analytics'
      }
    })

    let integration
    if (existingIntegration) {
      // Update existing integration
      integration = await prisma.integration.update({
        where: { id: existingIntegration.id },
        data: {
          accessToken,
          refreshToken,
          platformAccountId: propertyId,
          status: 'active',
          lastSyncAt: new Date(),
          tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
          metadata: JSON.stringify({
            propertyId,
            propertyName: propertyInfo.displayName,
            timeZone: propertyInfo.timeZone,
            currencyCode: propertyInfo.currencyCode,
            connectedAt: new Date().toISOString()
          })
        }
      })
    } else {
      // Create new integration
      integration = await prisma.integration.create({
        data: {
          organizationId,
          platform: 'google_analytics',
          platformAccountId: propertyId,
          accessToken,
          refreshToken,
          status: 'active',
          lastSyncAt: new Date(),
          tokenExpiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
          metadata: JSON.stringify({
            propertyId,
            propertyName: propertyInfo.displayName,
            timeZone: propertyInfo.timeZone,
            currencyCode: propertyInfo.currencyCode,
            connectedAt: new Date().toISOString()
          })
        }
      })
    }

    // Start historical data sync in background
    ga.syncHistoricalData(integration.id, 30).catch(error => {
      console.error('Background GA sync failed:', error)
    })

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: 'google_analytics',
        propertyName: propertyInfo.displayName,
        propertyId,
        status: 'active'
      }
    })

  } catch (error) {
    console.error('Google Analytics connect error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}













