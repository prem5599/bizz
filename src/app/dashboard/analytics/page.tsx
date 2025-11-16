// src/app/dashboard/analytics/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { MetricCard } from '@/components/layout/MetricCard'
import { ExportButton } from '@/components/export/ExportButton'
import { 
  BarChart3, 
  TrendingUp, 
  Calendar, 
  Download, 
  Filter, 
  RefreshCw,
  ArrowRight,
  ShoppingCart,
  Users,
  Globe,
  Percent,
  DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts'

// Define data structure for analytics data
interface AnalyticsData {
  metrics: {
    currentPeriod: {
      revenue: number;
      orders: number;
      customers: number;
      sessions: number;
      conversion: number;
      aov: number;
    };
    previousPeriod: {
      revenue: number;
      orders: number;
      customers: number;
      sessions: number;
      conversion: number;
      aov: number;
    };
    changes: {
      revenue: number;
      orders: number;
      customers: number;
      sessions: number;
      conversion: number;
      aov: number;
    };
  };
  charts: {
    revenueOverTime: Array<{
      date: string;
      revenue: number;
      orders: number;
    }>;
    trafficSources: Array<{
      source: string;
      sessions: number;
      percentage: number;
    }>;
    conversionByDevice: Array<{
      device: string;
      conversion: number;
      orders: number;
    }>;
    topProducts: Array<{
      name: string;
      revenue: number;
      orders: number;
    }>;
  };
}

// Sample data for development/testing
const mockAnalyticsData: AnalyticsData = {
  metrics: {
    currentPeriod: {
      revenue: 45000,
      orders: 182,
      customers: 145,
      sessions: 2847,
      conversion: 6.4,
      aov: 247.25
    },
    previousPeriod: {
      revenue: 38000,
      orders: 156,
      customers: 123,
      sessions: 2456,
      conversion: 6.1,
      aov: 243.59
    },
    changes: {
      revenue: 18.4,
      orders: 16.7,
      customers: 17.9,
      sessions: 15.9,
      conversion: 4.9,
      aov: 1.5
    }
  },
  charts: {
    revenueOverTime: [
      { date: '2024-01-01', revenue: 35000, orders: 145 },
      { date: '2024-01-08', revenue: 42000, orders: 168 },
      { date: '2024-01-15', revenue: 38000, orders: 152 },
      { date: '2024-01-22', revenue: 45000, orders: 182 },
      { date: '2024-01-29', revenue: 48000, orders: 195 },
    ],
    trafficSources: [
      { source: 'Organic Search', sessions: 1423, percentage: 50 },
      { source: 'Direct', sessions: 854, percentage: 30 },
      { source: 'Social Media', sessions: 427, percentage: 15 },
      { source: 'Paid Ads', sessions: 143, percentage: 5 },
    ],
    conversionByDevice: [
      { device: 'Desktop', conversion: 7.2, orders: 98 },
      { device: 'Mobile', conversion: 5.8, orders: 56 },
      { device: 'Tablet', conversion: 6.1, orders: 28 },
    ],
    topProducts: [
      { name: 'Premium Plan', revenue: 15000, orders: 45 },
      { name: 'Basic Plan', revenue: 12000, orders: 68 },
      { name: 'Enterprise Plan', revenue: 18000, orders: 25 },
    ]
  }
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

export default function AnalyticsPage() {
  const { data: session } = useSession()
  const [data, setData] = useState<AnalyticsData>(mockAnalyticsData)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState('30d')
  const [selectedMetric, setSelectedMetric] = useState('revenue')
  const [organizationId, setOrganizationId] = useState<string | null>(null)

  useEffect(() => {
    // Fetch organization ID
    const fetchOrganization = async () => {
      try {
        const response = await fetch('/api/organizations/current')
        if (response.ok) {
          const data = await response.json()
          setOrganizationId(data.organization.id)
        }
      } catch (error) {
        console.error('Failed to fetch organization:', error)
      }
    }

    if (session?.user?.id) {
      fetchOrganization()
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (organizationId) {
      fetchAnalyticsData()
    }
  }, [dateRange, organizationId])

  const fetchAnalyticsData = async () => {
    if (!organizationId) return
    
    setLoading(true)
    try {
      console.log('🔄 Fetching analytics data for:', organizationId, 'range:', dateRange)
      
      const response = await fetch(`/api/analytics?range=${dateRange}&organizationId=${organizationId}`, {
        credentials: 'include'
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('✅ Analytics data received:', result)
      
      if (result.success) {
        setData(result)
      } else {
        throw new Error(result.error || 'Failed to load analytics data')
      }
    } catch (error) {
      console.error('❌ Failed to fetch analytics data:', error)
      // Fallback to mock data on error
      setData(mockAnalyticsData)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = () => {
    fetchAnalyticsData()
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        
        {/* Page Header */}
        <div className="border-b border-slate-200 pb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Analytics</h1>
              <p className="mt-2 text-sm text-slate-600">
                Detailed insights into your business performance and metrics
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <select 
                value={dateRange} 
                onChange={(e) => setDateRange(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
                Refresh
              </button>
              {organizationId && (
                <ExportButton
                  exportType="analytics"
                  organizationId={organizationId}
                  variant="default"
                  size="md"
                  showLabel={true}
                  customLabel="Export"
                />
              )}
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <MetricCard
            title="Revenue"
            value={data.metrics.currentPeriod.revenue}
            change={data.metrics.changes.revenue}
            trend={data.metrics.changes.revenue > 0 ? 'up' : 'down'}
            format="currency"
            icon={DollarSign}
            isLoading={loading}
          />
          <MetricCard
            title="Orders"
            value={data.metrics.currentPeriod.orders}
            change={data.metrics.changes.orders}
            trend={data.metrics.changes.orders > 0 ? 'up' : 'down'}
            format="number"
            icon={ShoppingCart}
            isLoading={loading}
          />
          <MetricCard
            title="Customers"
            value={data.metrics.currentPeriod.customers}
            change={data.metrics.changes.customers}
            trend={data.metrics.changes.customers > 0 ? 'up' : 'down'}
            format="number"
            icon={Users}
            isLoading={loading}
          />
          <MetricCard
            title="Sessions"
            value={data.metrics.currentPeriod.sessions}
            change={data.metrics.changes.sessions}
            trend={data.metrics.changes.sessions > 0 ? 'up' : 'down'}
            format="number"
            icon={Globe}
            isLoading={loading}
          />
          <MetricCard
            title="Conversion Rate"
            value={data.metrics.currentPeriod.conversion}
            change={data.metrics.changes.conversion}
            trend={data.metrics.changes.conversion > 0 ? 'up' : 'down'}
            format="percentage"
            icon={Percent}
            isLoading={loading}
          />
          <MetricCard
            title="AOV"
            value={data.metrics.currentPeriod.aov}
            change={data.metrics.changes.aov}
            trend={data.metrics.changes.aov > 0 ? 'up' : 'down'}
            format="currency"
            icon={TrendingUp}
            isLoading={loading}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Revenue Over Time Chart */}
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-900">Revenue Over Time</h3>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.charts.revenueOverTime}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    stroke="#64748b"
                    fontSize={12}
                    tickFormatter={(value) => `₹${value.toLocaleString()}`}
                  />
                  <Tooltip 
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#3B82F6" 
                    strokeWidth={3}
                    dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3B82F6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Traffic Sources Chart */}
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-900">Traffic Sources</h3>
              <Globe className="h-5 w-5 text-slate-400" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.charts.trafficSources}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ source, percentage }) => `${source} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="sessions"
                  >
                    {data.charts.trafficSources.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString(), 'Sessions']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Conversion by Device Chart */}
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-900">Conversion by Device</h3>
              <BarChart3 className="h-5 w-5 text-slate-400" />
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.conversionByDevice}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="device" stroke="#64748b" fontSize={12} />
                  <YAxis stroke="#64748b" fontSize={12} tickFormatter={(value) => `${value}%`} />
                  <Tooltip 
                    formatter={(value: number) => [`${value}%`, 'Conversion Rate']}
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                    }}
                  />
                  <Bar dataKey="conversion" fill="#10B981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white p-6 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-900">Top Products</h3>
              <TrendingUp className="h-5 w-5 text-slate-400" />
            </div>
            <div className="space-y-4">
              {data.charts.topProducts.map((product, index) => (
                <div key={product.name} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={cn(
                      "w-3 h-3 rounded-full",
                      index === 0 && "bg-blue-500",
                      index === 1 && "bg-green-500", 
                      index === 2 && "bg-yellow-500"
                    )} />
                    <div>
                      <p className="text-sm font-medium text-slate-900">{product.name}</p>
                      <p className="text-xs text-slate-500">{product.orders} orders</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-900">{formatCurrency(product.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Cards */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-medium text-blue-900 mb-2">Ready to dive deeper?</h3>
              <p className="text-blue-700 mb-4">
                Get AI-powered insights and actionable recommendations to grow your business.
              </p>
              <div className="flex flex-wrap gap-3">
                <button className="flex items-center px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50">
                  <ArrowRight className="h-4 w-4 mr-2" />
                  View Reports
                </button>
                {organizationId && (
                  <ExportButton
                    exportType="analytics"
                    organizationId={organizationId}
                    variant="default"
                    size="md"
                    showLabel={true}
                    customLabel="Export Data"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}