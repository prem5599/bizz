// src/app/api/user/export/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { exportType, format = 'json' } = body

    // Validate export type
    const validExportTypes = ['profile', 'settings', 'data', 'all']
    if (!validExportTypes.includes(exportType)) {
      return NextResponse.json({ 
        error: 'Invalid export type' 
      }, { status: 400 })
    }

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id
      },
      include: {
        organization: true
      }
    })

    if (!membership?.organization) {
      return NextResponse.json({ 
        error: 'Organization not found' 
      }, { status: 404 })
    }

    let exportData: Record<string, any> = {}

    switch (exportType) {
      case 'profile':
        // Export user profile data
        const userProfile = await prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            timezone: true,
            preferences: true,
            notificationSettings: true,
            createdAt: true,
            updatedAt: true
          }
        })

        exportData = {
          type: 'user_profile',
          exportedAt: new Date().toISOString(),
          data: userProfile
        }
        break

      case 'settings':
        // Export organization settings
        exportData = {
          type: 'organization_settings',
          exportedAt: new Date().toISOString(),
          data: {
            organization: {
              id: membership.organization.id,
              name: membership.organization.name,
              email: membership.organization.email,
              website: membership.organization.website,
              phone: membership.organization.phone,
              address: membership.organization.address,
              timezone: membership.organization.timezone,
              industry: membership.organization.industry,
              companySize: membership.organization.companySize,
              currency: membership.organization.currency,
              settings: membership.organization.settings
            },
            membership: {
              role: membership.role,
              joinedAt: membership.createdAt
            }
          }
        }
        break

      case 'data':
        // Export business data (last 90 days)
        const last90Days = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
        
        const [integrations, dataPoints, insights] = await Promise.all([
          prisma.integration.findMany({
            where: { organizationId: membership.organizationId },
            select: {
              id: true,
              platform: true,
              platformAccountId: true,
              status: true,
              lastSyncAt: true,
              createdAt: true
            }
          }),
          prisma.dataPoint.findMany({
            where: {
              integration: {
                organizationId: membership.organizationId
              },
              dateRecorded: {
                gte: last90Days
              }
            },
            select: {
              id: true,
              metricType: true,
              value: true,
              metadata: true,
              dateRecorded: true,
              integration: {
                select: {
                  platform: true
                }
              }
            },
            take: 10000 // Limit to prevent huge exports
          }),
          prisma.insight.findMany({
            where: {
              organizationId: membership.organizationId,
              createdAt: {
                gte: last90Days
              }
            },
            select: {
              id: true,
              title: true,
              content: true,
              category: true,
              priority: true,
              actionable: true,
              createdAt: true
            },
            take: 1000
          })
        ])

        exportData = {
          type: 'business_data',
          exportedAt: new Date().toISOString(),
          period: {
            from: last90Days.toISOString(),
            to: new Date().toISOString()
          },
          data: {
            integrations,
            dataPoints,
            insights,
            summary: {
              totalDataPoints: dataPoints.length,
              totalInsights: insights.length,
              totalIntegrations: integrations.length
            }
          }
        }
        break

      case 'all':
        // Export everything (limited)
        const [userForAll, orgForAll, integrationsForAll, recentDataPoints, recentInsights] = await Promise.all([
          prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              timezone: true,
              preferences: true,
              notificationSettings: true,
              createdAt: true
            }
          }),
          membership.organization,
          prisma.integration.findMany({
            where: { organizationId: membership.organizationId },
            select: {
              id: true,
              platform: true,
              status: true,
              lastSyncAt: true,
              createdAt: true
            }
          }),
          prisma.dataPoint.findMany({
            where: {
              integration: {
                organizationId: membership.organizationId
              }
            },
            select: {
              metricType: true,
              value: true,
              dateRecorded: true
            },
            take: 5000,
            orderBy: {
              dateRecorded: 'desc'
            }
          }),
          prisma.insight.findMany({
            where: {
              organizationId: membership.organizationId
            },
            select: {
              title: true,
              content: true,
              category: true,
              priority: true,
              createdAt: true
            },
            take: 500,
            orderBy: {
              createdAt: 'desc'
            }
          })
        ])

        exportData = {
          type: 'complete_export',
          exportedAt: new Date().toISOString(),
          data: {
            user: userForAll,
            organization: {
              id: orgForAll.id,
              name: orgForAll.name,
              email: orgForAll.email,
              industry: orgForAll.industry,
              companySize: orgForAll.companySize,
              currency: orgForAll.currency,
              createdAt: orgForAll.createdAt
            },
            membership: {
              role: membership.role,
              joinedAt: membership.createdAt
            },
            integrations: integrationsForAll,
            recentDataPoints,
            recentInsights,
            summary: {
              exportLimitations: 'This export includes recent data only for privacy and performance reasons'
            }
          }
        }
        break
    }

    // Format response based on requested format
    if (format === 'csv' && exportType === 'data') {
      // For CSV, we'll return the data points in CSV format
      const csvHeaders = 'Date,Metric Type,Value,Platform\n'
      const csvRows = exportData.data.dataPoints.map((dp: Record<string, any>) => 
        `${dp.dateRecorded},${dp.metricType},${dp.value},${dp.integration.platform}`
      ).join('\n')
      
      return new Response(csvHeaders + csvRows, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="bizinsights-data-export-${new Date().toISOString().split('T')[0]}.csv"`
        }
      })
    }

    // Default JSON response
    const filename = `bizinsights-${exportType}-export-${new Date().toISOString().split('T')[0]}.json`
    
    return NextResponse.json({
      success: true,
      message: 'Data exported successfully',
      export: exportData,
      filename,
      downloadUrl: `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportData, null, 2))}`
    })

  } catch (error) {
    console.error('Data export error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}