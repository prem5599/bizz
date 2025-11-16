// src/app/dashboard/integrations/page.tsx
'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { ShopifyOAuthConnect } from '@/components/integrations/ShopifyOAuthConnect'
import { 
  Puzzle, 
  Check, 
  CheckCircle,
  AlertCircle, 
  RefreshCw, 
  Settings,
  ShoppingBag,
  CreditCard,
  BarChart3,
  Mail,
  Facebook,
  Plus,
  Trash2,
  Play,
  Pause,
  Eye,
  Activity,
  TrendingUp,
  Clock,
  Wifi,
  WifiOff,
  Database,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Shield,
  AlertTriangle
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Enhanced interfaces
interface Integration {
  id: string
  platform: string
  platformAccountId: string
  status: 'active' | 'inactive' | 'error' | 'paused'
  lastSyncAt: string | null
  createdAt: string
  updatedAt: string
  isConnected?: boolean
  platformDisplayName?: string
  statusText?: string
  canSync?: boolean
  syncStatus?: 'never' | 'recent' | 'stale' | 'very_stale'
  hasRecentData?: boolean
  totalDataPoints?: number
  totalWebhookEvents?: number
  lastSyncStatus?: 'success' | 'warning' | 'error' | 'never'
  configuration?: {
    webhooksEnabled: boolean
    autoSync: boolean
    syncFrequency: string
  }
}

interface SyncStatus {
  status: 'idle' | 'running' | 'error'
  isRunning: boolean
  canTriggerSync: boolean
  nextScheduledSync: string
  lastActivity: string
  currentSyncId?: string
}

interface SyncStatistics {
  totalWebhooks: number
  successfulWebhooks: number
  failedWebhooks: number
  successRate: number
  totalDataPoints: number
  dataPointsLast24h: number
  dataPointsLast7d: number
}

interface IntegrationDetails {
  integration: Integration
  sync: SyncStatus
  statistics: SyncStatistics
  dataPoints: {
    total: number
    byMetricType: Record<string, number>
    lastUpdated: string | null
    freshness: number | null
  }
  recentActivity: Array<{
    id: string
    topic: string
    status: string
    receivedAt: string
    processedAt?: string
    error?: string
  }>
  health: {
    score: number
    issues: string[]
    recommendations: string[]
  }
}

interface Organization {
  id: string
  name: string
  slug: string
}

export default function IntegrationsPage() {
  const { data: session, status } = useSession()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showShopifyConnect, setShowShopifyConnect] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [integrationDetails, setIntegrationDetails] = useState<Record<string, IntegrationDetails>>({})
  const [syncing, setSyncing] = useState<Record<string, boolean>>({})
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      fetchOrganizationAndIntegrations()
    } else if (status === 'unauthenticated') {
      setError('Please sign in to view integrations')
      setLoading(false)
    }
  }, [session, status])

  const fetchOrganizationAndIntegrations = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get user's current organization
      const orgResponse = await fetch('/api/organizations/current')
      if (!orgResponse.ok) {
        throw new Error('Failed to fetch organization')
      }
      
      const orgData = await orgResponse.json()
      const defaultOrg = orgData.organization
      
      if (!defaultOrg) {
        throw new Error('No organization found')
      }
      
      setOrganization(defaultOrg)
      
      // Fetch integrations using the enhanced API
      await fetchIntegrations(defaultOrg.id)
      
    } catch (error) {
      console.error('Error fetching organization and integrations:', error)
      setError(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchIntegrations = async (organizationId: string) => {
    try {
      setError(null)
      
      const response = await fetch(`/api/integrations?orgId=${organizationId}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setIntegrations([])
          return
        }
        throw new Error(`Failed to fetch integrations: ${response.status}`)
      }

      const data = await response.json()
      setIntegrations(data.integrations || [])
    } catch (error) {
      console.error('Error fetching integrations:', error)
      setIntegrations([])
    }
  }

  const fetchIntegrationDetails = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}`)
      if (!response.ok) throw new Error('Failed to fetch integration details')
      
      const data = await response.json()
      
      // Also fetch sync status
      const syncResponse = await fetch(`/api/integrations/${integrationId}/sync`)
      if (syncResponse.ok) {
        const syncData = await syncResponse.json()
        setIntegrationDetails(prev => ({
          ...prev,
          [integrationId]: { ...data.integration, ...syncData }
        }))
      } else {
        setIntegrationDetails(prev => ({
          ...prev,
          [integrationId]: data.integration
        }))
      }
    } catch (error) {
      console.error('Error fetching integration details:', error)
    }
  }

  const handleRefresh = useCallback(async () => {
    if (!organization) return
    
    setRefreshing(true)
    await fetchIntegrations(organization.id)
    setRefreshing(false)
  }, [organization])

  const handleSync = async (integrationId: string, syncType: 'incremental' | 'full' = 'incremental') => {
    try {
      setSyncing(prev => ({ ...prev, [integrationId]: true }))
      
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syncType })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        // Handle rate limit errors with user-friendly messages
        if (response.status === 429) {
          const retryAfter = errorData.retryAfter || 120 // Default to 2 minutes
          const message = errorData.message || 'Rate limit exceeded. Please wait before syncing again.'
          throw new Error(`${message} You can try again in ${Math.ceil(retryAfter / 60)} minute(s).`)
        }
        
        throw new Error(errorData.error || 'Failed to trigger sync')
      }
      
      const data = await response.json()
      
      // Update integration status
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, lastSyncAt: new Date().toISOString() }
          : integration
      ))
      
      // Refresh details after a short delay
      setTimeout(() => {
        fetchIntegrationDetails(integrationId)
      }, 2000)
      
    } catch (error) {
      console.error('Error triggering sync:', error)
      setError(error instanceof Error ? error.message : 'Failed to trigger sync')
    } finally {
      setSyncing(prev => ({ ...prev, [integrationId]: false }))
    }
  }

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm('Are you sure you want to disconnect this integration? This will stop data syncing and cannot be undone.')) {
      return
    }
    
    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to disconnect integration')
      }
      
      // Remove from list
      setIntegrations(prev => prev.filter(integration => integration.id !== integrationId))
      
      // Remove from details
      setIntegrationDetails(prev => {
        const updated = { ...prev }
        delete updated[integrationId]
        return updated
      })
      
    } catch (error) {
      console.error('Error disconnecting integration:', error)
      setError(error instanceof Error ? error.message : 'Failed to disconnect integration')
    }
  }

  const handleToggleStatus = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle' })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || 'Failed to toggle integration status')
      }
      
      const data = await response.json()
      
      // Update local state
      setIntegrations(prev => prev.map(integration =>
        integration.id === integrationId
          ? { ...integration, status: data.integration.status }
          : integration
      ))
      
    } catch (error) {
      console.error('Error toggling integration status:', error)
      setError(error instanceof Error ? error.message : 'Failed to toggle integration status')
    }
  }

  const handleShopifySuccess = (integration: Integration) => {
    console.log('Shopify integration successful:', integration)
    setIntegrations(prev => [...prev, integration])
    setShowShopifyConnect(false)
  }

  const toggleCardExpansion = (integrationId: string) => {
    setExpandedCards(prev => ({
      ...prev,
      [integrationId]: !prev[integrationId]
    }))
    
    if (!expandedCards[integrationId] && !integrationDetails[integrationId]) {
      fetchIntegrationDetails(integrationId)
    }
  }

  const getIntegrationIcon = (platform: string) => {
    switch (platform) {
      case 'shopify': return ShoppingBag
      case 'stripe': return CreditCard
      case 'google_analytics': return BarChart3
      case 'mailchimp': return Mail
      case 'facebook_ads': return Facebook
      default: return Puzzle
    }
  }

  const getIntegrationName = (platform: string) => {
    switch (platform) {
      case 'shopify': return 'Shopify'
      case 'stripe': return 'Stripe'
      case 'google_analytics': return 'Google Analytics'
      case 'mailchimp': return 'Mailchimp'
      case 'facebook_ads': return 'Facebook Ads'
      default: return platform
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-100 border-green-200'
      case 'inactive': return 'text-gray-700 bg-gray-100 border-gray-200'
      case 'error': return 'text-red-700 bg-red-100 border-red-200'
      case 'paused': return 'text-yellow-700 bg-yellow-100 border-yellow-200'
      default: return 'text-gray-700 bg-gray-100 border-gray-200'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Active'
      case 'inactive': return 'Inactive'
      case 'error': return 'Error'
      case 'paused': return 'Paused'
      default: return 'Unknown'
    }
  }

  const getSyncStatusIcon = (syncStatus?: string) => {
    switch (syncStatus) {
      case 'recent': return <Wifi className="h-4 w-4 text-green-500" />
      case 'stale': return <Activity className="h-4 w-4 text-yellow-500" />
      case 'very_stale': return <WifiOff className="h-4 w-4 text-red-500" />
      case 'never': return <Clock className="h-4 w-4 text-gray-500" />
      default: return <RefreshCw className="h-4 w-4 text-gray-500" />
    }
  }

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100'
    if (score >= 60) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const availableIntegrations = [
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'Connect your Shopify store to sync order data and customer information',
      icon: ShoppingBag,
      category: 'E-commerce',
      features: ['Order data', 'Customer info', 'Product catalog', 'Real-time updates'],
      status: 'available',
      onClick: () => setShowShopifyConnect(true)
    },
    {
      id: 'stripe',
      name: 'Stripe',
      description: 'Sync payment data and subscription metrics from your Stripe account',
      icon: CreditCard,
      category: 'Payments',
      features: ['Payment data', 'Subscription metrics', 'Customer analytics', 'Revenue tracking'],
      status: 'coming_soon',
      onClick: () => alert('Stripe integration coming soon!')
    },
    {
      id: 'google_analytics',
      name: 'Google Analytics',
      description: 'Import website traffic and conversion data from Google Analytics',
      icon: BarChart3,
      category: 'Analytics',
      features: ['Traffic data', 'Conversion tracking', 'Audience insights', 'Goal tracking'],
      status: 'coming_soon',
      onClick: () => alert('Google Analytics integration coming soon!')
    },
    {
      id: 'mailchimp',
      name: 'Mailchimp',
      description: 'Connect your email marketing campaigns and subscriber data',
      icon: Mail,
      category: 'Marketing',
      features: ['Campaign data', 'Subscriber metrics', 'Open rates', 'Click tracking'],
      status: 'coming_soon',
      onClick: () => alert('Mailchimp integration coming soon!')
    }
  ]

  const isIntegrationConnected = (platform: string) => {
    return integrations.some(integration => 
      integration.platform === platform && integration.status === 'active'
    )
  }

  if (loading || status === 'loading') {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-6">
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Puzzle className="h-8 w-8 text-blue-600 mr-3" />
              Integrations
            </h1>
            <p className="mt-2 text-gray-600">Loading integrations...</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Puzzle className="h-8 w-8 text-blue-600 mr-3" />
                Integrations Hub
              </h1>
              <p className="mt-2 text-gray-600">
                Connect and manage your business integrations
                {organization?.name && ` for ${organization.name}`}
              </p>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>

          {/* Stats Overview */}
          {integrations.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">Total Integrations</p>
                    <p className="text-2xl font-bold text-blue-900">{integrations.length}</p>
                  </div>
                  <Puzzle className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-medium">Active</p>
                    <p className="text-2xl font-bold text-green-900">
                      {integrations.filter(i => i.status === 'active').length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-yellow-600 text-sm font-medium">Total Data Points</p>
                    <p className="text-2xl font-bold text-yellow-900">
                      {integrations.reduce((sum, i) => sum + (i.totalDataPoints || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <Database className="h-8 w-8 text-yellow-600" />
                </div>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-sm font-medium">Webhook Events</p>
                    <p className="text-2xl font-bold text-purple-900">
                      {integrations.reduce((sum, i) => sum + (i.totalWebhookEvents || 0), 0).toLocaleString()}
                    </p>
                  </div>
                  <Zap className="h-8 w-8 text-purple-600" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="ml-4 text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Connected Integrations */}
        {integrations.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900">Connected Integrations</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {integrations.map((integration) => {
                const Icon = getIntegrationIcon(integration.platform)
                const isExpanded = expandedCards[integration.id]
                const details = integrationDetails[integration.id]
                const isSyncing = syncing[integration.id]
                
                return (
                  <div key={integration.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-200">
                    {/* Main Card */}
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                            <Icon className="h-6 w-6 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {getIntegrationName(integration.platform)}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {integration.platformAccountId}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          {getSyncStatusIcon(integration.syncStatus)}
                          <span className={cn(
                            "inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border",
                            getStatusColor(integration.status)
                          )}>
                            {getStatusText(integration.status)}
                          </span>
                        </div>
                      </div>

                      {/* Status Info */}
                      <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900">
                            {integration.totalDataPoints?.toLocaleString() || '0'}
                          </div>
                          <div className="text-xs text-gray-500">Data Points</div>
                        </div>
                        <div className="text-center p-3 bg-gray-50 rounded-lg">
                          <div className="text-lg font-semibold text-gray-900">
                            {integration.lastSyncAt 
                              ? new Date(integration.lastSyncAt).toLocaleDateString()
                              : 'Never'
                            }
                          </div>
                          <div className="text-xs text-gray-500">Last Sync</div>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleSync(integration.id)}
                            disabled={isSyncing || integration.status !== 'active'}
                            className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {isSyncing ? (
                              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <RefreshCw className="h-4 w-4 mr-2" />
                            )}
                            {isSyncing ? 'Syncing...' : 'Sync Now'}
                          </button>

                          <button
                            onClick={() => handleToggleStatus(integration.id)}
                            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            {integration.status === 'active' ? (
                              <Pause className="h-4 w-4 mr-2" />
                            ) : (
                              <Play className="h-4 w-4 mr-2" />
                            )}
                            {integration.status === 'active' ? 'Pause' : 'Resume'}
                          </button>
                        </div>

                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleCardExpansion(integration.id)}
                            className="flex items-center px-3 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Details
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 ml-1" />
                            ) : (
                              <ChevronDown className="h-4 w-4 ml-1" />
                            )}
                          </button>

                          <button
                            onClick={() => handleDisconnect(integration.id)}
                            className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 bg-gray-50 p-6">
                        {details ? (
                          <div className="space-y-4">
                            {/* Health Score */}
                            {details.health && (
                              <div className="bg-white rounded-lg p-4">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="font-medium text-gray-900">Integration Health</h4>
                                  <span className={cn(
                                    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                    getHealthColor(details.health.score)
                                  )}>
                                    {details.health.score}% Healthy
                                  </span>
                                </div>
                                {details.health.issues?.length > 0 && (
                                  <div className="space-y-2">
                                    {details.health.issues.map((issue, idx) => (
                                      <div key={idx} className="flex items-center text-sm text-red-600">
                                        <AlertTriangle className="h-4 w-4 mr-2" />
                                        {issue}
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {details.health.recommendations?.length > 0 && (
                                  <div className="mt-3 space-y-1">
                                    <h5 className="text-sm font-medium text-gray-700">Recommendations:</h5>
                                    {details.health.recommendations.map((rec, idx) => (
                                      <div key={idx} className="text-sm text-blue-600">
                                        • {rec}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Statistics */}
                            {details.statistics && (
                              <div className="bg-white rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-3">Statistics</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <span className="text-gray-500">Success Rate:</span>
                                    <span className="ml-2 font-medium">{details.statistics.successRate}%</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Total Webhooks:</span>
                                    <span className="ml-2 font-medium">{details.statistics.totalWebhooks}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Data Points (24h):</span>
                                    <span className="ml-2 font-medium">{details.statistics.dataPointsLast24h}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Data Points (7d):</span>
                                    <span className="ml-2 font-medium">{details.statistics.dataPointsLast7d}</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Recent Activity */}
                            {details.recentActivity?.length > 0 && (
                              <div className="bg-white rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-3">Recent Activity</h4>
                                <div className="space-y-2 max-h-32 overflow-y-auto">
                                  {details.recentActivity.slice(0, 5).map((activity) => (
                                    <div key={activity.id} className="flex items-center justify-between text-sm">
                                      <div className="flex items-center">
                                        <div className={cn(
                                          "w-2 h-2 rounded-full mr-2",
                                          activity.status === 'processed' ? 'bg-green-500' : 
                                          activity.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                                        )} />
                                        <span className="font-medium">{activity.topic}</span>
                                      </div>
                                      <span className="text-gray-500">
                                        {new Date(activity.receivedAt).toLocaleTimeString()}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Data Types */}
                            {details.dataPoints?.byMetricType && (
                              <div className="bg-white rounded-lg p-4">
                                <h4 className="font-medium text-gray-900 mb-3">Data Types</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                  {Object.entries(details.dataPoints.byMetricType).map(([type, count]) => (
                                    <div key={type} className="flex justify-between">
                                      <span className="capitalize">{type.replace('_', ' ')}:</span>
                                      <span className="font-medium">{count}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-8">
                            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
                            <span className="ml-2 text-gray-500">Loading details...</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Available Integrations */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Available Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableIntegrations.map((integration) => {
              const Icon = integration.icon
              const isConnected = isIntegrationConnected(integration.id)
              
              return (
                <div key={integration.id} className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center">
                        <Icon className="h-7 w-7 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{integration.name}</h3>
                        <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          {integration.category}
                        </span>
                      </div>
                    </div>
                    {integration.status === 'coming_soon' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Coming Soon
                      </span>
                    )}
                  </div>
                  
                  <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                    {integration.description}
                  </p>
                  
                  <div className="mb-6">
                    <h4 className="text-sm font-medium text-gray-700 mb-3">Features:</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {integration.features.map((feature, idx) => (
                        <div key={idx} className="flex items-center text-sm text-gray-600">
                          <Check className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button
                    onClick={integration.onClick}
                    disabled={isConnected || integration.status === 'coming_soon'}
                    className={cn(
                      "w-full flex items-center justify-center px-4 py-3 text-sm font-semibold rounded-lg transition-all duration-200",
                      isConnected
                        ? "bg-green-100 text-green-700 cursor-not-allowed"
                        : integration.status === 'coming_soon'
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl"
                    )}
                  >
                    {isConnected ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Connected
                      </>
                    ) : integration.status === 'coming_soon' ? (
                      <>
                        <Clock className="h-4 w-4 mr-2" />
                        Coming Soon
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Connect {integration.name}
                      </>
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Empty State */}
        {integrations.length === 0 && (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <div className="flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mx-auto mb-6">
              <Puzzle className="h-10 w-10 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-3">No integrations yet</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Connect your first integration to start analyzing your business data and unlock powerful insights.
            </p>
            <button
              onClick={() => setShowShopifyConnect(true)}
              className="inline-flex items-center px-6 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-2" />
              Connect Your First Integration
            </button>
          </div>
        )}
      </div>

      {/* Shopify Connect Modal */}
      <ShopifyOAuthConnect
        isOpen={showShopifyConnect}
        onClose={() => setShowShopifyConnect(false)}
        onSuccess={handleShopifySuccess}
      />
    </DashboardLayout>
  )
}