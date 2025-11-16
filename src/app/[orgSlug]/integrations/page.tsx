// src/app/[orgSlug]/integrations/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useSearchParams } from 'next/navigation'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Plus,
  Settings,
  Trash2,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Clock,
  ExternalLink,
  Zap,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  BarChart3,
  Users,
  Package,
  Globe,
  Smartphone,
  Mail,
  MessageSquare,
  Database,
  Calendar,
  FileText,
  DollarSign,
  TrendingUp,
  Check,
  Star,
  Filter
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StripeConnect } from '@/components/integrations/StripeConnect'
import { WooCommerceConnect } from '@/components/integrations/WooCommerceConnect'

interface Integration {
  id: string
  platform: string
  platformAccountId: string | null
  status: 'active' | 'inactive' | 'error' | 'syncing' | 'pending'
  lastSyncAt: string | null
  dataPointsCount: number
  createdAt: string
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

interface AvailableIntegration {
  id: string
  name: string
  description: string
  platform: string
  icon: React.ReactNode
  category: 'ecommerce' | 'payments' | 'analytics' | 'marketing' | 'productivity'
  features: string[]
  isPopular?: boolean
  isComingSoon?: boolean
  setupTime: string
}

const AVAILABLE_INTEGRATIONS: AvailableIntegration[] = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect your Shopify store to track orders, customers, and revenue in real-time',
    platform: 'shopify',
    icon: <ShoppingBag className="h-6 w-6" />,
    category: 'ecommerce',
    features: ['Order tracking', 'Customer analytics', 'Revenue metrics', 'Product performance'],
    isPopular: true,
    setupTime: '2 minutes'
  },
  {
    id: 'stripe',
    name: 'Stripe',
    description: 'Monitor payment processing, subscription metrics, and financial performance',
    platform: 'stripe',
    icon: <CreditCard className="h-6 w-6" />,
    category: 'payments',
    features: ['Payment tracking', 'Subscription metrics', 'Chargeback monitoring', 'Revenue analytics'],
    isPopular: true,
    setupTime: '3 minutes'
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'Connect your WordPress WooCommerce store to track orders, products, and customers',
    platform: 'woocommerce',
    icon: <ShoppingCart className="h-6 w-6" />,
    category: 'ecommerce',
    features: ['Order tracking', 'Product management', 'Customer analytics', 'Coupon performance'],
    isPopular: true,
    setupTime: '3 minutes'
  },
  {
    id: 'google_analytics',
    name: 'Google Analytics',
    description: 'Track website traffic, user behavior, and conversion metrics',
    platform: 'google_analytics',
    icon: <BarChart3 className="h-6 w-6" />,
    category: 'analytics',
    features: ['Traffic analytics', 'Conversion tracking', 'Audience insights', 'Goal monitoring'],
    setupTime: '5 minutes'
  },
  {
    id: 'mailchimp',
    name: 'Mailchimp',
    description: 'Monitor email campaign performance and subscriber engagement',
    platform: 'mailchimp',
    icon: <Mail className="h-6 w-6" />,
    category: 'marketing',
    features: ['Email campaigns', 'Subscriber growth', 'Open rates', 'Click tracking'],
    isComingSoon: true,
    setupTime: '4 minutes'
  },
  {
    id: 'facebook_ads',
    name: 'Facebook Ads',
    description: 'Track ad performance, costs, and ROI from your Facebook advertising',
    platform: 'facebook_ads',
    icon: <Globe className="h-6 w-6" />,
    category: 'marketing',
    features: ['Ad performance', 'Cost tracking', 'ROI analysis', 'Audience insights'],
    isComingSoon: true,
    setupTime: '4 minutes'
  }
]

const CATEGORIES = [
  { id: 'all', name: 'All Integrations', count: AVAILABLE_INTEGRATIONS.length },
  { id: 'ecommerce', name: 'E-commerce', count: AVAILABLE_INTEGRATIONS.filter(i => i.category === 'ecommerce').length },
  { id: 'payments', name: 'Payments', count: AVAILABLE_INTEGRATIONS.filter(i => i.category === 'payments').length },
  { id: 'analytics', name: 'Analytics', count: AVAILABLE_INTEGRATIONS.filter(i => i.category === 'analytics').length },
  { id: 'marketing', name: 'Marketing', count: AVAILABLE_INTEGRATIONS.filter(i => i.category === 'marketing').length },
]

