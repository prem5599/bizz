// src/components/layout/MetricCardWithContext.tsx
'use client'

import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrencyFormatter } from '@/contexts/CurrencyContext'

interface MetricCardProps {
  title: string
  value: number | string
  change?: number
  trend?: 'up' | 'down' | 'neutral'
  format?: 'currency' | 'number' | 'percentage'
  icon?: LucideIcon
  description?: string
  isLoading?: boolean
  className?: string
  prefix?: string
  suffix?: string
}

export function MetricCard({
  title,
  value,
  change,
  trend,
  format = 'number',
  icon: Icon,
  description,
  isLoading = false,
  className,
  prefix,
  suffix
}: MetricCardProps) {
  const { formatMetric, currency } = useCurrencyFormatter()
  
  const formatValue = (val: number | string, format: string): string => {
    if (typeof val === 'string') return val
    
    // Use the context-aware formatter
    return formatMetric(val, format as 'currency' | 'number' | 'percentage')
  }

  const formatChange = (change: number): string => {
    const sign = change > 0 ? '+' : ''
    return `${sign}${change.toFixed(1)}%`
  }

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />
      default:
        return <Minus className="h-4 w-4 text-gray-400" />
    }
  }

  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-600'
      case 'down':
        return 'text-red-600'
      default:
        return 'text-gray-500'
    }
  }

  if (isLoading) {
    return (
      <div className={cn("bg-white rounded-lg shadow border p-6 animate-pulse", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
          <div className="h-4 w-4 bg-gray-200 rounded"></div>
        </div>
        <div className="h-8 bg-gray-200 rounded w-24 mb-2"></div>
        <div className="h-4 bg-gray-200 rounded w-16"></div>
      </div>
    )
  }

  return (
    <div className={cn(
      "bg-white rounded-lg shadow border p-6 hover:shadow-md transition-shadow",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        {Icon && <Icon className="h-4 w-4 text-gray-400" />}
      </div>

      {/* Value */}
      <div className="mb-2">
        <div className="text-2xl font-bold text-gray-900">
          {prefix}{formatValue(value, format)}{suffix}
        </div>
        {format === 'currency' && (
          <div className="text-xs text-gray-500 mt-1">
            Currency: {currency}
          </div>
        )}
      </div>

      {/* Change indicator */}
      {change !== undefined && (
        <div className="flex items-center">
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
            <span className={cn("text-sm font-medium", getTrendColor())}>
              {formatChange(change)}
            </span>
          </div>
          <span className="text-sm text-gray-500 ml-2">vs previous period</span>
        </div>
      )}

      {/* Description */}
      {description && (
        <p className="text-xs text-gray-500 mt-2">{description}</p>
      )}
    </div>
  )
}