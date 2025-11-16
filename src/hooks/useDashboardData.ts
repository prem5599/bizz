// src/hooks/useDashboardDataNew.ts
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'

interface MetricValue {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
}

interface MetricData extends MetricValue {}

interface DashboardData {
  metrics: {
    revenue: MetricData
    orders: MetricData
    sessions: MetricData
    customers: MetricData
    conversion: MetricData
    aov: MetricData
  }
  charts: {
    revenue_trend: Array<{ date: string; revenue: number; orders: number; sessions: number }>
    traffic_sources: Array<{ source: string; sessions: number; percentage: number }>
    sales_by_hour: Array<{ hour: number; sales: number; orders: number }>
    top_products: Array<{ name: string; revenue: number; quantity: number }>
    conversion_funnel: Array<{ stage: string; count: number; percentage: number }>
    geographic_sales: Array<{ region: string; sales: number; customers: number }>
  }
  insights: Array<{
    id: string
    type: string
    title: string
    description: string
    impactScore: number
    isRead: boolean
    createdAt: string
  }>
  integrations: Array<{
    id: string
    platform: string
    status: string
    lastSyncAt: string | null
  }>
  hasRealData: boolean
  message?: string
  lastUpdated: string
}

interface UseDashboardDataReturn {
  data: DashboardData | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
  markInsightAsRead?: (insightId: string) => Promise<void>
}

