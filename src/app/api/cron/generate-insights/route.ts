// src/app/api/cron/generate-insights/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateInsightsForAllOrganizations, scheduleInsightGeneration } from '@/lib/insights/engine'
import { createDataAnalyzer } from '@/lib/insights/analyzer'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

/**
 * Cron job endpoint for automated insights generation
 * This should be called periodically (e.g., daily) to generate insights for all organizations
 */
export async function POST(request: NextRequest) {
  try {
    // Security check - verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET || process.env.CRON_API_KEY
    
    if (!cronSecret) {
      console.error('CRON_SECRET environment variable not configured')
      return NextResponse.json(
        { error: 'Cron job not properly configured' },
        { status: 500 }
      )
    }

    // Check authorization (either Bearer token or X-API-Key header)
    const apiKey = request.headers.get('x-api-key') || 
                   request.headers.get('x-cron-key') ||
                   (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null)

    if (apiKey !== cronSecret) {
      console.error('Unauthorized cron job request')
      return NextResponse.json(
        { error: 'Unauthorized - Invalid API key' },
        { status: 401 }
      )
    }

    console.log('Starting automated insights generation...')
    const startTime = Date.now()

    // Get execution parameters from request body or use defaults
    const body = await request.json().catch(() => ({}))
    const options = {
      dryRun: body.dryRun || false,
      organizationIds: body.organizationIds || null, // null means all organizations
      skipAdvancedAnalysis: body.skipAdvancedAnalysis || false,
      timeframeDays: body.timeframeDays || 30,
      maxConcurrent: body.maxConcurrent || 5
    }

    const results = {
      success: true,
      totalOrganizations: 0,
      successfulOrganizations: 0,
      failedOrganizations: 0,
      totalInsightsGenerated: 0,
      errors: [] as Array<{ organizationId: string; error: string }>,
      executionTimeMs: 0,
      timestamp: new Date().toISOString()
    }

    if (options.dryRun) {
      console.log('DRY RUN MODE - No insights will be generated')
    }

    // Get organizations to process
    const whereClause = options.organizationIds 
      ? { id: { in: options.organizationIds } }
      : {
          integrations: {
            some: { status: 'active' }
          }
        }

    const organizations = await prisma.organization.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        slug: true,
        updatedAt: true,
        integrations: {
          where: { status: 'active' },
          select: { id: true, platform: true, lastSyncAt: true }
        }
      }
    })

    results.totalOrganizations = organizations.length
    console.log(`Found ${organizations.length} organizations to process`)

    if (options.dryRun) {
      return NextResponse.json({
        ...results,
        message: 'Dry run completed - no insights generated',
        organizations: organizations.map(org => ({
          id: org.id,
          name: org.name,
          activeIntegrations: org.integrations.length
        }))
      })
    }

    // Process organizations in batches to avoid overwhelming the system
    const batchSize = options.maxConcurrent
    const batches = []
    for (let i = 0; i < organizations.length; i += batchSize) {
      batches.push(organizations.slice(i, i + batchSize))
    }

    console.log(`Processing ${batches.length} batches of max ${batchSize} organizations each`)

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex]
      console.log(`Processing batch ${batchIndex + 1}/${batches.length}`)

      // Process batch in parallel
      const batchPromises = batch.map(async (org) => {
        try {
          console.log(`Generating insights for organization: ${org.name} (${org.id})`)

          // Skip organizations with no active integrations
          if (org.integrations.length === 0) {
            console.log(`Skipping ${org.name} - no active integrations`)
            return { success: true, organizationId: org.id, insightsGenerated: 0, skipped: true }
          }

          // Check if organization has recent data
          const hasRecentData = org.integrations.some(integration => {
            const lastSync = integration.lastSyncAt
            if (!lastSync) return false
            
            const daysSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24)
            return daysSinceSync <= 2 // Data within last 2 days
          })

          if (!hasRecentData) {
            console.log(`Skipping ${org.name} - no recent data (last sync > 2 days ago)`)
            return { success: true, organizationId: org.id, insightsGenerated: 0, skipped: true }
          }

          // Generate insights using the main engine
          const timeframe = {
            start: new Date(Date.now() - options.timeframeDays * 24 * 60 * 60 * 1000),
            end: new Date()
          }

          // Use the existing insights engine
          const { InsightsEngine } = await import('@/lib/insights/engine')
          const engine = new InsightsEngine(org.id)
          const insights = await engine.generateInsights(timeframe)

          let advancedInsightsCount = 0

          // Optionally perform advanced analysis
          if (!options.skipAdvancedAnalysis && insights.length > 0) {
            try {
              const analyzer = createDataAnalyzer(org.id)
              
              // Run correlation analysis for key metrics
              const correlationAnalysis = await analyzer.performCorrelationAnalysis(
                ['revenue', 'orders', 'sessions', 'customers'],
                timeframe
              )

              // Generate additional insights from correlations
              if (correlationAnalysis.metrics.length > 0) {
                const strongCorrelations = correlationAnalysis.metrics.filter(
                  m => m.strength === 'strong' || m.strength === 'very_strong'
                )

                for (const correlation of strongCorrelations) {
                  await prisma.insight.create({
                    data: {
                      organizationId: org.id,
                      type: 'correlation',
                      title: `Strong Correlation: ${correlation.metric1} & ${correlation.metric2}`,
                      description: `${correlation.metric1} and ${correlation.metric2} show a ${correlation.strength} correlation (${(correlation.correlation * 100).toFixed(1)}%). Changes in one metric may predict changes in the other.`,
                      impactScore: Math.min(Math.abs(correlation.correlation) * 10, 10),
                      isRead: false,
                      metadata: JSON.stringify({
                        type: 'correlation',
                        metric1: correlation.metric1,
                        metric2: correlation.metric2,
                        correlation: correlation.correlation,
                        strength: correlation.strength,
                        significance: correlation.significance,
                        generatedBy: 'advanced_analyzer',
                        timeframe: options.timeframeDays
                      })
                    }
                  })
                  advancedInsightsCount++
                }
              }

              // Generate forecasts for revenue
              const forecast = await analyzer.generateForecast('revenue', options.timeframeDays, 7)
              if (forecast.confidence > 60 && forecast.forecast.length > 0) {
                const avgForecast = forecast.forecast.reduce((sum, point) => sum + point.value, 0) / forecast.forecast.length
                const lastHistorical = forecast.historical[forecast.historical.length - 1]?.value || 0
                const forecastChange = lastHistorical > 0 ? ((avgForecast - lastHistorical) / lastHistorical) * 100 : 0

                await prisma.insight.create({
                  data: {
                    organizationId: org.id,
                    type: 'forecast',
                    title: `7-Day Revenue Forecast: ${forecastChange > 0 ? 'Growth' : 'Decline'} Expected`,
                    description: `Based on recent trends, revenue is forecasted to ${forecastChange > 0 ? 'increase' : 'decrease'} by ${Math.abs(forecastChange).toFixed(1)}% over the next 7 days. Forecast confidence: ${forecast.confidence.toFixed(1)}%`,
                    impactScore: Math.min(Math.abs(forecastChange) / 10 + (forecast.confidence / 100) * 3, 10),
                    isRead: false,
                    metadata: JSON.stringify({
                      type: 'forecast',
                      forecastDays: 7,
                      confidence: forecast.confidence,
                      method: forecast.method,
                      forecastChange,
                      avgForecastValue: avgForecast,
                      generatedBy: 'advanced_analyzer',
                      insights: forecast.insights
                    })
                  }
                })
                advancedInsightsCount++
              }

            } catch (advancedError) {
              console.warn(`Advanced analysis failed for ${org.name}:`, advancedError)
              // Continue without advanced analysis
            }
          }

          const totalInsightsGenerated = insights.length + advancedInsightsCount

          console.log(`Generated ${totalInsightsGenerated} insights for ${org.name} (${insights.length} standard + ${advancedInsightsCount} advanced)`)
          
          return {
            success: true,
            organizationId: org.id,
            insightsGenerated: totalInsightsGenerated,
            standardInsights: insights.length,
            advancedInsights: advancedInsightsCount
          }

        } catch (error) {
          console.error(`Failed to generate insights for organization ${org.id}:`, error)
          
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push({
            organizationId: org.id,
            error: errorMessage
          })
          
          return {
            success: false,
            organizationId: org.id,
            error: errorMessage
          }
        }
      })

      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises)
      
      // Update results
      batchResults.forEach(result => {
        if (result.success) {
          results.successfulOrganizations++
          if (!result.skipped) {
            results.totalInsightsGenerated += result.insightsGenerated || 0
          }
        } else {
          results.failedOrganizations++
        }
      })

      // Small delay between batches to prevent overwhelming the database
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    results.executionTimeMs = Date.now() - startTime
    
    // Clean up old insights (older than 30 days) to keep database size manageable
    const cleanupResult = await prisma.insight.deleteMany({
      where: {
        createdAt: {
          lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    })

    console.log(`Cleaned up ${cleanupResult.count} old insights`)
    console.log(`Insights generation completed in ${results.executionTimeMs}ms`)
    console.log(`Results: ${results.successfulOrganizations}/${results.totalOrganizations} organizations processed successfully`)
    console.log(`Total insights generated: ${results.totalInsightsGenerated}`)

    if (results.errors.length > 0) {
      console.warn(`Errors occurred for ${results.errors.length} organizations:`, results.errors)
    }

    return NextResponse.json({
      ...results,
      message: `Successfully processed ${results.successfulOrganizations}/${results.totalOrganizations} organizations`,
      cleanedUpInsights: cleanupResult.count,
      averageInsightsPerOrg: results.successfulOrganizations > 0 
        ? (results.totalInsightsGenerated / results.successfulOrganizations).toFixed(1)
        : 0
    })

  } catch (error) {
    console.error('Cron job failed:', error)
    
    return NextResponse.json({
      success: false,
      error: 'Cron job execution failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * Health check endpoint
 */
export async function GET(request: NextRequest) {
  try {
    // Basic health check - verify database connectivity
    const orgCount = await prisma.organization.count({
      where: {
        integrations: {
          some: { status: 'active' }
        }
      }
    })

    const recentInsights = await prisma.insight.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      }
    })

    return NextResponse.json({
      status: 'healthy',
      service: 'insights-cron',
      timestamp: new Date().toISOString(),
      stats: {
        organizationsWithIntegrations: orgCount,
        insightsGeneratedLast24h: recentInsights
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || '1.0.0'
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      service: 'insights-cron',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}