export default function IntegrationsPage() {
  const { data: session } = useSession()
  const params = useParams()
  const searchParams = useSearchParams()
  
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [showStripeConnect, setShowStripeConnect] = useState(false)
  const [showWooCommerceConnect, setShowWooCommerceConnect] = useState(false)
  const [organizationId, setOrganizationId] = useState<string>('')

  const orgSlug = params.orgSlug as string

  useEffect(() => {
    fetchOrganizationId()
    
    // Check for success/error messages from OAuth callbacks
    const success = searchParams.get('success')
    const errorParam = searchParams.get('error')
    const shop = searchParams.get('shop')
    
    if (success === 'shopify_connected' && shop) {
      console.log(`Successfully connected to Shopify store: ${shop}`)
    } else if (errorParam) {
      console.error('Integration connection error:', errorParam)
    }
  }, [searchParams])

  const fetchOrganizationId = async () => {
    try {
      const response = await fetch(`/api/organizations/by-slug/${orgSlug}`)
      if (response.ok) {
        const data = await response.json()
        setOrganizationId(data.organization.id)
        fetchIntegrations(data.organization.id)
      } else {
        setError('Failed to load organization')
      }
    } catch (err) {
      console.error('Failed to fetch organization:', err)
      setError('Failed to load organization')
    }
  }

  const fetchIntegrations = async (orgId?: string) => {
    const targetOrgId = orgId || organizationId
    if (!targetOrgId) return
    
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/integrations?orgId=${targetOrgId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch integrations: ${response.statusText}`)
      }

      const data = await response.json()
      setIntegrations(data.integrations || [])
      
    } catch (err) {
      console.error('Failed to fetch integrations:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch integrations')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteIntegration = async (integrationId: string) => {
    if (!confirm('Are you sure you want to delete this integration? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/integrations/${integrationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to delete integration')
      }

      setIntegrations(prev => prev.filter(integration => integration.id !== integrationId))
    } catch (err) {
      console.error('Failed to delete integration:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete integration')
    }
  }

  const handleSyncIntegration = async (integrationId: string) => {
    try {
      const response = await fetch(`/api/integrations/${integrationId}/sync`, {
        method: 'POST',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        
        // Handle rate limit errors with user-friendly messages
        if (response.status === 429) {
          const retryAfter = errorData.retryAfter || 120 // Default to 2 minutes
          const message = errorData.message || 'Rate limit exceeded. Please wait before syncing again.'
          throw new Error(`${message} You can try again in ${Math.ceil(retryAfter / 60)} minute(s).`)
        }
        
        throw new Error(errorData.error || 'Failed to sync integration')
      }

      // Refresh integrations list
      fetchIntegrations()
    } catch (err) {
      console.error('Failed to sync integration:', err)
      setError(err instanceof Error ? err.message : 'Failed to sync integration')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-700 bg-green-100'
      case 'inactive': return 'text-gray-700 bg-gray-100'
      case 'error': return 'text-red-700 bg-red-100'
      case 'syncing': return 'text-blue-700 bg-blue-100'
      case 'pending': return 'text-yellow-700 bg-yellow-100'
      default: return 'text-gray-700 bg-gray-100'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />
      case 'error': return <AlertCircle className="h-4 w-4" />
      case 'syncing': return <RefreshCw className="h-4 w-4 animate-spin" />
      case 'pending': return <Clock className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const handleIntegrationClick = (integration: AvailableIntegration) => {
    if (integration.isComingSoon) {
      return
    }

    switch (integration.platform) {
      case 'stripe':
        setShowStripeConnect(true)
        break
      case 'woocommerce':
        setShowWooCommerceConnect(true)
        break
      case 'shopify':
        // Handle Shopify connection - you can implement this
        console.log('Shopify integration clicked')
        break
      default:
        console.log(`${integration.name} integration clicked`)
    }
  }

  const isIntegrationConnected = (platform: string) => {
    return integrations.some(integration => 
      integration.platform === platform && integration.status === 'active'
    )
  }

  const filteredIntegrations = selectedCategory === 'all' 
    ? AVAILABLE_INTEGRATIONS 
    : AVAILABLE_INTEGRATIONS.filter(integration => integration.category === selectedCategory)

  if (loading && integrations.length === 0) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="text-gray-600 mt-1">
              Connect your business tools to get unified insights and analytics
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </div>
        )}

        {/* Connected Integrations */}
        {integrations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span>Connected Integrations</span>
              </CardTitle>
              <CardDescription>
                Your active integrations and their current status
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {integrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Database className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 capitalize">
                          {integration.platform}
                        </h3>
                        <p className="text-sm text-gray-600">
                          {integration.platformAccountId || 'Connected'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        getStatusColor(integration.status)
                      )}>
                        {getStatusIcon(integration.status)}
                        <span className="ml-1 capitalize">{integration.status}</span>
                      </span>
                      
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => handleSyncIntegration(integration.id)}
                          className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Sync now"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                        <button
                          className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteIntegration(integration.id)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Filter */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-2">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap",
                selectedCategory === category.id
                  ? "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              )}
            >
              <span>{category.name}</span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {category.count}
              </span>
            </button>
          ))}
        </div>

        {/* Available Integrations */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredIntegrations.map((integration) => {
            const isConnected = isIntegrationConnected(integration.platform)
            
            return (
              <Card 
                key={integration.id} 
                className={cn(
                  "relative group hover:shadow-lg transition-all duration-200 cursor-pointer",
                  isConnected && "ring-2 ring-green-200 bg-green-50/30",
                  integration.isComingSoon && "opacity-75"
                )}
                onClick={() => !isConnected && handleIntegrationClick(integration)}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center",
                        integration.platform === 'shopify' && "bg-green-100 text-green-600",
                        integration.platform === 'stripe' && "bg-purple-100 text-purple-600",
                        integration.platform === 'woocommerce' && "bg-blue-100 text-blue-600",
                        integration.platform === 'google_analytics' && "bg-orange-100 text-orange-600",
                        integration.platform === 'mailchimp' && "bg-yellow-100 text-yellow-600",
                        integration.platform === 'facebook_ads' && "bg-blue-100 text-blue-600"
                      )}>
                        {integration.icon}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{integration.name}</CardTitle>
                        <div className="flex items-center space-x-2 mt-1">
                          <span className="text-xs text-gray-500 capitalize bg-gray-100 px-2 py-1 rounded-md">
                            {integration.category}
                          </span>
                          {integration.isPopular && (
                            <span className="inline-flex items-center text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded-md">
                              <Star className="h-3 w-3 mr-1" />
                              Popular
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {isConnected && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Connected
                      </span>
                    )}
                    
                    {integration.isComingSoon && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                    {integration.description}
                  </p>
                  
                  <div className="mb-6">
                    <h4 className="text-xs font-medium text-gray-700 mb-3 uppercase tracking-wide">
                      Key Features
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {integration.features.slice(0, 4).map((feature, idx) => (
                        <div key={idx} className="flex items-center text-sm text-gray-600">
                          <Check className="h-3 w-3 text-green-500 mr-2 flex-shrink-0" />
                          {feature}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      Setup time: {integration.setupTime}
                    </span>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        if (!isConnected) handleIntegrationClick(integration)
                      }}
                      disabled={isConnected || integration.isComingSoon}
                      className={cn(
                        "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                        isConnected
                          ? "bg-green-100 text-green-700 cursor-not-allowed"
                          : integration.isComingSoon
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-blue-600 text-white hover:bg-blue-700 shadow-md hover:shadow-lg"
                      )}
                    >
                      {isConnected ? (
                        "Connected"
                      ) : integration.isComingSoon ? (
                        "Coming Soon"
                      ) : (
                        "Connect"
                      )}
                    </button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Help Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <MessageSquare className="h-6 w-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Need help setting up integrations?
                </h3>
                <p className="text-gray-600 mb-4">
                  Our setup guides walk you through connecting each integration step-by-step. 
                  Most integrations take less than 5 minutes to set up.
                </p>
                <div className="flex items-center space-x-4">
                  <button className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
                    <ExternalLink className="mr-1 h-4 w-4" />
                    View Setup Guides
                  </button>
                  <button className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium">
                    <MessageSquare className="mr-1 h-4 w-4" />
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stripe Connect Modal */}
      {showStripeConnect && organizationId && (
        <StripeConnect
          isOpen={showStripeConnect}
          onClose={() => setShowStripeConnect(false)}
          onSuccess={(integration) => {
            setShowStripeConnect(false)
            fetchIntegrations() // Refresh the integrations list
          }}
          organizationId={organizationId}
        />
      )}

      {/* WooCommerce Connect Modal */}
      {showWooCommerceConnect && organizationId && (
        <WooCommerceConnect
          isOpen={showWooCommerceConnect}
          onClose={() => setShowWooCommerceConnect(false)}
          onSuccess={(integration) => {
            setShowWooCommerceConnect(false)
            fetchIntegrations() // Refresh the integrations list
          }}
          organizationId={organizationId}
        />
      )}
    </DashboardLayout>
  )
}