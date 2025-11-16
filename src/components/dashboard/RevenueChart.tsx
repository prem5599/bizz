// src/components/dashboard/RevenueChart.tsx
'use client'

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts'
import { 
  TrendingUp, 
  TrendingDown, 
  BarChart3,
  Calendar,
  DollarSign,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChartDataPoint {
  date: string
  revenue: number
  orders: number
  customers: number
  previousRevenue?: number
  label?: string
}

interface RevenueChartProps {
  data: ChartDataPoint[]
  loading?: boolean
  period?: 'today' | '7d' | '30d' | '90d' | '1y'
  showComparison?: boolean
  chartType?: 'area' | 'line' | 'bar'
  height?: number
}

interface ChartControlsProps {
  period: string
  chartType: string
  onPeriodChange: (period: string) => void
  onChartTypeChange: (type: string) => void
}

// Sample data generator for demo purposes
function generateSampleData(days: number): ChartDataPoint[] {
  const data: ChartDataPoint[] = []
  const now = new Date()
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const baseRevenue = 1000 + Math.random() * 2000
    const trend = Math.sin((i / days) * Math.PI * 2) * 500
    const noise = (Math.random() - 0.5) * 400
    
    data.push({
      date: date.toISOString().split('T')[0],
      revenue: Math.max(0, baseRevenue + trend + noise),
      orders: Math.floor(10 + Math.random() * 30),
      customers: Math.floor(5 + Math.random() * 20),
      previousRevenue: Math.max(0, baseRevenue + trend + noise * 0.8),
      label: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      })
    })
  }
  
  return data
}

