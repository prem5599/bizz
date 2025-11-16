// src/app/api/insights/generate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InsightsEngine, generateInsightsForAllOrganizations } from '@/lib/insights/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { organizationId, timeframe } = body

    let targetOrganizationId = organizationId

    // If no organizationId provided, get the user's first organization
    if (!targetOrganizationId) {
      const userMembership = await prisma.organizationMember.findFirst({
        where: { userId: session.user.id },
        include: { organization: true }
      })

      if (!userMembership) {
        return NextResponse.json(
          { error: 'No organization found. Please create an organization first.' },
          { status: 400 }
        )
      }

      targetOrganizationId = userMembership.organizationId
    }

    // Verify user has access to organization
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId: targetOrganizationId,
        userId: session.user.id
      }
    })

    if (!member) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Check if organization has active integrations
    const activeIntegrations = await prisma.integration.count({
      where: {
        organizationId: targetOrganizationId,
        status: 'active'
      }
    })

    if (activeIntegrations === 0) {
      return NextResponse.json(
        { error: 'No active integrations found. Connect at least one integration to generate insights.' },
        { status: 400 }
      )
    }

    // Set up timeframe
    const defaultTimeframe = {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      end: new Date()
    }

    const analysisTimeframe = timeframe ? {
      start: new Date(timeframe.start),
      end: new Date(timeframe.end)
    } : defaultTimeframe

    // Generate insights
    const engine = new InsightsEngine(targetOrganizationId)
    const insights = await engine.generateInsights(analysisTimeframe)

    // Get organization info for response
    const organization = await prisma.organization.findUnique({
      where: { id: targetOrganizationId },
      select: { name: true }
    })

    return NextResponse.json({
      success: true,
      message: `Generated ${insights.length} insights for ${organization?.name}`,
      insights: insights.slice(0, 10), // Return top 10 insights
      total: insights.length,
      timeframe: analysisTimeframe,
      generatedAt: new Date().toISOString()
    })

  } catch (error) {
    console.error('Generate insights error:', error)
    
    // Ensure we always return a proper error structure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorDetails = {
      error: 'Failed to generate insights',
      message: errorMessage,
      details: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      } : error,
      timestamp: new Date().toISOString()
    }
    
    console.error('Returning error response:', errorDetails)
    
    return NextResponse.json(errorDetails, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

// Special endpoint for system-wide insight generation (for cron jobs)
export async function PUT(req: NextRequest) {
  try {
    // This endpoint should be protected with an API key in production
    const apiKey = req.headers.get('x-api-key')
    if (apiKey !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Starting system-wide insight generation...')
    await generateInsightsForAllOrganizations()

    return NextResponse.json({
      success: true,
      message: 'System-wide insight generation completed',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('System-wide insight generation error:', error)
    return NextResponse.json(
      { error: 'System-wide insight generation failed' },
      { status: 500 }
    )
  }
}