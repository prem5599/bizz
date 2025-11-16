// src/components/dashboard/MetricsCards.tsx
'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Target,
  CreditCard,
  BarChart3,
  Minus
} from 'lucide-react'


interface MetricValue {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
}

interface MetricsData {
  revenue: MetricValue
  orders: MetricValue
  customers: MetricValue
  conversionRate: MetricValue
  averageOrderValue: MetricValue
  sessions: MetricValue
}

interface MetricsCardsProps {
  data: MetricsData
  loading?: boolean
  period?: string
}

interface MetricCardProps {
  title: string
  value: string | number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
  icon: React.ReactNode
  prefix?: string
  suffix?: string
  format?: 'currency' | 'number' | 'percentage'
  loading?: boolean
}

function formatValue(value: number, format: 'currency' | 'number' | 'percentage' = 'number', prefix = '', suffix = ''): string {
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(value)
    case 'percentage':
      return `${value.toFixed(1)}%`
    case 'number':
      if (value >= 1000000) {
        return `${prefix}${(value / 1000000).toFixed(1)}M${suffix}`
      } else if (value >= 1000) {
        return `${prefix}${(value / 1000).toFixed(1)}K${suffix}`
      } else {
        return `${prefix}${Math.round(value).toLocaleString()}${suffix}`
      }
    default:
      return `${prefix}${value.toLocaleString()}${suffix}`
  }
}

function MetricCard({ 
  title, 
  value, 
  changePercent, 
  trend, 
  icon, 
  format = 'number',
  loading = false 
}: MetricCardProps) {
  const isPositiveChange = trend === 'up'
  const isNegativeChange = trend === 'down'
  const isNeutralChange = trend === 'neutral'

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
          </CardTitle>
          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
        </CardContent>
      </Card>
    )
  }

  const formattedValue = typeof value === 'string' ? value : formatValue(value as number, format)
  const formattedChange = Math.abs(changePercent)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <div className="h-4 w-4 text-gray-400">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900 mb-1">
          {formattedValue}
        </div>
        <div className="flex items-center text-xs">
          {isPositiveChange && (
            <>
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-green-600 font-medium">+{formattedChange.toFixed(1)}%</span>
            </>
          )}
          {isNegativeChange && (
            <>
              <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
              <span className="text-red-600 font-medium">-{formattedChange.toFixed(1)}%</span>
            </>
          )}
          {isNeutralChange && (
            <>
              <Minus className="h-3 w-3 text-gray-400 mr-1" />
              <span className="text-gray-500 font-medium">0.0%</span>
            </>
          )}
          <span className="text-gray-500 ml-1">vs last period</span>
        </div>
      </CardContent>
    </Card>
  )
}

export function MetricsCards({ data, loading = false, period = '30 days' }: MetricsCardsProps) {
  const metrics = [
    {
      title: 'Total Revenue',
      value: data.revenue.current,
      change: data.revenue.change,
      changePercent: data.revenue.changePercent,
      trend: data.revenue.trend,
      icon: <DollarSign className="h-4 w-4" />,
      format: 'currency' as const
    },
    {
      title: 'Orders',
      value: data.orders.current,
      change: data.orders.change,
      changePercent: data.orders.changePercent,
      trend: data.orders.trend,
      icon: <ShoppingCart className="h-4 w-4" />,
      format: 'number' as const
    },
    {
      title: 'Customers',
      value: data.customers.current,
      change: data.customers.change,
      changePercent: data.customers.changePercent,
      trend: data.customers.trend,
      icon: <Users className="h-4 w-4" />,
      format: 'number' as const
    },
    {
      title: 'Conversion Rate',
      value: data.conversionRate.current,
      change: data.conversionRate.change,
      changePercent: data.conversionRate.changePercent,
      trend: data.conversionRate.trend,
      icon: <Target className="h-4 w-4" />,
      format: 'percentage' as const
    },
    {
      title: 'Avg Order Value',
      value: data.averageOrderValue.current,
      change: data.averageOrderValue.change,
      changePercent: data.averageOrderValue.changePercent,
      trend: data.averageOrderValue.trend,
      icon: <CreditCard className="h-4 w-4" />,
      format: 'currency' as const
    },
    {
      title: 'Sessions',
      value: data.sessions.current,
      change: data.sessions.change,
      changePercent: data.sessions.changePercent,
      trend: data.sessions.trend,
      icon: <BarChart3 className="h-4 w-4" />,
      format: 'number' as const
    }
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Key Metrics</h2>
        <span className="text-sm text-gray-500">Last {period}</span>
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map((metric, index) => (
          <MetricCard
            key={index}
            title={metric.title}
            value={metric.value}
            change={metric.change}
            changePercent={metric.changePercent}
            trend={metric.trend}
            icon={metric.icon}
            format={metric.format}
            loading={loading}
          />
        ))}
      </div>
    </div>
  )
}

// Alternative compact version for smaller spaces
export function CompactMetricsCards({ data, loading = false }: Omit<MetricsCardsProps, 'period'>) {
  const topMetrics = [
    {
      title: 'Revenue',
      value: data.revenue.current,
      changePercent: data.revenue.changePercent,
      trend: data.revenue.trend,
      icon: <DollarSign className="h-4 w-4" />,
      format: 'currency' as const
    },
    {
      title: 'Orders',
      value: data.orders.current,
      changePercent: data.orders.changePercent,
      trend: data.orders.trend,
      icon: <ShoppingCart className="h-4 w-4" />,
      format: 'number' as const
    },
    {
      title: 'Customers',
      value: data.customers.current,
      changePercent: data.customers.changePercent,
      trend: data.customers.trend,
      icon: <Users className="h-4 w-4" />,
      format: 'number' as const
    },
    {
      title: 'Conversion',
      value: data.conversionRate.current,
      changePercent: data.conversionRate.changePercent,
      trend: data.conversionRate.trend,
      icon: <Target className="h-4 w-4" />,
      format: 'percentage' as const
    }
  ]

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="h-3 bg-gray-200 rounded w-16 animate-pulse"></div>
                <div className="h-3 w-3 bg-gray-200 rounded animate-pulse"></div>
              </div>
              <div className="h-6 bg-gray-200 rounded w-12 mb-1 animate-pulse"></div>
              <div className="h-3 bg-gray-200 rounded w-10 animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {topMetrics.map((metric, index) => {
        const formattedValue = formatValue(metric.value, metric.format)
        const isPositive = metric.trend === 'up'
        const isNegative = metric.trend === 'down'
        
        return (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-600">{metric.title}</span>
                <div className="text-gray-400">{metric.icon}</div>
              </div>
              <div className="text-lg font-bold text-gray-900 mb-1">
                {formattedValue}
              </div>
              <div className="flex items-center text-xs">
                {isPositive && (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                    <span className="text-green-600 font-medium">
                      +{Math.abs(metric.changePercent).toFixed(1)}%
                    </span>
                  </>
                )}
                {isNegative && (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                    <span className="text-red-600 font-medium">
                      {metric.changePercent.toFixed(1)}%
                    </span>
                  </>
                )}
                {metric.trend === 'neutral' && (
                  <>
                    <Minus className="h-3 w-3 text-gray-400 mr-1" />
                    <span className="text-gray-500 font-medium">0.0%</span>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export default MetricsCards