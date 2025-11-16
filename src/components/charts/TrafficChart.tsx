// src/components/charts/TrafficChart.tsx
'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface TrafficDataPoint {
  source: string
  sessions: number
  percentage?: number
}

interface TrafficChartProps {
  data: TrafficDataPoint[]
  isLoading?: boolean
  height?: number
  chartType?: 'pie' | 'bar'
}

// Color palette for different traffic sources
const COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange-600
]

export function TrafficChart({ 
  data, 
  isLoading = false, 
  height = 300,
  chartType = 'pie'
}: TrafficChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  if (isLoading) {
    return (
      <div 
        className="flex items-center justify-center bg-slate-50 rounded-lg"
        style={{ height }}
      >
        <div className="animate-pulse text-slate-500">
          Loading traffic data...
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
          <div className="text-sm">No traffic data available</div>
          <div className="text-xs mt-1">Connect Google Analytics to see data</div>
        </div>
      </div>
    )
  }

  // Calculate percentages if not provided
  const dataWithPercentages = data.map(item => {
    if (item.percentage !== undefined) return item
    
    const totalSessions = data.reduce((sum, d) => sum + d.sessions, 0)
    return {
      ...item,
      percentage: totalSessions > 0 ? (item.sessions / totalSessions) * 100 : 0
    }
  })

  // Custom tooltip for pie chart
  const PieTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <div className="font-medium text-slate-900 mb-1">
            {data.source}
          </div>
          <div className="text-sm text-slate-600">
            <div>Sessions: <span className="font-medium">{data.sessions.toLocaleString()}</span></div>
            <div>Percentage: <span className="font-medium">{data.percentage.toFixed(1)}%</span></div>
          </div>
        </div>
      )
    }
    return null
  }

  // Custom tooltip for bar chart
  const BarTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <div className="font-medium text-slate-900 mb-1">
            {label}
          </div>
          <div className="text-sm text-slate-600">
            <div>Sessions: <span className="font-medium">{data.sessions.toLocaleString()}</span></div>
            <div>Percentage: <span className="font-medium">{data.percentage.toFixed(1)}%</span></div>
          </div>
        </div>
      )
    }
    return null
  }

  // Custom legend component
  const CustomLegend = ({ payload }: any) => {
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center text-sm">
            <div 
              className="w-3 h-3 rounded-full mr-2"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-600">{entry.value}</span>
            <span className="text-slate-900 font-medium ml-1">
              ({dataWithPercentages[index]?.percentage?.toFixed(1)}%)
            </span>
          </div>
        ))}
      </div>
    )
  }

  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index)
  }

  const onPieLeave = () => {
    setActiveIndex(null)
  }

  if (chartType === 'bar') {
    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={dataWithPercentages}
            margin={{
              top: 20,
              right: 30,
              left: 20,
              bottom: 5,
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis 
              dataKey="source"
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              stroke="#64748b"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<BarTooltip />} />
            <Bar 
              dataKey="sessions" 
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="w-full">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={dataWithPercentages}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={Math.min(height * 0.35, 120)}
            fill="#8884d8"
            dataKey="sessions"
            onMouseEnter={onPieEnter}
            onMouseLeave={onPieLeave}
          >
            {dataWithPercentages.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={COLORS[index % COLORS.length]}
                stroke={activeIndex === index ? '#1f2937' : 'none'}
                strokeWidth={activeIndex === index ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip content={<PieTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
      
      {/* Summary stats below chart */}
      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-sm text-slate-600">Total Sessions</div>
          <div className="text-lg font-semibold text-slate-900">
            {dataWithPercentages.reduce((sum, item) => sum + item.sessions, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-sm text-slate-600">Top Source</div>
          <div className="text-lg font-semibold text-slate-900">
            {dataWithPercentages[0]?.source || 'N/A'}
          </div>
        </div>
      </div>
    </div>
  )
}