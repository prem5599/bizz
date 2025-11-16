// src/app/dashboard/pageNew.tsx
'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MetricCard } from '@/components/layout/MetricCard'
import { InsightsList } from '@/components/dashboard/InsightsList'
import { useDashboardDataNew } from '@/hooks/useDashboardDataNew'
import { 
  DollarSign, 
  ShoppingCart, 
  Users, 
  TrendingUp,
  BarChart3,
  Eye,
  RefreshCw,
  Calendar,
  Filter,
  Info,
  Activity,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

export default function DashboardPageNew() {
  const { data: session } = useSession()
  const [selectedPeriod, setSelectedPeriod] = useState('30d')
  const [metricFilter, setMetricFilter] = useState('all')
  const [showFilters, setShowFilters] = useState(false)

  // Use the corrected dashboard data hook
  const { data, loading, error, refetch } = useDashboardDataNew()

  // Format currency for Indian market
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  // Show loading state
  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <div className="h-8 bg-gray-200 rounded w-48 animate-pulse mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-32 animate-pulse"></div>
            </div>
            <div className="flex space-x-3">
              <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
              <div className="h-10 bg-gray-200 rounded w-10 animate-pulse"></div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg shadow animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-16 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-20 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-12"></div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="h-64 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  // Show auth required if no session
  if (!session?.user) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
            <p className="text-gray-600 mb-6">Please sign in to view your dashboard</p>
            <a
              href="/api/auth/signin"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
            >
              Sign In
            </a>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              {data?.hasRealData 
                ? `Live data updated ${new Date(data.lastUpdated || '').toLocaleTimeString()}`
                : 'Connect integrations to see live data'
              }
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>

            <button
              onClick={refetch}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Refresh data"
            >
              <RefreshCw className="h-4 w-4" />
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Toggle filters"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">Metrics</label>
                <select 
                  value={metricFilter} 
                  onChange={(e) => setMetricFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Metrics</option>
                  <option value="revenue">Revenue & Orders</option>
                  <option value="traffic">Traffic & Customers</option>
                  <option value="conversion">Conversion Metrics</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Data Status Notice */}
        {data && !data.hasRealData && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <Info className="h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  Getting Started
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    {data.message || 'Connect integrations to populate your dashboard with real business data.'}
                    <a href="/dashboard/integrations" className="font-medium underline hover:text-blue-600 ml-1">
                      Connect integrations
                    </a>
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Error loading dashboard data
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={refetch}
                    className="rounded-md bg-red-100 px-3 py-2 text-sm font-medium text-red-800 hover:bg-red-200"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Key Metrics Grid */}
        {data && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(metricFilter === 'all' || metricFilter === 'revenue') && (
              <>
                <MetricCard
                  title="Revenue"
                  value={data.metrics.revenue.current}
                  change={data.metrics.revenue.change}
                  trend={data.metrics.revenue.trend}
                  format="currency"
                  icon={DollarSign}
                />
                <MetricCard
                  title="Orders"
                  value={data.metrics.orders.current}
                  change={data.metrics.orders.change}
                  trend={data.metrics.orders.trend}
                  format="number"
                  icon={ShoppingCart}
                />
                <MetricCard
                  title="AOV"
                  value={data.metrics.aov.current}
                  change={data.metrics.aov.change}
                  trend={data.metrics.aov.trend}
                  format="currency"
                  icon={BarChart3}
                />
              </>
            )}

            {(metricFilter === 'all' || metricFilter === 'traffic') && (
              <>
                <MetricCard
                  title="Sessions"
                  value={data.metrics.sessions.current}
                  change={data.metrics.sessions.change}
                  trend={data.metrics.sessions.trend}
                  format="number"
                  icon={Eye}
                />
                <MetricCard
                  title="Customers"
                  value={data.metrics.customers.current}
                  change={data.metrics.customers.change}
                  trend={data.metrics.customers.trend}
                  format="number"
                  icon={Users}
                />
              </>
            )}

            {(metricFilter === 'all' || metricFilter === 'conversion') && (
              <MetricCard
                title="Conversion"
                value={data.metrics.conversion.current}
                change={data.metrics.conversion.change}
                trend={data.metrics.conversion.trend}
                format="percentage"
                icon={TrendingUp}
              />
            )}
          </div>
        )}

        {/* Charts Section */}
        {data && data.hasRealData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium">Revenue Trend</h3>
                <p className="text-sm text-gray-500">Daily performance over the selected period</p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.charts.revenue_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        name === 'revenue' ? formatCurrency(value) : value,
                        name === 'revenue' ? 'Revenue' : 'Orders'
                      ]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={2} />
                    <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium">Traffic Sources</h3>
                <p className="text-sm text-gray-500">Session breakdown by source</p>
              </div>
              <div className="p-6">
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPieChart>
                    <Pie
                      data={data.charts.traffic_sources}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percentage }) => `${name} ${percentage}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="sessions"
                    >
                      {data.charts.traffic_sources.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={['#3B82F6', '#10B981', '#F59E0B', '#EF4444'][index % 4]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-12">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Chart Data</h3>
                <p className="text-gray-500">Revenue charts will appear once you have transaction data</p>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Traffic Data</h3>
                <p className="text-gray-500">Traffic analysis will appear once you connect analytics</p>
              </div>
            </div>
          </div>
        )}

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium">AI Insights</h3>
                <p className="text-sm text-gray-500">
                  {data?.insights.length 
                    ? `${data.insights.length} insights available`
                    : 'Insights will appear as data is collected'
                  }
                </p>
              </div>
              <div className="p-6">
                {data?.insights.length ? (
                  <InsightsList insights={data.insights} />
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Insights Yet</h3>
                    <p className="text-gray-500">
                      AI insights will be generated as your business data grows
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium">Connected Integrations</h3>
                <p className="text-sm text-gray-500">
                  {data?.integrations.length 
                    ? `${data.integrations.length} connected`
                    : 'No integrations connected'
                  }
                </p>
              </div>
              <div className="p-6">
                {data?.integrations.length ? (
                  <div className="space-y-3">
                    {data.integrations.map((integration) => (
                      <div key={integration.id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={cn(
                            "w-2 h-2 rounded-full",
                            integration.status === 'active' ? 'bg-green-500' : 'bg-red-500'
                          )}></div>
                          <span className="text-sm font-medium capitalize">{integration.platform}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {integration.lastSyncAt 
                            ? `${new Date(integration.lastSyncAt).toLocaleDateString()}`
                            : 'Never synced'
                          }
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                      <Activity className="h-6 w-6 text-blue-600" />
                    </div>
                    <h3 className="text-sm font-medium text-gray-900 mb-2">Connect Your First Integration</h3>
                    <p className="text-xs text-gray-500 mb-4">
                      Start by connecting Shopify, Stripe, or Google Analytics
                    </p>
                    <a
                      href="/dashboard/integrations"
                      className="inline-flex items-center px-3 py-2 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700"
                    >
                      Add Integration
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}