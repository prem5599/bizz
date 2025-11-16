// src/components/dashboard/InsightsList.tsx
'use client'

import { useState } from 'react'
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Target, 
  Eye, 
  EyeOff, 
  X,
  Clock,
  Star,
  CheckCircle,
  Info
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Insight {
  id: string
  type: string
  title: string
  description: string
  impactScore: number
  isRead: boolean
  createdAt: string
  relativeTime?: string
  impactLevel?: string
  typeDisplayName?: string
  metadata?: Record<string, any>
}

interface InsightsListProps {
  insights: Insight[]
  onMarkAsRead?: (insightId: string, isRead?: boolean) => void
  onDismiss?: (insightId: string) => void
  isLoading?: boolean
  emptyMessage?: string
  showActions?: boolean
  compact?: boolean
  maxItems?: number
}

export function InsightsList({
  insights,
  onMarkAsRead,
  onDismiss,
  isLoading = false,
  emptyMessage = "No insights available",
  showActions = true,
  compact = false,
  maxItems
}: InsightsListProps) {
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set())

  const displayedInsights = maxItems ? insights.slice(0, maxItems) : insights
  const visibleInsights = displayedInsights.filter(insight => !dismissedItems.has(insight.id))

  const getInsightIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'trend':
        return <TrendingUp className="h-5 w-5 text-blue-500" />
      case 'opportunity':
        return <Target className="h-5 w-5 text-green-500" />
      case 'alert':
      case 'anomaly':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />
      case 'recommendation':
        return <Lightbulb className="h-5 w-5 text-purple-500" />
      default:
        return <Info className="h-5 w-5 text-gray-500" />
    }
  }

  const getImpactBadge = (score: number) => {
    if (score >= 80) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">High Impact</span>
    } else if (score >= 60) {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Medium Impact</span>
    } else {
      return <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Low Impact</span>
    }
  }

  const getTypeDisplayName = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'trend': return 'Trend Analysis'
      case 'opportunity': return 'Growth Opportunity'
      case 'alert': return 'Alert'
      case 'anomaly': return 'Anomaly Detected'
      case 'recommendation': return 'Recommendation'
      default: return type.charAt(0).toUpperCase() + type.slice(1)
    }
  }

  const getRelativeTime = (createdAt: string): string => {
    const now = new Date()
    const created = new Date(createdAt)
    const diffMs = now.getTime() - created.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return created.toLocaleDateString()
  }

  const handleMarkAsRead = (insightId: string) => {
    onMarkAsRead?.(insightId, true)
  }

  const handleMarkAsUnread = (insightId: string) => {
    onMarkAsRead?.(insightId, false)
  }

  const handleDismiss = (insightId: string) => {
    setDismissedItems(prev => new Set(prev).add(insightId))
    onDismiss?.(insightId)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (visibleInsights.length === 0) {
    return (
      <div className="text-center py-8">
        <Lightbulb className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">{emptyMessage}</h3>
        <p className="text-gray-500">
          {emptyMessage === "No insights available" 
            ? "Connect your integrations to start generating insights" 
            : "Check back later for new insights about your business"
          }
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleInsights.map((insight) => (
        <div
          key={insight.id}
          className={cn(
            "bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow duration-200",
            !insight.isRead && "ring-2 ring-blue-100 border-blue-200",
            compact && "p-3"
          )}
        >
          <div className="flex items-start space-x-3">
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5">
              {getInsightIcon(insight.type)}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Header */}
              <div className="flex items-start justify-between space-x-3 mb-2">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h4 className={cn(
                      "text-sm font-medium text-gray-900 truncate",
                      !insight.isRead && "font-semibold"
                    )}>
                      {insight.title}
                    </h4>
                    {!insight.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 mb-2">
                    <span className="text-xs text-gray-500">
                      {insight.typeDisplayName || getTypeDisplayName(insight.type)}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-xs text-gray-500">
                      {insight.relativeTime || getRelativeTime(insight.createdAt)}
                    </span>
                  </div>
                </div>
                
                {/* Impact badge */}
                {!compact && (
                  <div className="flex-shrink-0">
                    {getImpactBadge(insight.impactScore)}
                  </div>
                )}
              </div>

              {/* Description */}
              <p className={cn(
                "text-sm text-gray-600 leading-relaxed",
                compact ? "line-clamp-2" : "line-clamp-3"
              )}>
                {insight.description}
              </p>

              {/* Actions */}
              {showActions && (
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center space-x-2">
                    {/* Impact score */}
                    <div className="flex items-center space-x-1">
                      <Star className="h-3 w-3 text-yellow-400" />
                      <span className="text-xs text-gray-500">{insight.impactScore}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1">
                    {/* Mark as read/unread */}
                    {insight.isRead ? (
                      <button
                        onClick={() => handleMarkAsUnread(insight.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded transition-colors"
                        title="Mark as unread"
                      >
                        <EyeOff className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleMarkAsRead(insight.id)}
                        className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Mark as read"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}

                    {/* Dismiss */}
                    <button
                      onClick={() => handleDismiss(insight.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Dismiss insight"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {/* Show more button */}
      {maxItems && insights.length > maxItems && (
        <div className="text-center pt-4">
          <button className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            View all {insights.length} insights →
          </button>
        </div>
      )}
    </div>
  )
}