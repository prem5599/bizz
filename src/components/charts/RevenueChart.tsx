// src/components/charts/RevenueChart.tsx
'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { formatCurrency } from '@/lib/utils'

interface RevenueDataPoint {
  date: string
  total_revenue: number
  orders?: number
}

interface RevenueChartProps {
  data: RevenueDataPoint[]
  isLoading?: boolean
  height?: number
  showOrders?: boolean
}

export function RevenueChart({ 
  data, 
  isLoading = false, 
  height = 300,
  showOrders = false 
}: RevenueChartProps) {
  
  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-50 rounded-lg"
        style={{ height }}
      >
        <div className="animate-pulse text-slate-500">
          Loading chart data...
        </div>
      </div>
    )
  }

  if (!data || data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-50 rounded-lg"
        style={{ height }}
      >
        <div className="text-center text-slate-500">
          <div className="text-sm">No revenue data available</div>
          <div className="text-xs mt-1">Connect your integrations to see data</div>
        </div>
      </div>
    )
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <div className="text-sm font-medium text-slate-900 mb-2">
            {new Date(label).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
          <div className="space-y-1">
            <div className="flex items-center">
              <div 
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: '#3b82f6' }}
              />
              <span className="text-sm text-slate-600">Revenue:</span>
              <span className="text-sm font-medium text-slate-900 ml-1">
                {formatCurrency(payload[0].value)}
              </span>
            </div>
            {showOrders && payload[1] && (
              <div className="flex items-center">
                <div 
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: '#10b981' }}
                />
                <span className="text-sm text-slate-600">Orders:</span>
                <span className="text-sm font-medium text-slate-900 ml-1">
                  {payload[1].value}
                </span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  // Format date for x-axis
  const formatXAxisLabel = (tickItem: string) => {
    const date = new Date(tickItem)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  // Format y-axis values
  const formatYAxisLabel = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value}`
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 10,
            left: 10,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="date"
            tickFormatter={formatXAxisLabel}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis 
            tickFormatter={formatYAxisLabel}
            stroke="#64748b"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="total_revenue"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
          />
          {showOrders && (
            <Line
              type="monotone"
              dataKey="orders"
              stroke="#10b981"
              strokeWidth={2}
              dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}