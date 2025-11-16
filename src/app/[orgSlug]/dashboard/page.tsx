// src/app/[orgSlug]/dashboard/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { InsightsPanel } from '@/components/dashboard/InsightsPanel'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { IntegrationStatus } from '@/components/dashboard/IntegrationStatus'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { 
  BarChart3,
  RefreshCw,
  Plus,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Users,
  DollarSign,
  Target
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Organization {
  id: string
  name: string
  slug: string
}

interface QuickAction {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  action: () => void
  color: 'blue' | 'green' | 'purple' | 'orange'
}

export default function DashboardPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [orgLoading, setOrgLoading] = useState<boolean>(true)
  const [selectedPeriod, setSelectedPeriod] = useState<'30d' | '7d' | '90d' | '1y' | 'today'>('30d')

  const orgSlug = params?.orgSlug as string

  // Use auth guard for protected actions
  const { requireAuth, AuthPopup } = useAuthGuard({
    title: "Unlock Real Business Analytics",
    description: "Connect your business tools and get powerful analytics, automated reports, and AI-powered insights."
  })

  // Use our dashboard data hook
  const { 
    data: dashboardData, 
    loading: dataLoading, 
    error: dataError, 
    refetch: refetchData,
    markInsightAsRead 
  } = useDashboardData()

  // Fetch organization data (only for authenticated users)
  useEffect(() => {
    const fetchOrganization = async (): Promise<void> => {
      if (!session?.user?.id || !orgSlug) {
        setOrgLoading(false)
        return
      }

      try {
        setOrgLoading(true)
        
        const response = await fetch(`/api/organizations/by-slug/${orgSlug}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const orgData = await response.json()
          setOrganization(orgData)
        } else if (response.status === 404) {
          router.push('/organizations')
        } else {
          throw new Error('Failed to load organization')
        }
      } catch (err) {
        console.error('Failed to fetch organization:', err)
        router.push('/organizations')
      } finally {
        setOrgLoading(false)
      }
    }

    fetchOrganization()
  }, [session?.user?.id, orgSlug, router])

  // Handle period changes
  const handlePeriodChange = (period: string): void => {
    setSelectedPeriod(period as '30d' | '7d' | '90d' | '1y' | 'today')
  }

  // Handle integration refresh
  const handleRefreshIntegration = async (integrationId: string): Promise<void> => {
    const success = requireAuth(() => {
      fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
      }).then(response => {
        if (response.ok) {
          refetchData()
        }
      }).catch(error => {
        console.error('Failed to refresh integration:', error)
      })
    })

    if (!success) {
      return
    }
  }

  // Navigation handlers with auth guards
  const handleManageIntegrations = (): void => {
    requireAuth(() => {
      router.push(`/${orgSlug}/integrations`)
    })
  }

  const handleViewAllInsights = (): void => {
    requireAuth(() => {
      router.push(`/${orgSlug}/insights`)
    })
  }

  const handleViewReports = (): void => {
    requireAuth(() => {
      router.push(`/${orgSlug}/reports`)
    })
  }

  // Quick actions with auth protection
  const quickActions: QuickAction[] = [
    {
      id: 'add-integration',
      title: 'Add Integration',
      description: 'Connect a new business tool',
      icon: <Plus className="h-5 w-5" />,
      action: () => requireAuth(() => router.push(`/${orgSlug}/integrations`)),
      color: 'blue'
    },
    {
      id: 'generate-report',
      title: 'Generate Report',
      description: 'Create a custom business report',
      icon: <BarChart3 className="h-5 w-5" />,
      action: () => requireAuth(() => router.push(`/${orgSlug}/reports`)),
      color: 'green'
    },
    {
      id: 'view-insights',
      title: 'View All Insights',
      description: 'See all AI-generated insights',
      icon: <TrendingUp className="h-5 w-5" />,
      action: () => requireAuth(() => router.push(`/${orgSlug}/insights`)),
      color: 'purple'
    },
    {
      id: 'team-settings',
      title: 'Team Settings',
      description: 'Manage team members and permissions',
      icon: <Users className="h-5 w-5" />,
      action: () => requireAuth(() => router.push(`/${orgSlug}/team`)),
      color: 'orange'
    }
  ]

  // Period options
  const periodOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' }
  ]

  // For demo mode (no authentication), show sample data
  if (!session?.user?.id) {
    if (orgSlug === 'demo') {
      return (
        <DashboardLayout>
          <div className="space-y-6 sm:space-y-8">
            
            {/* Demo Mode Banner */}
            <div className="rounded-lg bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-4">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Demo Mode - Experience BizInsights
                  </p>
                  <p className="text-xs text-blue-600">
                    You're viewing sample data. Sign up to connect your real business tools and get actual insights.
                  </p>
                </div>
                <button
                  onClick={() => requireAuth()}
                  className="ml-auto px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Sign Up Free
                </button>
              </div>
            </div>

            {/* Page Header */}
            <div className="border-b border-gray-200 pb-4 sm:pb-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                    Dashboard
                  </h1>
                  <p className="mt-2 text-sm text-gray-600">
                    Experience powerful business analytics with sample data
                    <span className="ml-2 text-gray-400">• Demo Mode</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Show sample dashboard with demo data */}
            <MetricsCards 
              data={{
                revenue: { current: 45670.89, previous: 38920.45, change: 6750.44, changePercent: 17.3, trend: 'up' },
                orders: { current: 342, previous: 289, change: 53, changePercent: 18.3, trend: 'up' },
                customers: { current: 234, previous: 198, change: 36, changePercent: 18.2, trend: 'up' },
                sessions: { current: 9998, previous: 9087, change: 911, changePercent: 10.0, trend: 'up' },
                conversion: { current: 3.42, previous: 3.18, change: 0.24, changePercent: 7.5, trend: 'up' },
                aov: { current: 133.45, previous: 134.71, change: -1.26, changePercent: -0.9, trend: 'down' }
              }}
              loading={false}
              period="30 days"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <RevenueChart 
                  data={[]}
                  loading={false}
                  period="30d"
                  showComparison={true}
                />

                {/* Demo Integration Status */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Sample Integrations</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-green-100 rounded-md">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">Shopify (Demo)</span>
                          <div className="text-xs text-gray-500">Sample e-commerce data</div>
                        </div>
                      </div>
                      <button
                        onClick={() => requireAuth()}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Connect Real Store
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="p-1.5 bg-blue-100 rounded-md">
                          <BarChart3 className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-900">Analytics (Demo)</span>
                          <div className="text-xs text-gray-500">Sample traffic data</div>
                        </div>
                      </div>
                      <button
                        onClick={() => requireAuth()}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                      >
                        Connect Real Analytics
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <InsightsPanel
                  insights={[
                    {
                      id: 'demo-1',
                      type: 'trend',
                      title: 'Revenue growth accelerating',
                      description: 'Your revenue has increased by 17.3% compared to last month, outpacing your average growth rate.',
                      impactScore: 8,
                      isRead: false,
                      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
                      metadata: { category: 'revenue', period: '30d' }
                    },
                    {
                      id: 'demo-2',
                      type: 'recommendation',
                      title: 'Optimize conversion rate',
                      description: 'Consider implementing exit-intent popups. Similar stores see 15% conversion increase.',
                      impactScore: 6,
                      isRead: false,
                      createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
                      metadata: { category: 'optimization', type: 'conversion' }
                    }
                  ] as any}
                  loading={false}
                  onMarkAsRead={() => requireAuth()}
                  onViewAll={() => requireAuth()}
                />

                {/* Call to Action */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
                  <h3 className="text-lg font-semibold mb-2">Ready for Real Data?</h3>
                  <p className="text-blue-100 text-sm mb-4">
                    Connect your business tools and get real insights, automated reports, and AI-powered recommendations.
                  </p>
                  <button
                    onClick={() => requireAuth()}
                    className="w-full bg-white text-blue-600 font-medium py-2 px-4 rounded-lg hover:bg-blue-50 transition-colors"
                  >
                    Start Free Trial
                  </button>
                </div>
              </div>
            </div>

            <AuthPopup />
          </div>
        </DashboardLayout>
      )
    } else {
      // This is an organization route but user is not authenticated
      router.push('/auth/signin')
      return <div>Redirecting...</div>
    }
  }

  if (orgLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-96"></div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!organization) {
    return (
      <DashboardLayout>
        <div className="rounded-lg bg-red-50 border border-red-200 p-6">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Organization not found
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>The organization you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
              </div>
              <div className="mt-4">
                <button
                  onClick={() => router.push('/organizations')}
                  className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
                >
                  Go to Organizations
                </button>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8">
        
        {/* Page Header */}
        <div className="border-b border-gray-200 pb-4 sm:pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
                Dashboard
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                Overview of your business performance and key metrics
                {organization && (
                  <span className="ml-2 text-gray-400">• {organization.name}</span>
                )}
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Period Selector */}
              <select 
                value={selectedPeriod}
                onChange={(e) => handlePeriodChange(e.target.value)}
                className="rounded-lg border-gray-300 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                {periodOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              
              {/* Refresh Button */}
              <button
                onClick={refetchData}
                disabled={dataLoading}
                className={cn(
                  "inline-flex items-center rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  dataLoading
                    ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                )}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", dataLoading && "animate-spin")} />
                {dataLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Data Status Indicator */}
        {dashboardData && (
          <div className={cn(
            "rounded-lg border p-4",
            dashboardData.hasRealData 
              ? "bg-green-50 border-green-200" 
              : "bg-blue-50 border-blue-200"
          )}>
            <div className="flex items-center space-x-3">
              <div className={cn(
                "h-2 w-2 rounded-full",
                dashboardData.hasRealData ? "bg-green-500" : "bg-blue-500"
              )} />
              <div>
                <p className={cn(
                  "text-sm font-medium",
                  dashboardData.hasRealData ? "text-green-800" : "text-blue-800"
                )}>
                  {dashboardData.hasRealData ? 'Live Data Connected' : 'Getting Started'}
                </p>
                <p className={cn(
                  "text-xs",
                  dashboardData.hasRealData ? "text-green-600" : "text-blue-600"
                )}>
                  {dashboardData.message}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {dataError && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading dashboard data
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{dataError}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={refetchData}
                    className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Dashboard Content */}
        {dashboardData && (
          <>
            {/* Key Metrics Cards */}
            <MetricsCards 
              data={dashboardData.metrics as any}
              loading={dataLoading}
              period={selectedPeriod}
            />

            {/* Main Content Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Charts */}
              <div className="lg:col-span-2 space-y-6">
                {/* Revenue Chart */}
                <RevenueChart 
                  data={[]}
                  loading={dataLoading}
                  period={selectedPeriod}
                  showComparison={true}
                />

                {/* Integration Status */}
                <IntegrationStatus
                  integrations={(dashboardData as any).integrations || []}
                  loading={dataLoading}
                  onRefreshIntegration={handleRefreshIntegration}
                  onManageIntegrations={handleManageIntegrations}
                />
              </div>

              {/* Right Column - Insights & Quick Actions */}
              <div className="space-y-6">
                {/* Insights Panel */}
                <InsightsPanel
                  insights={(dashboardData as any).insights || []}
                  loading={dataLoading}
                  onMarkAsRead={markInsightAsRead}
                  onViewAll={handleViewAllInsights}
                />

                {/* Quick Actions */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    {quickActions.map((action) => (
                      <button
                        key={action.id}
                        onClick={action.action}
                        className={cn(
                          "w-full flex items-center space-x-3 p-3 rounded-lg border transition-colors text-left hover:shadow-sm",
                          action.color === 'blue' && "border-blue-200 bg-blue-50 hover:bg-blue-100",
                          action.color === 'green' && "border-green-200 bg-green-50 hover:bg-green-100",
                          action.color === 'purple' && "border-purple-200 bg-purple-50 hover:bg-purple-100",
                          action.color === 'orange' && "border-orange-200 bg-orange-50 hover:bg-orange-100"
                        )}
                      >
                        <div className={cn(
                          "p-2 rounded-md",
                          action.color === 'blue' && "bg-blue-100 text-blue-600",
                          action.color === 'green' && "bg-green-100 text-green-600",
                          action.color === 'purple' && "bg-purple-100 text-purple-600",
                          action.color === 'orange' && "bg-orange-100 text-orange-600"
                        )}>
                          {action.icon}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{action.title}</div>
                          <div className="text-sm text-gray-500">{action.description}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
                  <div className="space-y-3">
                    {((dashboardData as any).integrations || []).slice(0, 3).map((integration: any) => (
                      <div key={integration.id} className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {integration.status === 'active' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-500" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">
                            {integration.platform.charAt(0).toUpperCase() + integration.platform.slice(1)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {integration.lastSyncAt 
                              ? `Last sync: ${new Date(integration.lastSyncAt).toLocaleString()}`
                              : 'Never synced'
                            }
                          </p>
                        </div>
                        <div className="text-xs text-gray-400">
                          {integration.dataPointsCount || 0} data points
                        </div>
                      </div>
                    ))}
                    
                    {((dashboardData as any).integrations || []).length === 0 && (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">No recent activity</p>
                        <button
                          onClick={handleManageIntegrations}
                          className="mt-2 text-sm text-blue-600 hover:text-blue-700"
                        >
                          Connect your first integration
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <DollarSign className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Revenue Goal</div>
                    <div className="text-2xl font-bold text-gray-900">
                      ${dashboardData.metrics.revenue.current.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {dashboardData.metrics.revenue.changePercent > 0 ? '+' : ''}
                      {dashboardData.metrics.revenue.changePercent.toFixed(1)}% from last period
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Customer Growth</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboardData.metrics.customers.current.toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {dashboardData.metrics.customers.changePercent > 0 ? '+' : ''}
                      {dashboardData.metrics.customers.changePercent.toFixed(1)}% from last period
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex items-center">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Target className="h-6 w-6 text-purple-600" />
                  </div>
                  <div className="ml-4">
                    <div className="text-sm font-medium text-gray-500">Conversion Rate</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {dashboardData.metrics.conversion.current.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">
                      {dashboardData.metrics.conversion.changePercent > 0 ? '+' : ''}
                      {dashboardData.metrics.conversion.changePercent.toFixed(1)}% from last period
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        <AuthPopup />
      </div>
    </DashboardLayout>
  )
}