// src/components/integrations/ShopifyIntegrationManager.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { 
  Settings,
  Shield,
  RefreshCw,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  TrendingUp,
  Database,
  Zap,
  Edit3,
  Trash2,
  ExternalLink,
  Download,
  Upload,
  BarChart3,
  Calendar,
  Users,
  Package,
  DollarSign,
  Globe,
  Key,
  Lock
} from 'lucide-react'
import ShopifyScopeSelector from './ShopifyScopeSelector'
import {
  SHOPIFY_SCOPES,
  ShopifyScopeManager,
  type ShopifyScope
} from '@/lib/integrations/shopify-scopes'

interface Integration {
  id: string
  platform: 'shopify'
  platformAccountId: string
  status: 'active' | 'error' | 'syncing' | 'disconnected'
  lastSyncAt: string | null
  createdAt: string
  metadata: {
    shopDomain: string
    integrationMethod: 'oauth' | 'private_app'
    grantedScopes?: string[]
    shopName?: string
    plan?: string
    country?: string
  }
  syncStats?: {
    totalRecords: number
    lastSyncDuration: number
    errorCount: number
    successRate: number
  }
  dataPoints?: Array<{
    metricType: string
    count: number
    lastUpdated: string
  }>
}

interface ShopifyIntegrationManagerProps {
  integration: Integration
  onUpdate?: (integration: Integration) => void
  onDelete?: (integrationId: string) => void
  onReconnect?: (integrationId: string, newScopes: string[]) => void
}