export function useDashboardData(): UseDashboardDataReturn {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    if (!session?.user?.id) {
      setData(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // First, get user's organization
      const orgResponse = await fetch('/api/organizations/current', {
        credentials: 'include'
      })

      if (!orgResponse.ok) {
        throw new Error('Failed to get organization')
      }

      const orgData = await orgResponse.json()
      if (!orgData.organization) {
        throw new Error('No organization found')
      }

      const organizationId = orgData.organization.id

      // Fetch dashboard data for the organization
      const dashboardResponse = await fetch(`/api/dashboard/${organizationId}`, {
        credentials: 'include'
      })

      if (!dashboardResponse.ok) {
        throw new Error(`Failed to fetch dashboard data: ${dashboardResponse.statusText}`)
      }

      const dashboardData = await dashboardResponse.json()

      // Transform the API response to match our interface
      const transformedData: DashboardData = {
        metrics: {
          revenue: {
            current: dashboardData.metrics?.revenue?.current || 0,
            previous: dashboardData.metrics?.revenue?.previous || 0,
            change: dashboardData.metrics?.revenue?.change || 0,
            changePercent: dashboardData.metrics?.revenue?.changePercent || 0,
            trend: dashboardData.metrics?.revenue?.trend || 'neutral'
          },
          orders: {
            current: dashboardData.metrics?.orders?.current || 0,
            previous: dashboardData.metrics?.orders?.previous || 0,
            change: dashboardData.metrics?.orders?.change || 0,
            changePercent: dashboardData.metrics?.orders?.changePercent || 0,
            trend: dashboardData.metrics?.orders?.trend || 'neutral'
          },
          sessions: {
            current: dashboardData.metrics?.sessions?.current || 0,
            previous: dashboardData.metrics?.sessions?.previous || 0,
            change: dashboardData.metrics?.sessions?.change || 0,
            changePercent: dashboardData.metrics?.sessions?.changePercent || 0,
            trend: dashboardData.metrics?.sessions?.trend || 'neutral'
          },
          customers: {
            current: dashboardData.metrics?.customers?.current || 0,
            previous: dashboardData.metrics?.customers?.previous || 0,
            change: dashboardData.metrics?.customers?.change || 0,
            changePercent: dashboardData.metrics?.customers?.changePercent || 0,
            trend: dashboardData.metrics?.customers?.trend || 'neutral'
          },
          conversion: {
            current: dashboardData.metrics?.conversionRate?.current || 0,
            previous: dashboardData.metrics?.conversionRate?.previous || 0,
            change: dashboardData.metrics?.conversionRate?.change || 0,
            changePercent: dashboardData.metrics?.conversionRate?.changePercent || 0,
            trend: dashboardData.metrics?.conversionRate?.trend || 'neutral'
          },
          aov: {
            current: dashboardData.metrics?.averageOrderValue?.current || 0,
            previous: dashboardData.metrics?.averageOrderValue?.previous || 0,
            change: dashboardData.metrics?.averageOrderValue?.change || 0,
            changePercent: dashboardData.metrics?.averageOrderValue?.changePercent || 0,
            trend: dashboardData.metrics?.averageOrderValue?.trend || 'neutral'
          }
        },
        charts: {
          revenue_trend: dashboardData.chartData?.revenue || [],
          traffic_sources: dashboardData.chartData?.traffic || [],
          sales_by_hour: [],
          top_products: dashboardData.chartData?.products || [],
          conversion_funnel: [],
          geographic_sales: []
        },
        insights: dashboardData.insights || [],
        integrations: dashboardData.integrations || [],
        hasRealData: dashboardData.hasRealData || false,
        message: dashboardData.message,
        lastUpdated: dashboardData.lastUpdated || new Date().toISOString()
      }

      setData(transformedData)

    } catch (err) {
      console.error('Dashboard data fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      
      // Set empty state on error for authenticated users
      setData({
        metrics: {
          revenue: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          orders: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          sessions: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          customers: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          conversion: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          aov: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' }
        },
        charts: {
          revenue_trend: [],
          traffic_sources: [],
          sales_by_hour: [],
          top_products: [],
          conversion_funnel: [],
          geographic_sales: []
        },
        insights: [],
        integrations: [],
        hasRealData: false,
        message: 'Unable to load data. Please try again.',
        lastUpdated: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  // Mark insight as read
  const markInsightAsRead = useCallback(async (insightId: string) => {
    try {
      await fetch(`/api/insights/${insightId}/read`, {
        method: 'PATCH',
        credentials: 'include'
      })
      
      // Update local state
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          insights: prev.insights.map(insight =>
            insight.id === insightId ? { ...insight, isRead: true } : insight
          )
        }
      })
    } catch (error) {
      console.error('Failed to mark insight as read:', error)
    }
  }, [])

  // Fetch data on mount and when session changes
  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Auto-refresh every 5 minutes if we have real data
  useEffect(() => {
    if (!data?.hasRealData) return

    const interval = setInterval(() => {
      fetchDashboardData()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [data?.hasRealData, fetchDashboardData])

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData,
    markInsightAsRead
  }
}

export function useDashboardDataNew(): UseDashboardDataReturn {
  const { data: session } = useSession()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDashboardData = useCallback(async () => {
    if (!session?.user?.id) {
      setData(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      // First, get user's organization
      const orgResponse = await fetch('/api/organizations/current', {
        credentials: 'include'
      })

      if (!orgResponse.ok) {
        throw new Error('Failed to get organization')
      }

      const orgData = await orgResponse.json()
      if (!orgData.organization) {
        throw new Error('No organization found')
      }

      const organizationId = orgData.organization.id

      // Fetch dashboard data for the organization
      const dashboardResponse = await fetch(`/api/dashboard/${organizationId}`, {
        credentials: 'include'
      })

      if (!dashboardResponse.ok) {
        throw new Error(`Failed to fetch dashboard data: ${dashboardResponse.statusText}`)
      }

      const dashboardData = await dashboardResponse.json()

      // Transform the API response to match our interface
      const transformedData: DashboardData = {
        metrics: {
          revenue: {
            current: dashboardData.metrics?.revenue?.current || 0,
            previous: dashboardData.metrics?.revenue?.previous || 0,
            change: dashboardData.metrics?.revenue?.change || 0,
            changePercent: dashboardData.metrics?.revenue?.changePercent || 0,
            trend: dashboardData.metrics?.revenue?.trend || 'neutral'
          },
          orders: {
            current: dashboardData.metrics?.orders?.current || 0,
            previous: dashboardData.metrics?.orders?.previous || 0,
            change: dashboardData.metrics?.orders?.change || 0,
            changePercent: dashboardData.metrics?.orders?.changePercent || 0,
            trend: dashboardData.metrics?.orders?.trend || 'neutral'
          },
          sessions: {
            current: dashboardData.metrics?.sessions?.current || 0,
            previous: dashboardData.metrics?.sessions?.previous || 0,
            change: dashboardData.metrics?.sessions?.change || 0,
            changePercent: dashboardData.metrics?.sessions?.changePercent || 0,
            trend: dashboardData.metrics?.sessions?.trend || 'neutral'
          },
          customers: {
            current: dashboardData.metrics?.customers?.current || 0,
            previous: dashboardData.metrics?.customers?.previous || 0,
            change: dashboardData.metrics?.customers?.change || 0,
            changePercent: dashboardData.metrics?.customers?.changePercent || 0,
            trend: dashboardData.metrics?.customers?.trend || 'neutral'
          },
          conversion: {
            current: dashboardData.metrics?.conversionRate?.current || 0,
            previous: dashboardData.metrics?.conversionRate?.previous || 0,
            change: dashboardData.metrics?.conversionRate?.change || 0,
            changePercent: dashboardData.metrics?.conversionRate?.changePercent || 0,
            trend: dashboardData.metrics?.conversionRate?.trend || 'neutral'
          },
          aov: {
            current: dashboardData.metrics?.averageOrderValue?.current || 0,
            previous: dashboardData.metrics?.averageOrderValue?.previous || 0,
            change: dashboardData.metrics?.averageOrderValue?.change || 0,
            changePercent: dashboardData.metrics?.averageOrderValue?.changePercent || 0,
            trend: dashboardData.metrics?.averageOrderValue?.trend || 'neutral'
          }
        },
        charts: {
          revenue_trend: dashboardData.chartData?.revenue || [],
          traffic_sources: dashboardData.chartData?.traffic || [],
          sales_by_hour: [],
          top_products: dashboardData.chartData?.products || [],
          conversion_funnel: [],
          geographic_sales: []
        },
        insights: dashboardData.insights || [],
        integrations: dashboardData.integrations || [],
        hasRealData: dashboardData.hasRealData || false,
        message: dashboardData.message,
        lastUpdated: dashboardData.lastUpdated || new Date().toISOString()
      }

      setData(transformedData)

    } catch (err) {
      console.error('Dashboard data fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
      
      // Set empty state on error for authenticated users
      setData({
        metrics: {
          revenue: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          orders: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          sessions: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          customers: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          conversion: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' },
          aov: { current: 0, previous: 0, change: 0, changePercent: 0, trend: 'neutral' }
        },
        charts: {
          revenue_trend: [],
          traffic_sources: [],
          sales_by_hour: [],
          top_products: [],
          conversion_funnel: [],
          geographic_sales: []
        },
        insights: [],
        integrations: [],
        hasRealData: false,
        message: 'Unable to load data. Please try again.',
        lastUpdated: new Date().toISOString()
      })
    } finally {
      setLoading(false)
    }
  }, [session?.user?.id])

  // Mark insight as read
  const markInsightAsRead = useCallback(async (insightId: string) => {
    try {
      await fetch(`/api/insights/${insightId}/read`, {
        method: 'PATCH',
        credentials: 'include'
      })
      
      // Update local state
      setData(prev => {
        if (!prev) return prev
        return {
          ...prev,
          insights: prev.insights.map(insight =>
            insight.id === insightId ? { ...insight, isRead: true } : insight
          )
        }
      })
    } catch (error) {
      console.error('Failed to mark insight as read:', error)
    }
  }, [])

  // Fetch data on mount and when session changes
  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  // Auto-refresh every 5 minutes if we have real data
  useEffect(() => {
    if (!data?.hasRealData) return

    const interval = setInterval(() => {
      fetchDashboardData()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [data?.hasRealData, fetchDashboardData])

  return {
    data,
    loading,
    error,
    refetch: fetchDashboardData,
    markInsightAsRead
  }
}