// Custom tooltip component
function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
        <p className="font-medium text-gray-900 mb-2">{data.label || label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between space-x-4">
              <div className="flex items-center space-x-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-sm text-gray-600">{entry.name}:</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {entry.name.toLowerCase().includes('revenue') 
                  ? `${entry.value.toLocaleString()}`
                  : entry.value.toLocaleString()
                }
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// Chart controls component
function ChartControls({ period, chartType, onPeriodChange, onChartTypeChange }: ChartControlsProps) {
  const periods = [
    { value: 'today', label: 'Today' },
    { value: '7d', label: '7 days' },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: '1y', label: '1 year' }
  ]

  const chartTypes = [
    { value: 'area', label: 'Area', icon: <AreaChart className="h-4 w-4" /> },
    { value: 'line', label: 'Line', icon: <TrendingUp className="h-4 w-4" /> },
    { value: 'bar', label: 'Bar', icon: <BarChart3 className="h-4 w-4" /> }
  ]

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
        {periods.map((p) => (
          <button
            key={p.value}
            onClick={() => onPeriodChange(p.value)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              period === p.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
        {chartTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => onChartTypeChange(type.value)}
            className={cn(
              "inline-flex items-center space-x-1 px-2 py-1.5 text-sm font-medium rounded-md transition-colors",
              chartType === type.value
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            {type.icon}
            <span className="hidden sm:inline">{type.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function RevenueChart({ 
  data = [], 
  loading = false, 
  period = '30d',
  showComparison = false,
  chartType = 'area',
  height = 400 
}: RevenueChartProps) {
  const [selectedPeriod, setSelectedPeriod] = React.useState(period)
  const [selectedChartType, setSelectedChartType] = React.useState(chartType)

  // Generate sample data if no data provided
  const chartData = useMemo(() => {
    if (data.length > 0) return data
    
    const days = selectedPeriod === 'today' ? 1 : 
                selectedPeriod === '7d' ? 7 :
                selectedPeriod === '30d' ? 30 :
                selectedPeriod === '90d' ? 90 : 365
    
    return generateSampleData(days)
  }, [data, selectedPeriod])

  // Calculate summary stats
  const totalRevenue = chartData.reduce((sum, point) => sum + point.revenue, 0)
  const previousRevenue = chartData.reduce((sum, point) => sum + (point.previousRevenue || 0), 0)
  const revenueChange = totalRevenue - previousRevenue
  const revenueChangePercent = previousRevenue > 0 ? (revenueChange / previousRevenue) * 100 : 0
  const isPositiveChange = revenueChange > 0

  // Format Y-axis values
  const formatYAxis = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return `${value}`
  }

  // Format X-axis values
  const formatXAxis = (tickItem: string) => {
    const date = new Date(tickItem)
    if (selectedPeriod === 'today') {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    if (selectedPeriod === '7d') {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    }
    if (selectedPeriod === '1y') {
      return date.toLocaleDateString('en-US', { month: 'short' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <div className="h-6 bg-gray-200 rounded w-32 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
            </div>
            <div className="h-8 bg-gray-200 rounded w-24 animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gray-100 rounded animate-pulse"></div>
        </CardContent>
      </Card>
    )
  }

  const renderChart = () => {
    const commonProps = {
      data: chartData,
      margin: { top: 5, right: 30, left: 20, bottom: 5 }
    }

    switch (selectedChartType) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatYAxis}
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="revenue" 
              stroke="#3b82f6" 
              strokeWidth={2}
              dot={{ fill: '#3b82f6', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2, fill: 'white' }}
              name="Revenue"
            />
            {showComparison && (
              <Line 
                type="monotone" 
                dataKey="previousRevenue" 
                stroke="#9ca3af" 
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="Previous Period"
              />
            )}
          </LineChart>
        )

      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatYAxis}
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="revenue" 
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
              name="Revenue"
            />
            {showComparison && (
              <Bar 
                dataKey="previousRevenue" 
                fill="#e5e7eb"
                radius={[2, 2, 0, 0]}
                name="Previous Period"
              />
            )}
          </BarChart>
        )

      default: // area
        return (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPrevious" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#9ca3af" stopOpacity={0.2}/>
                <stop offset="95%" stopColor="#9ca3af" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis 
              dataKey="date" 
              tickFormatter={formatXAxis}
              stroke="#6b7280"
              fontSize={12}
            />
            <YAxis 
              tickFormatter={formatYAxis}
              stroke="#6b7280"
              fontSize={12}
            />
            <Tooltip content={<CustomTooltip />} />
            {showComparison && (
              <Area
                type="monotone"
                dataKey="previousRevenue"
                stroke="#9ca3af"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorPrevious)"
                strokeDasharray="4 4"
                name="Previous Period"
              />
            )}
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorRevenue)"
              name="Revenue"
            />
          </AreaChart>
        )
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5" />
              <span>Revenue</span>
            </CardTitle>
            <div className="flex items-center space-x-4 mt-2">
              <div className="text-2xl font-bold text-gray-900">
                ${totalRevenue.toLocaleString()}
              </div>
              <div className="flex items-center space-x-1">
                {isPositiveChange ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
                <span className={cn(
                  "text-sm font-medium",
                  isPositiveChange ? "text-green-600" : "text-red-600"
                )}>
                  {isPositiveChange ? '+' : ''}{revenueChangePercent.toFixed(1)}%
                </span>
                <span className="text-sm text-gray-500">vs previous period</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="mt-4">
          <ChartControls
            period={selectedPeriod}
            chartType={selectedChartType}
            onPeriodChange={setSelectedPeriod}
            onChartTypeChange={setSelectedChartType}
          />
        </div>
      </CardHeader>
      
      <CardContent>
        <div style={{ width: '100%', height }}>
          <ResponsiveContainer>
            {renderChart()}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

// Compact version for smaller spaces
export function CompactRevenueChart({ data, loading, height = 200 }: Omit<RevenueChartProps, 'period' | 'showComparison' | 'chartType'>) {
  const chartData = useMemo(() => {
    if (data && data.length > 0) return data
    return generateSampleData(7)
  }, [data])

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
        <div className="h-40 bg-gray-100 rounded animate-pulse"></div>
      </div>
    )
  }

  const totalRevenue = chartData.reduce((sum, point) => sum + point.revenue, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900">Revenue</h3>
        <span className="text-lg font-bold text-gray-900">
          ${totalRevenue.toLocaleString()}
        </span>
      </div>
      
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <defs>
              <linearGradient id="miniColorRevenue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#3b82f6" 
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#miniColorRevenue)"
            />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2 border border-gray-200 rounded shadow-lg">
                      <p className="text-sm font-medium">
                        ${payload[0].value?.toLocaleString()}
                      </p>
                    </div>
                  )
                }
                return null
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default RevenueChart