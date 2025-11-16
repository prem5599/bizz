// src/app/api/integrations/google-analytics/sync/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { GoogleAnalyticsIntegration } from '@/lib/integrations/google-analytics'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { integrationId, days = 30, propertyId } = body

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        platform: 'google_analytics',
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN'] }
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or access denied' },
        { status: 404 }
      )
    }

    if (!integration.accessToken || !integration.refreshToken) {
      return NextResponse.json(
        { error: 'Integration not properly configured' },
        { status: 400 }
      )
    }

    // Start sync
    const ga = new GoogleAnalyticsIntegration(integration.accessToken, integration.refreshToken)
    
    // If propertyId is provided, switch to that property
    if (propertyId) {
      const metadata = JSON.parse(integration.metadata as string)
      const selectedProperty = metadata.properties?.find((p: any) => p.name === propertyId)
      
      if (selectedProperty) {
        // Update integration to use the selected property
        await prisma.integration.update({
          where: { id: integrationId },
          data: {
            platformAccountId: propertyId,
            metadata: JSON.stringify({
              ...metadata,
              propertyId: propertyId,
              propertyDisplayName: selectedProperty.displayName,
              measurementId: selectedProperty.measurementId,
              propertyChanged: true,
              propertyChangedAt: new Date().toISOString()
            })
          }
        })
        console.log(`Switched Google Analytics property to: ${selectedProperty.displayName}`)
      }
    }

    const syncResults = await ga.syncHistoricalData(integrationId, days)

    // Update integration last sync time
    await prisma.integration.update({
      where: { id: integrationId },
      data: {
        lastSyncAt: new Date(),
        metadata: JSON.stringify({
          ...(JSON.parse(integration.metadata as string) || {}),
          lastManualSync: new Date().toISOString(),
          lastSyncResults: syncResults
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Google Analytics sync completed successfully',
      results: syncResults
    })

  } catch (error) {
    console.error('Google Analytics sync error:', error)
    return NextResponse.json(
      { 
        error: 'Sync failed', 
        details: error instanceof Error ? error.message : 'Unknown error',
        type: 'google_analytics_sync_error'
      },
      { status: 500 }
    )
  }
}

// GET endpoint to check sync status and get available properties
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const integrationId = searchParams.get('integrationId')

    if (!integrationId) {
      return NextResponse.json(
        { error: 'Integration ID is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this integration
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        platform: 'google_analytics',
        organization: {
          members: {
            some: {
              userId: session.user.id,
              role: { in: ['OWNER', 'ADMIN', 'MEMBER'] }
            }
          }
        }
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or access denied' },
        { status: 404 }
      )
    }

    const metadata = JSON.parse(integration.metadata as string)
    
    // Get recent data points for this integration
    const recentDataPoints = await prisma.dataPoint.count({
      where: {
        integrationId: integrationId,
        dateRecorded: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
        }
      }
    })

    // Get total data points
    const totalDataPoints = await prisma.dataPoint.count({
      where: { integrationId: integrationId }
    })

    // Check if we can refresh properties (if tokens are available)
    let availableProperties = metadata.properties || []
    if (integration.accessToken && integration.refreshToken) {
      try {
        const ga = new GoogleAnalyticsIntegration(integration.accessToken, integration.refreshToken)
        const refreshedProperties = await ga.getProperties()
        availableProperties = refreshedProperties.map(p => ({
          name: p.name,
          displayName: p.displayName,
          measurementId: p.measurementId,
          createTime: p.createTime,
          timeZone: p.timeZone,
          currencyCode: p.currencyCode
        }))
      } catch (error) {
        console.warn('Failed to refresh Google Analytics properties:', error)
        // Use cached properties from metadata
      }
    }

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: integration.platform,
        status: integration.status,
        lastSyncAt: integration.lastSyncAt,
        propertyId: metadata.propertyId,
        propertyDisplayName: metadata.propertyDisplayName,
        measurementId: metadata.measurementId,
        initialSyncCompleted: metadata.initialSyncCompleted,
        connectedAt: metadata.connectedAt
      },
      properties: availableProperties,
      currentProperty: {
        id: metadata.propertyId,
        displayName: metadata.propertyDisplayName,
        measurementId: metadata.measurementId
      },
      syncStatus: {
        lastSync: integration.lastSyncAt,
        recentDataPoints,
        totalDataPoints,
        initialSyncCompleted: metadata.initialSyncCompleted,
        lastSyncResults: metadata.lastSyncResults,
        lastSyncError: metadata.initialSyncError || metadata.lastSyncError
      }
    })

  } catch (error) {
    console.error('Google Analytics integration status error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to get integration status', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}