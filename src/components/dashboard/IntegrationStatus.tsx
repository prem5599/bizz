// src/components/dashboard/IntegrationStatus.tsx
'use client'

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  RefreshCw,
  Wifi,
  WifiOff,
  Database,
  Zap,
  Settings,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Mail,
  MessageSquare,
  FileText,
  Plus,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface DashboardIntegration {
  id: string
  platform: string
  platformAccountId: string | null
  status: 'active' | 'inactive' | 'error' | 'syncing' | 'pending'
  lastSyncAt: string | null
  dataPointsCount: number
  metadata?: {
    shopName?: string
    shopInfo?: {
      name: string
      domain: string
      email: string
      planName: string
      currency: string
      country: string
    }
    scopes?: string[]
    error?: {
      message: string
      timestamp: string
    }
  }
}

interface IntegrationStatusProps {
  integrations: DashboardIntegration[]
  loading?: boolean
  onRefreshIntegration?: (integrationId: string) => void
  onManageIntegrations?: () => void
  compact?: boolean
}

interface IntegrationItemProps {
  integration: DashboardIntegration
  onRefresh?: (integrationId: string) => void
  compact?: boolean
}

function getPlatformIcon(platform: string): React.ReactNode {
  switch (platform) {
    case 'shopify': return <ShoppingBag className="h-4 w-4" />
    case 'stripe': return <CreditCard className="h-4 w-4" />
    case 'google_analytics': return <BarChart3 className="h-4 w-4" />
    case 'mailchimp': return <Mail className="h-4 w-4" />
    case 'facebook_ads': return <MessageSquare className="h-4 w-4" />
    case 'quickbooks': return <FileText className="h-4 w-4" />
    default: return <Database className="h-4 w-4" />
  }
}

function getPlatformName(platform: string): string {
  const names: Record<string, string> = {
    shopify: 'Shopify',
    stripe: 'Stripe',
    google_analytics: 'Google Analytics',
    mailchimp: 'Mailchimp',
    facebook_ads: 'Facebook Ads',
    quickbooks: 'QuickBooks'
  }
  return names[platform] || platform.charAt(0).toUpperCase() + platform.slice(1)
}

function getStatusIcon(status: string): React.ReactNode {
  switch (status) {
    case 'active': return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'syncing': return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
    case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />
    case 'error': return <AlertCircle className="h-4 w-4 text-red-500" />
    case 'inactive': return <WifiOff className="h-4 w-4 text-gray-400" />
    default: return <AlertCircle className="h-4 w-4 text-gray-400" />
  }
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'text-green-700 bg-green-50 border-green-200'
    case 'syncing': return 'text-blue-700 bg-blue-50 border-blue-200'
    case 'pending': return 'text-yellow-700 bg-yellow-50 border-yellow-200'
    case 'error': return 'text-red-700 bg-red-50 border-red-200'
    case 'inactive': return 'text-gray-700 bg-gray-50 border-gray-200'
    default: return 'text-gray-700 bg-gray-50 border-gray-200'
  }
}

function formatLastSync(lastSyncAt: string | null): string {
  if (!lastSyncAt) return 'Never synced'
  
  const now = new Date()
  const sync = new Date(lastSyncAt)
  const diffMs = now.getTime() - sync.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return sync.toLocaleDateString()
}

function getHealthScore(integration: DashboardIntegration): { score: number; status: 'excellent' | 'good' | 'warning' | 'critical' } {
  let score = 100
  
  // Status penalties
  if (integration.status === 'error') score -= 50
  if (integration.status === 'inactive') score -= 40
  if (integration.status === 'pending') score -= 20
  
  // Last sync penalties
  if (integration.lastSyncAt) {
    const hoursSinceSync = (Date.now() - new Date(integration.lastSyncAt).getTime()) / (1000 * 60 * 60)
    if (hoursSinceSync > 48) score -= 20
    else if (hoursSinceSync > 24) score -= 10
    else if (hoursSinceSync > 12) score -= 5
  } else {
    score -= 30
  }
  
  // Data points bonus/penalty
  if (integration.dataPointsCount === 0) score -= 15
  else if (integration.dataPointsCount > 1000) score += 5
  
  score = Math.max(0, Math.min(100, score))
  
  if (score >= 90) return { score, status: 'excellent' }
  if (score >= 70) return { score, status: 'good' }
  if (score >= 50) return { score, status: 'warning' }
  return { score, status: 'critical' }
}

