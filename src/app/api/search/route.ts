// src/app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface SearchResult {
  id: string
  type: 'integration' | 'insight' | 'report' | 'metric' | 'customer' | 'order'
  title: string
  description: string
  url: string
  metadata?: Record<string, any>
  relevanceScore: number
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { query, filters } = await request.json()
    
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    // Get user's organization
    const userMembership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: { organization: true }
    })

    if (!userMembership) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    const organizationId = userMembership.organizationId
    const searchTerm = query.toLowerCase().trim()
    const results: SearchResult[] = []

    // Search integrations
    const integrations = await prisma.integration.findMany({
      where: {
        organizationId,
        OR: [
          { platform: { contains: searchTerm, mode: 'insensitive' } },
          { platformAccountId: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      include: {
        _count: { select: { dataPoints: true } }
      }
    })

    integrations.forEach(integration => {
      const relevanceScore = calculateRelevanceScore(searchTerm, [
        integration.platform,
        integration.platformAccountId || '',
        integration.status
      ])
      
      results.push({
        id: integration.id,
        type: 'integration',
        title: `${integration.platform} Integration`,
        description: `${integration.platformAccountId || 'Connected integration'} - ${integration.status}`,
        url: `/dashboard/integrations?id=${integration.id}`,
        metadata: {
          platform: integration.platform,
          status: integration.status,
          dataPoints: integration._count.dataPoints
        },
        relevanceScore
      })
    })

    // Search insights
    const insights = await prisma.insight.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { type: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    })

    insights.forEach(insight => {
      const relevanceScore = calculateRelevanceScore(searchTerm, [
        insight.title,
        insight.description,
        insight.type
      ])
      
      results.push({
        id: insight.id,
        type: 'insight',
        title: insight.title,
        description: insight.description,
        url: `/dashboard/insights?id=${insight.id}`,
        metadata: {
          type: insight.type,
          impactScore: insight.impactScore,
          isRead: insight.isRead,
          createdAt: insight.createdAt
        },
        relevanceScore
      })
    })

    // Search reports
    const reports = await prisma.report.findMany({
      where: {
        organizationId,
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { reportType: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      orderBy: { generatedAt: 'desc' },
      take: 10
    })

    reports.forEach(report => {
      const relevanceScore = calculateRelevanceScore(searchTerm, [
        report.title,
        report.reportType
      ])
      
      results.push({
        id: report.id,
        type: 'report',
        title: report.title,
        description: `${report.reportType} report`,
        url: `/dashboard/reports?id=${report.id}`,
        metadata: {
          reportType: report.reportType,
          generatedAt: report.generatedAt,
          dateRange: {
            start: report.dateRangeStart,
            end: report.dateRangeEnd
          }
        },
        relevanceScore
      })
    })

    // Search data points for metrics
    if (searchTerm.includes('revenue') || searchTerm.includes('sales') || searchTerm.includes('order')) {
      const metricTypes = ['revenue', 'orders', 'customers', 'sessions']
      const matchingMetrics = metricTypes.filter(type => 
        type.toLowerCase().includes(searchTerm) || 
        searchTerm.includes(type.toLowerCase())
      )

      matchingMetrics.forEach(metricType => {
        const relevanceScore = calculateRelevanceScore(searchTerm, [metricType])
        
        results.push({
          id: `metric_${metricType}`,
          type: 'metric',
          title: `${metricType.charAt(0).toUpperCase() + metricType.slice(1)} Analytics`,
          description: `View ${metricType} trends and insights`,
          url: `/dashboard/analytics?metric=${metricType}`,
          metadata: {
            metricType,
            category: 'analytics'
          },
          relevanceScore
        })
      })
    }

    // Add predefined quick searches
    const quickSearches = [
      {
        keywords: ['dashboard', 'overview', 'summary'],
        result: {
          id: 'dashboard',
          type: 'metric' as const,
          title: 'Dashboard Overview',
          description: 'Main dashboard with key metrics and insights',
          url: '/dashboard',
          metadata: { category: 'navigation' },
          relevanceScore: 0.8
        }
      },
      {
        keywords: ['analytics', 'charts', 'graphs'],
        result: {
          id: 'analytics',
          type: 'metric' as const,
          title: 'Analytics & Charts',
          description: 'Detailed analytics with interactive charts',
          url: '/dashboard/analytics',
          metadata: { category: 'navigation' },
          relevanceScore: 0.8
        }
      },
      {
        keywords: ['settings', 'configuration', 'preferences'],
        result: {
          id: 'settings',
          type: 'metric' as const,
          title: 'Settings',
          description: 'Account settings and preferences',
          url: '/dashboard/settings',
          metadata: { category: 'navigation' },
          relevanceScore: 0.8
        }
      },
      {
        keywords: ['team', 'members', 'users'],
        result: {
          id: 'team',
          type: 'metric' as const,
          title: 'Team Management',
          description: 'Manage team members and permissions',
          url: '/dashboard/team',
          metadata: { category: 'navigation' },
          relevanceScore: 0.8
        }
      }
    ]

    quickSearches.forEach(({ keywords, result }) => {
      if (keywords.some(keyword => 
        keyword.toLowerCase().includes(searchTerm) || 
        searchTerm.includes(keyword.toLowerCase())
      )) {
        results.push(result)
      }
    })

    // Apply filters
    let filteredResults = results

    if (filters?.category && filters.category !== 'all') {
      filteredResults = filteredResults.filter(result => 
        result.type === filters.category || 
        result.metadata?.category === filters.category
      )
    }

    if (filters?.platform && filters.platform !== 'all') {
      filteredResults = filteredResults.filter(result => 
        result.metadata?.platform === filters.platform
      )
    }

    if (filters?.status && filters.status !== 'all') {
      filteredResults = filteredResults.filter(result => 
        result.metadata?.status === filters.status
      )
    }

    // Sort by relevance score
    filteredResults.sort((a, b) => b.relevanceScore - a.relevanceScore)

    // Limit results
    filteredResults = filteredResults.slice(0, 20)

    return NextResponse.json({
      results: filteredResults,
      total: filteredResults.length,
      query: searchTerm
    })

  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateRelevanceScore(query: string, searchableFields: string[]): number {
  const queryLower = query.toLowerCase()
  let score = 0
  
  searchableFields.forEach(field => {
    if (!field) return
    
    const fieldLower = field.toLowerCase()
    
    // Exact match
    if (fieldLower === queryLower) {
      score += 1.0
    }
    // Starts with query
    else if (fieldLower.startsWith(queryLower)) {
      score += 0.8
    }
    // Contains query
    else if (fieldLower.includes(queryLower)) {
      score += 0.6
    }
    // Word boundary match
    else if (fieldLower.split(' ').some(word => word.startsWith(queryLower))) {
      score += 0.4
    }
  })
  
  return Math.min(score, 1.0)
}