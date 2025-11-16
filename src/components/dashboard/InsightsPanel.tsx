// src/components/dashboard/InsightsPanel.tsx
'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Lightbulb, 
  TrendingUp, 
  AlertTriangle, 
  Target,
  Eye,
  EyeOff,
  ChevronRight,
  Star,
  Clock,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DashboardInsight {
  id: string
  type: 'trend' | 'anomaly' | 'recommendation'
  title: string
  description: string
  impactScore: number
  isRead: boolean
  createdAt: string
  metadata: Record<string, any>
}

interface InsightsPanelProps {
  insights: DashboardInsight[]
  loading?: boolean
  onMarkAsRead?: (insightId: string) => void
  onViewAll?: () => void
  showAll?: boolean
}

interface InsightItemProps {
  insight: DashboardInsight
  onMarkAsRead?: (insightId: string) => void
  compact?: boolean
}

function getInsightIcon(type: string, impactScore: number): React.ReactNode {
  switch (type) {
    case 'trend':
      return <TrendingUp className="h-4 w-4" />
    case 'anomaly':
      return <AlertTriangle className="h-4 w-4" />
    case 'recommendation':
      return <Target className="h-4 w-4" />
    default:
      return <Lightbulb className="h-4 w-4" />
  }
}

function getInsightColor(type: string, impactScore: number): string {
  const baseColors = {
    trend: 'blue',
    anomaly: 'yellow',
    recommendation: 'green'
  }
  
  const color = baseColors[type as keyof typeof baseColors] || 'gray'
  const intensity = impactScore >= 7 ? '600' : impactScore >= 4 ? '500' : '400'
  
  return `text-${color}-${intensity} bg-${color}-50 border-${color}-200`
}

function getImpactLevel(score: number): { label: string; color: string } {
  if (score >= 8) return { label: 'High', color: 'text-red-600 bg-red-50' }
  if (score >= 6) return { label: 'Medium', color: 'text-yellow-600 bg-yellow-50' }
  if (score >= 4) return { label: 'Low', color: 'text-green-600 bg-green-50' }
  return { label: 'Info', color: 'text-gray-600 bg-gray-50' }
}

function formatTimeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function InsightItem({ insight, onMarkAsRead, compact = false }: InsightItemProps) {
  const impactLevel = getImpactLevel(insight.impactScore)
  const timeAgo = formatTimeAgo(insight.createdAt)
  
  const handleClick = () => {
    if (!insight.isRead && onMarkAsRead) {
      onMarkAsRead(insight.id)
    }
  }

  if (compact) {
    return (
      <div 
        onClick={handleClick}
        className={cn(
          "p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm",
          insight.isRead ? "bg-gray-50 border-gray-200" : "bg-white border-blue-200 shadow-sm"
        )}
      >
        <div className="flex items-start space-x-3">
          <div className={cn(
            "flex-shrink-0 p-1.5 rounded-md border",
            getInsightColor(insight.type, insight.impactScore)
          )}>
            {getInsightIcon(insight.type, insight.impactScore)}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className={cn(
                "text-sm font-medium truncate",
                insight.isRead ? "text-gray-700" : "text-gray-900"
              )}>
                {insight.title}
              </h4>
              <div className="flex items-center space-x-2 ml-2">
                <span className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium",
                  impactLevel.color
                )}>
                  {impactLevel.label}
                </span>
                {!insight.isRead && (
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                )}
              </div>
            </div>
            
            <p className={cn(
              "text-xs leading-relaxed",
              insight.isRead ? "text-gray-500" : "text-gray-600"
            )}>
              {insight.description.length > 120 
                ? `${insight.description.substring(0, 120)}...` 
                : insight.description
              }
            </p>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-400 capitalize">
                {insight.type} • {timeAgo}
              </span>
              <ChevronRight className="h-3 w-3 text-gray-400" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card 
      onClick={handleClick}
      className={cn(
        "transition-all cursor-pointer hover:shadow-md",
        insight.isRead ? "bg-gray-50" : "bg-white border-blue-200"
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className={cn(
              "p-2 rounded-lg border",
              getInsightColor(insight.type, insight.impactScore)
            )}>
              {getInsightIcon(insight.type, insight.impactScore)}
            </div>
            <div className="flex-1">
              <CardTitle className={cn(
                "text-base",
                insight.isRead ? "text-gray-700" : "text-gray-900"
              )}>
                {insight.title}
              </CardTitle>
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-gray-500 capitalize">{insight.type}</span>
                <span className="text-xs text-gray-400">•</span>
                <span className="text-xs text-gray-500">{timeAgo}</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className={cn(
              "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
              impactLevel.color
            )}>
              {impactLevel.label}
            </span>
            {!insight.isRead && (
              <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <p className={cn(
          "text-sm leading-relaxed",
          insight.isRead ? "text-gray-600" : "text-gray-700"
        )}>
          {insight.description}
        </p>
      </CardContent>
    </Card>
  )
}

export function InsightsPanel({ 
  insights, 
  loading = false, 
  onMarkAsRead, 
  onViewAll,
  showAll = false 
}: InsightsPanelProps) {
  const displayInsights = showAll ? insights : insights.slice(0, 5)
  const unreadCount = insights.filter(insight => !insight.isRead).length
  const highImpactCount = insights.filter(insight => insight.impactScore >= 7).length

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Lightbulb className="h-5 w-5" />
              <span>AI Insights</span>
            </CardTitle>
            <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="flex items-start space-x-3">
                <div className="h-8 w-8 bg-gray-200 rounded animate-pulse"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-full animate-pulse"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3 animate-pulse"></div>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5" />
            <span>AI Insights</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No insights yet</h3>
            <p className="text-sm text-gray-500 mb-4">
              Connect your integrations to start getting AI-powered insights about your business.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Lightbulb className="h-5 w-5" />
            <span>AI Insights</span>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                {unreadCount}
              </span>
            )}
          </CardTitle>
          
          <div className="flex items-center space-x-2">
            {highImpactCount > 0 && (
              <div className="flex items-center space-x-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full">
                <Star className="h-3 w-3" />
                <span>{highImpactCount} high impact</span>
              </div>
            )}
            
            {onViewAll && !showAll && insights.length > 5 && (
              <button
                onClick={onViewAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all ({insights.length})
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {displayInsights.map((insight) => (
          <InsightItem
            key={insight.id}
            insight={insight}
            onMarkAsRead={onMarkAsRead}
            compact={!showAll}
          />
        ))}
        
        {!showAll && insights.length > 5 && (
          <div className="pt-2">
            <button
              onClick={onViewAll}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-md transition-colors"
            >
              View {insights.length - 5} more insights
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Compact version for smaller spaces
export function CompactInsightsPanel({ insights, loading, onMarkAsRead }: Omit<InsightsPanelProps, 'onViewAll' | 'showAll'>) {
  const topInsights = insights.slice(0, 3)
  const unreadCount = insights.filter(insight => !insight.isRead).length

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="p-3 bg-gray-100 rounded-lg animate-pulse">
            <div className="flex items-start space-x-3">
              <div className="h-6 w-6 bg-gray-200 rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="text-center py-6">
        <Lightbulb className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">No insights available</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-gray-900 flex items-center space-x-2">
          <Lightbulb className="h-4 w-4" />
          <span>Insights</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>
      </div>
      
      {topInsights.map((insight) => (
        <InsightItem
          key={insight.id}
          insight={insight}
          onMarkAsRead={onMarkAsRead}
          compact={true}
        />
      ))}
      
      {insights.length > 3 && (
        <div className="text-center pt-2">
          <span className="text-xs text-gray-500">
            {insights.length - 3} more insights available
          </span>
        </div>
      )}
    </div>
  )
}

export default InsightsPanel