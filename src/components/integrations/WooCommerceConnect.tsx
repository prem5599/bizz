// src/components/integrations/WooCommerceConnect.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ShoppingCart, Check, AlertCircle, CheckCircle2, Eye, EyeOff, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WooCommerceConnectProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (integration: any) => void
  organizationId: string
}

export function WooCommerceConnect({ isOpen, onClose, onSuccess, organizationId }: WooCommerceConnectProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'connect' | 'connecting' | 'success'>('connect')
  
  // Form state
  const [storeUrl, setStoreUrl] = useState('')
  const [consumerKey, setConsumerKey] = useState('')
  const [consumerSecret, setConsumerSecret] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const handleConnect = async () => {
    if (!storeUrl || !consumerKey || !consumerSecret) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    setError(null)
    setStep('connecting')

    try {
      const response = await fetch('/api/integrations/woocommerce/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          storeUrl: storeUrl.trim(),
          consumerKey: consumerKey.trim(),
          consumerSecret: consumerSecret.trim(),
          returnUrl: window.location.href
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect to WooCommerce store')
      }

      setStep('success')
      
      // Call success callback after a brief delay to show success state
      setTimeout(() => {
        onSuccess(data.integration)
        handleClose()
      }, 2000)

    } catch (error) {
      console.error('WooCommerce connection error:', error)
      setError(error instanceof Error ? error.message : 'Failed to connect to WooCommerce store')
      setStep('connect')
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      onClose()
      // Reset state
      setStep('connect')
      setError(null)
      setStoreUrl('')
      setConsumerKey('')
      setConsumerSecret('')
      setShowSecret(false)
    }
  }

  const handleStoreUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let url = e.target.value.trim()
    
    // Auto-add https:// if no protocol is specified
    if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url
    }
    
    setStoreUrl(url)
    setError(null)
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg mr-3">
              <ShoppingCart className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Connect WooCommerce Store</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'connect' && (
            <>
              <div className="mb-6">
                <p className="text-gray-600 mb-4">
                  Connect your WooCommerce store to automatically sync order data, products, customers, and coupon metrics.
                </p>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">What we'll sync:</h4>
                  <ul className="space-y-1 text-sm text-blue-800">
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-blue-600 mr-2" />
                      Orders and revenue data
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-blue-600 mr-2" />
                      Product catalog and inventory
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-blue-600 mr-2" />
                      Customer profiles and data
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-blue-600 mr-2" />
                      Coupons and discount usage
                    </li>
                    <li className="flex items-center">
                      <Check className="h-4 w-4 text-blue-600 mr-2" />
                      Real-time updates via webhooks
                    </li>
                  </ul>
                </div>

                {/* Connection Form */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Store URL *
                    </label>
                    <input
                      type="url"
                      value={storeUrl}
                      onChange={handleStoreUrlChange}
                      placeholder="https://yourstore.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Your WooCommerce store URL (with https://)
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Consumer Key *
                    </label>
                    <input
                      type="text"
                      value={consumerKey}
                      onChange={(e) => {
                        setConsumerKey(e.target.value)
                        setError(null)
                      }}
                      placeholder="ck_..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                      disabled={loading}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Consumer Secret *
                    </label>
                    <div className="relative">
                      <input
                        type={showSecret ? "text" : "password"}
                        value={consumerSecret}
                        onChange={(e) => {
                          setConsumerSecret(e.target.value)
                          setError(null)
                        }}
                        placeholder="cs_..."
                        className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        disabled={loading}
                      >
                        {showSecret ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                  <h4 className="text-sm font-medium text-yellow-900 mb-2">
                    How to get API credentials:
                  </h4>
                  <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
                    <li>Go to your WooCommerce admin → WooCommerce → Settings</li>
                    <li>Click the "Advanced" tab, then "REST API"</li>
                    <li>Click "Add key" to create new API credentials</li>
                    <li>Set permissions to "Read/Write" and generate the key</li>
                    <li>Copy the Consumer Key and Consumer Secret here</li>
                  </ol>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <div className="flex items-center">
                    <AlertCircle className="h-4 w-4 text-red-500 mr-2" />
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'connecting' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Connecting to WooCommerce</h3>
              <p className="text-gray-600">Testing connection and setting up integration...</p>
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-800">
                  This may take a few seconds while we verify your store and set up webhooks.
                </p>
              </div>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">WooCommerce Connected!</h3>
              <p className="text-gray-600">Your store has been successfully connected and data sync has started.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'connect' && (
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <button
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={loading || !storeUrl || !consumerKey || !consumerSecret}
              className={cn(
                "px-4 py-2 text-sm font-medium text-white rounded-md",
                "bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center"
              )}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <span>Connect Store</span>
            </button>
          </div>
        )}

        {step === 'connecting' && (
          <div className="px-6 py-4 border-t border-gray-200 text-center">
            <p className="text-sm text-gray-500">
              Setting up webhooks and starting initial data sync...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// Alternative simplified version for testing
export function SimpleWooCommerceConnect({ 
  organizationId, 
  onSuccess, 
  className 
}: {
  organizationId: string
  onSuccess?: (integration: any) => void
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <div className={cn("space-y-3", className)}>
        <button
          onClick={() => setIsOpen(true)}
          className={cn(
            "w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-colors",
            "bg-purple-600 text-white hover:bg-purple-700",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          <ShoppingCart className="h-4 w-4 mr-2" />
          Connect WooCommerce Store
        </button>

        <div className="text-xs text-gray-500 text-center">
          Secure connection using API keys
        </div>
      </div>

      <WooCommerceConnect
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSuccess={(integration) => {
          setIsOpen(false)
          onSuccess?.(integration)
        }}
        organizationId={organizationId}
      />
    </>
  )
}

// Component to show WooCommerce connection status
export function WooCommerceConnectionStatus({ 
  organizationId, 
  className 
}: {
  organizationId: string
  className?: string
}) {
  const [integration, setIntegration] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const checkConnectionStatus = async () => {
      try {
        const response = await fetch(`/api/integrations/woocommerce/connect?organizationId=${organizationId}`)
        const data = await response.json()

        if (response.ok) {
          setIntegration(data.integration)
        } else {
          setError(data.error || 'Failed to check connection status')
        }
      } catch (error) {
        console.error('Error checking WooCommerce connection:', error)
        setError('Failed to check connection status')
      } finally {
        setLoading(false)
      }
    }

    checkConnectionStatus()
  }, [organizationId])

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center p-4", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        <span className="ml-2 text-sm text-gray-600">Checking connection...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className={cn("flex items-center p-4 bg-red-50 border border-red-200 rounded-lg", className)}>
        <AlertCircle className="h-5 w-5 text-red-500" />
        <span className="ml-2 text-sm text-red-700">{error}</span>
      </div>
    )
  }

  if (!integration || !integration.connected) {
    return (
      <div className={cn("flex items-center p-4 bg-yellow-50 border border-yellow-200 rounded-lg", className)}>
        <AlertCircle className="h-5 w-5 text-yellow-500" />
        <span className="ml-2 text-sm text-yellow-700">WooCommerce not connected</span>
      </div>
    )
  }

  const metadata = integration.metadata || {}
  
  return (
    <div className={cn("p-4 bg-green-50 border border-green-200 rounded-lg", className)}>
      <div className="flex items-start justify-between">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-900">
              WooCommerce Connected
            </h3>
            <div className="mt-1 space-y-1">
              {metadata.storeName && (
                <p className="text-xs text-green-700">
                  Store: {metadata.storeName}
                </p>
              )}
              {metadata.storeUrl && (
                <p className="text-xs text-green-700">
                  URL: {new URL(metadata.storeUrl).hostname}
                </p>
              )}
              {integration.lastSyncAt && (
                <p className="text-xs text-green-700">
                  Last sync: {new Date(integration.lastSyncAt).toLocaleDateString()}
                </p>
              )}
              {integration.dataPointsCount > 0 && (
                <p className="text-xs text-green-700">
                  {integration.dataPointsCount.toLocaleString()} data points synced
                </p>
              )}
              {metadata.currency && (
                <p className="text-xs text-green-700">
                  Currency: {metadata.currency}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Active
          </span>
        </div>
      </div>
    </div>
  )
}

export default WooCommerceConnect