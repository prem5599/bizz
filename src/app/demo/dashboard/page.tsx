// src/app/demo/dashboard/page.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MetricsCards } from '@/components/dashboard/MetricsCards'
import { InsightsPanel } from '@/components/dashboard/InsightsPanel'
import { RevenueChart } from '@/components/dashboard/RevenueChart'
import { IntegrationStatus } from '@/components/dashboard/IntegrationStatus'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { 
  BarChart3,
  Calendar,
  Download,
  Settings,
  Plus,
  CheckCircle,
  TrendingUp,
  Users,
  DollarSign,
  Target,
  ArrowLeft,
  ExternalLink,
  Sparkles
} from 'lucide-react'

export default function DemoDashboardPage() {
  const router = useRouter()
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  
  const { requireAuth, AuthPopup } = useAuthGuard({
    title: "Ready to Connect Real Data?",
    description: "Create your free account to connect your business tools and get real insights instead of demo data."
  })

  // Sample demo data
  const demoData = {
    metrics: {
      revenue: { current: 45670.89, previous: 38920.45, change: 6750.44, changePercent: 17.3, trend: 'up' as const },
      orders: { current: 342, previous: 289, change: 53, changePercent: 18.3, trend: 'up' as const },
      customers: { current: 234, previous: 198, change: 36, changePercent: 18.2, trend: 'up' as const },
      conversionRate: { current: 3.42, previous: 3.18, change: 0.24, changePercent: 7.5, trend: 'up' as const },
      averageOrderValue: { current: 133.45, previous: 134.71, change: -1.26, changePercent: -0.9, trend: 'down' as const },
      sessions: { current: 9998, previous: 9087, change: 911, changePercent: 10.0, trend: 'up' as const }
    },
    integrations: [
      {
        id: 'demo-shopify',
        platform: 'shopify',
        platformAccountId: 'demo-store.myshopify.com',
        status: 'active' as const,
        lastSyncAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        dataPointsCount: 1250
      },
      {
        id: 'demo-stripe',
        platform: 'stripe',
        platformAccountId: 'acct_demo123',
        status: 'active' as const,
        lastSyncAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        dataPointsCount: 890
      },
      {
        id: 'demo-analytics',
        platform: 'google_analytics',
        platformAccountId: 'GA-demo-123456',
        status: 'active' as const,
        lastSyncAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        dataPointsCount: 2100
      }
    ],
    insights: [
      {
        id: 'demo-insight-1',
        type: 'trend' as const,
        title: 'Revenue growth accelerating',
        description: 'Your revenue has increased by 17.3% compared to last month, outpacing your average growth rate of 12%. This suggests your recent marketing campaigns are performing well.',
        impactScore: 8,
        isRead: false,
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        metadata: { category: 'revenue', period: '30d' }
      },
      {
        id: 'demo-insight-2',
        type: 'recommendation' as const,
        title: 'Optimize average order value',
        description: 'Consider implementing bundle recommendations or increasing minimum order thresholds. Stores similar to yours see 15% AOV increase with strategic bundling.',
        impactScore: 6,
        isRead: false,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
        metadata: { category: 'optimization', type: 'bundling' }
      },
      {
        id: 'demo-insight-3',
        type: 'anomaly' as const,
        title: 'Unusual spike in mobile traffic',
        description: 'Mobile sessions increased 34% yesterday, significantly higher than typical patterns. This could indicate viral social media content or a successful mobile campaign.',
        impactScore: 5,
        isRead: true,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        metadata: { category: 'traffic', source: 'mobile' }
      }
    ],
    hasRealData: false,
    message: 'Demo Mode - This is sample data to showcase BizInsights features',
    lastUpdated: new Date().toISOString()
  }

  const handleRefreshIntegration = (integrationId: string) => {
    requireAuth(() => {
      // This would normally refresh the integration
      console.log('Refreshing integration:', integrationId)
    })
  }

  const handleManageIntegrations = () => {
    requireAuth()
  }

  const handleViewAllInsights = () => {
    requireAuth()
  }

  const handleMarkInsightAsRead = (insightId: string) => {
    requireAuth()
  }

  const quickActions = [
    {
      id: 'add-integration',
      title: 'Connect Real Store',
      description: 'Link your actual Shopify store',
      icon: <Plus className="h-5 w-5" />,
      action: () => requireAuth(),
      color: 'blue' as const
    },
    {
      id: 'generate-report',
      title: 'Generate Report',
      description: 'Create automated business reports',
      icon: <BarChart3 className="h-5 w-5" />,
      action: () => requireAuth(),
      color: 'green' as const
    },
    {
      id: 'view-insights',
      title: 'AI Insights',
      description: 'Get AI-powered recommendations',
      icon: <TrendingUp className="h-5 w-5" />,
      action: () => requireAuth(),
      color: 'purple' as const
    },
    {
      id: 'team-settings',
      title: 'Team Access',
      description: 'Invite team members',
      icon: <Users className="h-5 w-5" />,
      action: () => requireAuth(),
      color: 'orange' as const
    }
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6 sm:space-y-8">
        
        {/* Demo Header with Back Button */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/')}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <Sparkles className="h-5 w-5" />
                  <h1 className="text-2xl font-bold">Interactive Demo</h1>
                </div>
                <p className="text-purple-100 mt-1">
                  Experience BizInsights with sample data from a fictional e-commerce store
                </p>
              </div>
            </div>
            <button
              onClick={() => requireAuth()}
              className="bg-white text-purple-600 font-medium px-6 py-3 rounded-lg hover:bg-purple-50 transition-colors"
            >
              Start Free Trial
            </button>
          </div>
        </div>

        {/* Demo Notice */}
        <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center space-x-3">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                🎯 Demo Environment
              </p>
              <p className="text-xs text-blue-600">
                All data shown is fictional. Click any action to see how easy it is to get started with real data.
              </p>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <MetricsCards 
          data={demoData.metrics}
          loading={false}
          period={selectedPeriod}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Revenue Chart */}
            <RevenueChart 
              data={[]} // Sample data will be generated by the component
              loading={false}
              period={selectedPeriod}
              showComparison={true}
            />

            {/* Integration Status */}
            <IntegrationStatus
              integrations={demoData.integrations}
              loading={false}
              onRefreshIntegration={handleRefreshIntegration}
              onManageIntegrations={handleManageIntegrations}
            />
          </div>

          {/* Right Column - Insights & Actions */}
          <div className="space-y-6">
            {/* Insights Panel */}
            <InsightsPanel
              insights={demoData.insights}
              loading={false}
              onMarkAsRead={handleMarkInsightAsRead}
              onViewAll={handleViewAllInsights}
            />

            {/* Quick Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Try These Features</h3>
              <div className="space-y-3">
                {quickActions.map((action) => (
                  <button
                    key={action.id}
                    onClick={action.action}
                    className={`w-full flex items-center space-x-3 p-3 rounded-lg border transition-colors text-left hover:shadow-sm ${
                      action.color === 'blue' ? 'border-blue-200 bg-blue-50 hover:bg-blue-100' :
                      action.color === 'green' ? 'border-green-200 bg-green-50 hover:bg-green-100' :
                      action.color === 'purple' ? 'border-purple-200 bg-purple-50 hover:bg-purple-100' :
                      'border-orange-200 bg-orange-50 hover:bg-orange-100'
                    }`}
                  >
                    <div className={`p-2 rounded-md ${
                      action.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                      action.color === 'green' ? 'bg-green-100 text-green-600' :
                      action.color === 'purple' ? 'bg-purple-100 text-purple-600' :
                      'bg-orange-100 text-orange-600'
                    }`}>
                      {action.icon}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{action.title}</div>
                      <div className="text-sm text-gray-500">{action.description}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-gray-400 ml-auto" />
                  </button>
                ))}
              </div>
            </div>

            {/* Demo CTA */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-lg p-6 text-white">
              <h3 className="text-lg font-semibold mb-2">Like what you see?</h3>
              <p className="text-green-100 text-sm mb-4">
                Get real insights from your actual business data. Setup takes less than 5 minutes.
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => requireAuth()}
                  className="w-full bg-white text-green-600 font-medium py-2 px-4 rounded-lg hover:bg-green-50 transition-colors"
                >
                  Create Free Account
                </button>
                <button
                  onClick={() => router.push('/')}
                  className="w-full text-center text-green-100 hover:text-white text-sm py-2 transition-colors"
                >
                  ← Back to Homepage
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Demo Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="p-3 bg-blue-100 rounded-lg w-fit mx-auto mb-4">
              <DollarSign className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Real-time Revenue</h3>
            <p className="text-sm text-gray-500">
              Track every sale as it happens across all your channels
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="p-3 bg-green-100 rounded-lg w-fit mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">AI Predictions</h3>
            <p className="text-sm text-gray-500">
              Get forecasts and recommendations based on your data patterns
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <div className="p-3 bg-purple-100 rounded-lg w-fit mx-auto mb-4">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Goal Tracking</h3>
            <p className="text-sm text-gray-500">
              Set targets and monitor progress with visual indicators
            </p>
          </div>
        </div>

        <AuthPopup />
      </div>
    </DashboardLayout>
  )
}