export default function ShopifyIntegrationManager({
  integration,
  onUpdate,
  onDelete,
  onReconnect
}: ShopifyIntegrationManagerProps) {
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [showScopeEditor, setShowScopeEditor] = useState(false)
  const [selectedScopes, setSelectedScopes] = useState<string[]>(
    integration.metadata.grantedScopes || []
  )
  const [syncHistory, setSyncHistory] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)

  // Get current scope information
  const currentScopes = integration.metadata.grantedScopes || []
  const scopeValidation = ShopifyScopeManager.validateScopes(currentScopes)
  const dataUsage = ShopifyScopeManager.estimateDataUsage(currentScopes)

  // Status indicators
  const getStatusConfig = () => {
    switch (integration.status) {
      case 'active':
        return {
          icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
          label: 'Active',
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200'
        }
      case 'syncing':
        return {
          icon: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
          label: 'Syncing',
          color: 'text-blue-600',
          bgColor: 'bg-blue-50 border-blue-200'
        }
      case 'error':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
          label: 'Error',
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200'
        }
      default:
        return {
          icon: <Clock className="h-4 w-4 text-gray-500" />,
          label: 'Disconnected',
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200'
        }
    }
  }

  const statusConfig = getStatusConfig()

  // Load integration metrics
  useEffect(() => {
    loadIntegrationMetrics()
    loadSyncHistory()
  }, [integration.id])

  const loadIntegrationMetrics = async () => {
    try {
      const response = await fetch(`/api/integrations/${integration.id}/metrics`)
      if (response.ok) {
        const data = await response.json()
        setMetrics(data)
      }
    } catch (error) {
      console.error('Failed to load metrics:', error)
    }
  }

  const loadSyncHistory = async () => {
    try {
      const response = await fetch(`/api/integrations/${integration.id}/sync-history`)
      if (response.ok) {
        const data = await response.json()
        setSyncHistory(data.history || [])
      }
    } catch (error) {
      console.error('Failed to load sync history:', error)
    }
  }

  // Trigger manual sync
  const handleManualSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch(`/api/integrations/${integration.id}/sync`, {
        method: 'POST'
      })
      
      if (response.ok) {
        const result = await response.json()
        onUpdate?.({ ...integration, status: 'syncing', lastSyncAt: new Date().toISOString() })
        // Reload metrics after sync
        setTimeout(loadIntegrationMetrics, 2000)
      } else {
        throw new Error('Sync failed')
      }
    } catch (error) {
      console.error('Manual sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  // Update scopes
  const handleScopeUpdate = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/integrations/${integration.id}/scopes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: selectedScopes })
      })

      if (response.ok) {
        const result = await response.json()
        onUpdate?.({
          ...integration,
          metadata: {
            ...integration.metadata,
            grantedScopes: selectedScopes
          }
        })
        setShowScopeEditor(false)
      } else {
        throw new Error('Failed to update scopes')
      }
    } catch (error) {
      console.error('Scope update failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Disconnect integration
  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect this Shopify integration? This will stop data syncing.')) {
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`/api/integrations/${integration.id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        onDelete?.(integration.id)
      } else {
        throw new Error('Failed to disconnect')
      }
    } catch (error) {
      console.error('Disconnect failed:', error)
    } finally {
      setLoading(false)
    }
  }

  // Render overview tab
  const renderOverview = () => (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Globe className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>{integration.metadata.shopName || integration.platformAccountId}</span>
                  {statusConfig.icon}
                </CardTitle>
                <CardDescription>
                  {integration.metadata.shopDomain}.myshopify.com
                </CardDescription>
              </div>
            </div>
            <Badge className={statusConfig.bgColor + ' ' + statusConfig.color}>
              {statusConfig.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{currentScopes.length}</div>
              <div className="text-xs text-gray-600">Permissions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {integration.syncStats?.successRate || 0}%
              </div>
              <div className="text-xs text-gray-600">Success Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {integration.syncStats?.totalRecords || 0}
              </div>
              <div className="text-xs text-gray-600">Records Synced</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {integration.lastSyncAt ? 
                  Math.round((Date.now() - new Date(integration.lastSyncAt).getTime()) / (1000 * 60 * 60)) 
                  : '--'
                }h
              </div>
              <div className="text-xs text-gray-600">Last Sync</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Quick Actions</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleManualSync}
              disabled={syncing || integration.status === 'syncing'}
              size="sm"
            >
              {syncing ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sync Now
            </Button>
            
            <Button
              variant="outline"
              onClick={() => setShowScopeEditor(true)}
              size="sm"
            >
              <Shield className="h-4 w-4 mr-2" />
              Manage Permissions
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.open(`https://${integration.metadata.shopDomain}.myshopify.com/admin`, '_blank')}
              size="sm"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Shopify Admin
            </Button>
            
            <Button
              variant="outline"
              onClick={handleDisconnect}
              size="sm"
              className="text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Summary */}
      {metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>Data Summary</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Package className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-blue-600">{metrics.products || 0}</div>
                <div className="text-sm text-gray-600">Products</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-green-600">{metrics.orders || 0}</div>
                <div className="text-sm text-gray-600">Orders</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-purple-600">{metrics.customers || 0}</div>
                <div className="text-sm text-gray-600">Customers</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600 mx-auto mb-2" />
                <div className="text-xl font-bold text-orange-600">
                  ${(metrics.revenue || 0).toLocaleString()}
                </div>
                <div className="text-sm text-gray-600">Revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )

  // Render permissions tab
  const renderPermissions = () => (
    <div className="space-y-6">
      {/* Current Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Current Permissions</span>
          </CardTitle>
          <CardDescription>
            Permissions granted to this integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">Authentication Method</div>
                <div className="text-sm text-gray-600 flex items-center space-x-2">
                  {integration.metadata.integrationMethod === 'oauth' ? (
                    <>
                      <Globe className="h-4 w-4" />
                      <span>OAuth App</span>
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4" />
                      <span>Private App</span>
                    </>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={
                dataUsage.level === 'high' ? 'bg-red-50 text-red-700' :
                dataUsage.level === 'medium' ? 'bg-yellow-50 text-yellow-700' :
                'bg-green-50 text-green-700'
              }>
                {dataUsage.level} access
              </Badge>
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium">Granted Scopes</span>
                <span className="text-sm text-gray-600">{currentScopes.length} permissions</span>
              </div>
              
              <div className="grid gap-2">
                {currentScopes.map(scopeId => {
                  const scope = ShopifyScopeManager.getScopeById(scopeId)
                  if (!scope) return null
                  
                  return (
                    <div key={scopeId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium text-sm">{scope.name}</div>
                        <div className="text-xs text-gray-600">{scope.description}</div>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          scope.riskLevel === 'high' ? 'text-red-700' :
                          scope.riskLevel === 'medium' ? 'text-yellow-700' :
                          'text-green-700'
                        }
                      >
                        {scope.riskLevel}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            </div>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={() => setShowScopeEditor(true)}>
                <Edit3 className="h-4 w-4 mr-2" />
                Modify Permissions
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Status */}
      {!scopeValidation.valid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Permission Issues Detected</AlertTitle>
          <AlertDescription>
            {scopeValidation.missing.length > 0 && (
              <div>Missing required scopes: {scopeValidation.missing.join(', ')}</div>
            )}
            {scopeValidation.invalid.length > 0 && (
              <div>Invalid scopes: {scopeValidation.invalid.join(', ')}</div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  )

  // Render sync history tab
  const renderSyncHistory = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Sync Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {syncHistory.length > 0 ? (
            <div className="space-y-3">
              {syncHistory.map((sync, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    {sync.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                    <div>
                      <div className="font-medium text-sm">
                        {sync.status === 'success' ? 'Sync Completed' : 'Sync Failed'}
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(sync.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {sync.recordsProcessed && (
                      <div className="text-sm font-medium">{sync.recordsProcessed} records</div>
                    )}
                    {sync.duration && (
                      <div className="text-xs text-gray-600">{sync.duration}ms</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Database className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No sync history available</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Shopify Integration</h2>
          <p className="text-gray-600">Manage your {integration.metadata.shopDomain} connection</p>
        </div>
        <div className="flex items-center space-x-2">
          {statusConfig.icon}
          <span className={statusConfig.color + ' font-medium'}>{statusConfig.label}</span>
        </div>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {renderOverview()}
        </TabsContent>

        <TabsContent value="permissions" className="space-y-6">
          {renderPermissions()}
        </TabsContent>

        <TabsContent value="activity" className="space-y-6">
          {renderSyncHistory()}
        </TabsContent>
      </Tabs>

      {/* Scope Editor Dialog */}
      <Dialog open={showScopeEditor} onOpenChange={setShowScopeEditor}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Permissions</DialogTitle>
            <DialogDescription>
              Update the permissions for your Shopify integration. Changes will require reconnecting your store.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            <ShopifyScopeSelector
              selectedScopes={selectedScopes}
              onScopeChange={setSelectedScopes}
              disabled={loading}
              showPresets={true}
              compact={false}
            />

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => setShowScopeEditor(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleScopeUpdate}
                disabled={loading || selectedScopes.length === 0}
              >
                {loading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Shield className="h-4 w-4 mr-2" />
                    Update Permissions
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}