function IntegrationItem({ integration, onRefresh, compact = false }: IntegrationItemProps) {
  const health = getHealthScore(integration)
  const lastSync = formatLastSync(integration.lastSyncAt)
  const platformName = getPlatformName(integration.platform)
  
  if (compact) {
    return (
      <div className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-shadow">
        <div className="flex items-center space-x-3">
          <div className="p-1.5 bg-blue-50 rounded-md">
            {getPlatformIcon(integration.platform)}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900">{platformName}</span>
              {getStatusIcon(integration.status)}
            </div>
            <div className="text-xs text-gray-500">{lastSync}</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="text-right">
            <div className="text-xs font-medium text-gray-900">
              {integration.dataPointsCount.toLocaleString()}
            </div>
            <div className="text-xs text-gray-500">data points</div>
          </div>
          
          {onRefresh && integration.status === 'active' && (
            <button
              onClick={() => onRefresh(integration.id)}
              className="p-1.5 text-gray-400 hover:text-blue-600 rounded-md hover:bg-blue-50 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              {getPlatformIcon(integration.platform)}
            </div>
            <div>
              <h4 className="font-medium text-gray-900">{platformName}</h4>
              {integration.platformAccountId && (
                <p className="text-sm text-gray-500">
                  {integration.metadata?.shopInfo?.name || integration.platformAccountId}
                </p>
              )}
            </div>
          </div>
          
          <div className={cn(
            "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium border",
            getStatusColor(integration.status)
          )}>
            {getStatusIcon(integration.status)}
            <span className="capitalize">{integration.status}</span>
          </div>
        </div>

        {integration.status === 'error' && integration.metadata?.error && (
          <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-md">
            <p className="text-xs text-red-700">{integration.metadata.error.message}</p>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Health Score</span>
            <div className="flex items-center space-x-2">
              <div className={cn(
                "h-2 w-16 rounded-full overflow-hidden",
                health.status === 'excellent' ? 'bg-green-100' :
                health.status === 'good' ? 'bg-blue-100' :
                health.status === 'warning' ? 'bg-yellow-100' : 'bg-red-100'
              )}>
                <div 
                  className={cn(
                    "h-full transition-all duration-300",
                    health.status === 'excellent' ? 'bg-green-500' :
                    health.status === 'good' ? 'bg-blue-500' :
                    health.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  style={{ width: `${health.score}%` }}
                />
              </div>
              <span className={cn(
                "text-xs font-medium",
                health.status === 'excellent' ? 'text-green-600' :
                health.status === 'good' ? 'text-blue-600' :
                health.status === 'warning' ? 'text-yellow-600' : 'text-red-600'
              )}>
                {health.score}%
              </span>
            </div>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Data Points</span>
            <span className="font-medium text-gray-900">
              {integration.dataPointsCount.toLocaleString()}
            </span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Last Sync</span>
            <span className="font-medium text-gray-900">{lastSync}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <button className="inline-flex items-center text-xs text-gray-500 hover:text-blue-600">
            <Settings className="mr-1 h-3 w-3" />
            Settings
          </button>
          
          {onRefresh && integration.status === 'active' && (
            <button
              onClick={() => onRefresh(integration.id)}
              className="inline-flex items-center text-xs text-blue-600 hover:text-blue-700"
            >
              <RefreshCw className="mr-1 h-3 w-3" />
              Sync Now
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function IntegrationStatus({ 
  integrations, 
  loading = false, 
  onRefreshIntegration,
  onManageIntegrations,
  compact = false 
}: IntegrationStatusProps) {
  const activeIntegrations = integrations.filter(i => i.status === 'active')
  const errorIntegrations = integrations.filter(i => i.status === 'error')
  const totalDataPoints = integrations.reduce((sum, i) => sum + i.dataPointsCount, 0)
  
  // Calculate overall health
  const overallHealth = integrations.length > 0 
    ? integrations.reduce((sum, i) => sum + getHealthScore(i).score, 0) / integrations.length
    : 0

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="h-5 bg-gray-200 rounded w-32 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-16 animate-pulse"></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (integrations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Integrations</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <Zap className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No integrations connected</h3>
            <p className="text-sm text-gray-500 mb-4">
              Connect your business tools to start collecting data and insights.
            </p>
            <button
              onClick={onManageIntegrations}
              className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Integration
            </button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 flex items-center space-x-2">
            <Database className="h-4 w-4" />
            <span>Integrations</span>
            <span className="text-sm text-gray-500">({integrations.length})</span>
          </h3>
          
          <div className="flex items-center space-x-2">
            {errorIntegrations.length > 0 && (
              <div className="flex items-center space-x-1 text-xs text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span>{errorIntegrations.length} error{errorIntegrations.length !== 1 ? 's' : ''}</span>
              </div>
            )}
            
            <div className={cn(
              "flex items-center space-x-1 text-xs",
              overallHealth >= 80 ? 'text-green-600' :
              overallHealth >= 60 ? 'text-yellow-600' : 'text-red-600'
            )}>
              <Wifi className="h-3 w-3" />
              <span>{Math.round(overallHealth)}%</span>
            </div>
          </div>
        </div>
        
        <div className="space-y-2">
          {integrations.map((integration) => (
            <IntegrationItem
              key={integration.id}
              integration={integration}
              onRefresh={onRefreshIntegration}
              compact={true}
            />
          ))}
        </div>
        
        {onManageIntegrations && (
          <button
            onClick={onManageIntegrations}
            className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium py-2 hover:bg-blue-50 rounded-md transition-colors"
          >
            Manage integrations
          </button>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Integration Health</span>
          </CardTitle>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">
                {totalDataPoints.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500">total data points</div>
            </div>
            
            <div className={cn(
              "inline-flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium",
              overallHealth >= 80 ? 'text-green-700 bg-green-50' :
              overallHealth >= 60 ? 'text-yellow-700 bg-yellow-50' : 'text-red-700 bg-red-50'
            )}>
              <Wifi className="h-3 w-3" />
              <span>{Math.round(overallHealth)}% healthy</span>
            </div>
          </div>
        </div>
        
        {(errorIntegrations.length > 0 || activeIntegrations.length !== integrations.length) && (
          <div className="mt-2 text-sm text-gray-600">
            {activeIntegrations.length} of {integrations.length} integrations active
            {errorIntegrations.length > 0 && (
              <span className="text-red-600"> • {errorIntegrations.length} need attention</span>
            )}
          </div>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {integrations.map((integration) => (
            <IntegrationItem
              key={integration.id}
              integration={integration}
              onRefresh={onRefreshIntegration}
              compact={false}
            />
          ))}
        </div>
        
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {activeIntegrations.length} active • {errorIntegrations.length} errors
          </div>
          
          <div className="flex items-center space-x-3">
            {onManageIntegrations && (
              <button
                onClick={onManageIntegrations}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <Settings className="mr-1 h-4 w-4" />
                Manage
              </button>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-700"
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Refresh All
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default IntegrationStatus