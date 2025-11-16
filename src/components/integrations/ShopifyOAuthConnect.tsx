// src/components/integrations/ShopifyOAuthConnect.tsx
'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, ShoppingBag, Check, ExternalLink, Key, Globe, PlayCircle } from 'lucide-react'

interface ShopifyOAuthConnectProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (integration: unknown) => void
  organizationId?: string  // Add optional organizationId prop
}

export function ShopifyOAuthConnect({ isOpen, onClose, onSuccess, organizationId }: ShopifyOAuthConnectProps) {
  const [shopDomain, setShopDomain] = useState('')
  const [accessToken, setAccessToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'method' | 'domain' | 'token' | 'connecting' | 'success'>('method')
  const [authMethod, setAuthMethod] = useState<'oauth' | 'private' | 'demo'>('oauth')
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(organizationId || null)

  // Fetch organization if not provided
  useEffect(() => {
    if (!currentOrgId && isOpen) {
      fetchOrganization()
    }
  }, [isOpen, currentOrgId])

  const fetchOrganization = async () => {
    try {
      const response = await fetch('/api/organizations/me')
      if (!response.ok) throw new Error('Failed to fetch organization')
      
      const data = await response.json()
      const defaultOrg = data.organizations?.[0]
      
      if (defaultOrg) {
        setCurrentOrgId(defaultOrg.id)
      } else {
        setError('No organization found. Please create an organization first.')
      }
    } catch (error) {
      console.error('Error fetching organization:', error)
      setError('Failed to fetch organization')
    }
  }

  const handleMethodSelect = (method: 'oauth' | 'private' | 'demo') => {
    setAuthMethod(method)
    if (method === 'demo') {
      setStep('domain')
    } else {
      setStep('domain')
    }
  }

  const handleDomainSubmit = () => {
    if (!shopDomain.trim()) {
      setError('Please enter your shop domain')
      return
    }

    if (authMethod === 'oauth') {
      handleOAuthFlow()
    } else if (authMethod === 'demo') {
      handleDemoConnect()
    } else {
      setStep('token')
    }
  }

  const handleOAuthFlow = async () => {
    if (!currentOrgId) {
      setError('Organization not found. Please refresh and try again.')
      return
    }

    setLoading(true)
    setError(null)
    setStep('connecting')

    try {
      const cleanDomain = shopDomain.trim().toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\.myshopify\.com\/?$/, '')

      // Generate OAuth URL
      const response = await fetch('/api/integrations/shopify/oauth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          shopDomain: cleanDomain,
          organizationId: currentOrgId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate OAuth URL')
      }

      // OAuth endpoint returns a redirectUrl for Shopify authorization
      if (data.success && data.redirectUrl) {
        // Redirect to Shopify OAuth authorization page
        window.location.href = data.redirectUrl
        return
      } else {
        throw new Error(data.error || 'Failed to get OAuth redirect URL')
      }

    } catch (error) {
      console.error('OAuth flow error:', error)
      setError(error instanceof Error ? error.message : 'OAuth flow failed')
      setStep('domain')
      setLoading(false)
    }
  }

  const handleDemoConnect = async () => {
    if (!currentOrgId) {
      setError('Organization not found. Please refresh and try again.')
      return
    }

    setLoading(true)
    setError(null)
    setStep('connecting')

    try {
      const response = await fetch('/api/integrations/shopify/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          storeName: shopDomain.trim(),
          organizationId: currentOrgId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create demo integration')
      }

      setStep('success')
      onSuccess(data.integration)

    } catch (error) {
      console.error('Demo connection error:', error)
      setError(error instanceof Error ? error.message : 'Demo connection failed')
      setStep('domain')
    } finally {
      setLoading(false)
    }
  }

  const handleTokenConnect = async () => {
    const trimmedToken = accessToken.trim()
    
    if (!trimmedToken) {
      setError('Please enter your access token')
      return
    }

    if (!trimmedToken.startsWith('shpat_')) {
      setError('Access token must start with "shpat_". Please check your token.')
      return
    }

    if (!currentOrgId) {
      setError('Organization not found. Please refresh and try again.')
      return
    }

    setLoading(true)
    setError(null)
    setStep('connecting')

    try {
      console.log('🔄 Connecting with token:', {
        domainOriginal: shopDomain,
        domainTrimmed: shopDomain.trim(),
        tokenLength: trimmedToken.length,
        tokenStart: trimmedToken.substring(0, 10),
        hasOrgId: !!currentOrgId
      })

      const response = await fetch('/api/integrations/shopify/private-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopDomain: shopDomain.trim(),
          accessToken: trimmedToken,
          organizationId: currentOrgId  // Add the missing organizationId
        })
      })

      console.log('📡 Response received:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      })

      let data: any
      try {
        const responseText = await response.text()
        console.log('📝 Raw response text:', responseText)
        
        if (responseText) {
          data = JSON.parse(responseText)
          console.log('📊 Parsed response data:', data)
        } else {
          console.error('❌ Empty response body')
          data = { error: 'Empty response from server' }
        }
      } catch (parseError) {
        console.error('❌ JSON Parse Error:', parseError)
        data = { error: 'Invalid response format from server' }
      }

      if (!response.ok) {
        console.error('❌ API Error:', {
          status: response.status,
          statusText: response.statusText,
          data
        })
        
        // Provide more specific error messages
        if (response.status === 401) {
          throw new Error('Invalid access token. Please check your token and try again.')
        } else if (response.status === 404) {
          throw new Error('Shop not found. Please check your shop domain.')
        } else if (response.status === 400) {
          throw new Error(data?.error || 'Bad request. Please check your shop domain and token.')
        } else if (response.status === 500) {
          throw new Error(data?.details || data?.error || 'Internal server error. Please try again.')
        } else {
          throw new Error(data?.error || `HTTP ${response.status}: ${response.statusText}`)
        }
      }

      // Success
      setStep('success')
      onSuccess(data.integration)

    } catch (error) {
      console.error('❌ Token connection error:', error)
      setError(error instanceof Error ? error.message : 'Connection failed')
      setStep('token')
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setShopDomain('')
    setAccessToken('')
    setError(null)
    setStep('method')
    setLoading(false)
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center">
            <ShoppingBag className="h-6 w-6 text-green-600 mr-3" />
            <h2 className="text-xl font-semibold text-gray-900">Connect Shopify Store</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Method Selection */}
          {step === 'method' && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Choose Connection Method</h3>
                <p className="text-sm text-gray-600">Select how you'd like to connect your Shopify store</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => handleMethodSelect('oauth')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-300 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <Globe className="h-6 w-6 text-blue-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-900">OAuth App (Recommended)</div>
                      <div className="text-sm text-gray-600">Connect using Shopify OAuth - most secure</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleMethodSelect('private')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-green-300 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <Key className="h-6 w-6 text-green-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-900">Private App</div>
                      <div className="text-sm text-gray-600">Connect using access token</div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => handleMethodSelect('demo')}
                  className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-purple-300 transition-colors text-left"
                >
                  <div className="flex items-center">
                    <PlayCircle className="h-6 w-6 text-purple-600 mr-3" />
                    <div>
                      <div className="font-medium text-gray-900">Demo Store</div>
                      <div className="text-sm text-gray-600">Test with sample data - no real store needed</div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Domain Input */}
          {step === 'domain' && (
            <div className="space-y-4">
              {authMethod === 'demo' && (
                <div className="p-3 bg-purple-50 border border-purple-200 rounded-md">
                  <p className="text-sm text-purple-800">
                    🎭 <strong>Demo Mode:</strong> This will create a demo store with sample data for testing purposes. No real Shopify store is needed.
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {authMethod === 'demo' ? 'Demo Store Name' : 'Shop Domain'}
                </label>
                <input
                  type="text"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  placeholder={authMethod === 'demo' ? 'my-demo-store' : 'mystore or mystore.myshopify.com'}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  disabled={loading}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {authMethod === 'demo' 
                    ? 'Enter a name for your demo store (e.g., "my-test-store")'
                    : 'Enter your shop domain (with or without .myshopify.com)'
                  }
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('method')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={loading}
                >
                  ← Back
                </button>
                <button
                  onClick={handleDomainSubmit}
                  disabled={loading || !shopDomain.trim()}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {/* Token Input (Private App) */}
          {step === 'token' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-medium text-blue-900 mb-2">Create a Private App</h4>
                <div className="text-sm text-blue-800">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to your Shopify admin → Apps → &quot;App and sales channel settings&quot;</li>
                    <li>Click &quot;Develop apps&quot; → &quot;Create an app&quot;</li>
                    <li>Configure API scopes: read_orders, read_customers, read_products, read_analytics, read_reports, read_inventory, read_fulfillments, read_checkouts</li>
                    <li>Install the app and copy the access token</li>
                  </ol>
                  <a
                    href={`https://${shopDomain.replace(/\.myshopify\.com$/, '')}.myshopify.com/admin/settings/apps`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center mt-2 text-blue-600 hover:text-blue-800"
                  >
                    Open Shopify Admin <ExternalLink className="h-4 w-4 ml-1" />
                  </a>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Access Token
                </label>
                <input
                  type="text"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="shpat_..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-green-500 focus:border-green-500 font-mono text-sm"
                  disabled={loading}
                  style={{ fontFamily: 'monospace' }}
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your token will be encrypted and stored securely
                </p>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep('domain')}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                  disabled={loading}
                >
                  ← Back
                </button>
                <button
                  onClick={handleTokenConnect}
                  disabled={loading || !accessToken.trim()}
                  className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
                >
                  Connect Store
                </button>
              </div>
            </div>
          )}

          {/* Connecting State */}
          {step === 'connecting' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {authMethod === 'oauth' ? 'Preparing OAuth Authorization...' : 
                 authMethod === 'demo' ? 'Creating demo store...' : 'Connecting to your store...'}
              </h3>
              <p className="text-gray-600">
                {authMethod === 'oauth' 
                  ? 'Please wait while we prepare your Shopify authorization. You will be redirected shortly.'
                  : authMethod === 'demo'
                  ? 'Setting up demo store with sample data...'
                  : 'Please wait while we verify your store connection.'
                }
              </p>
            </div>
          )}

          {/* Success State */}
          {step === 'success' && (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Successfully Connected!
              </h3>
              <p className="text-gray-600 mb-4">
                Your Shopify store has been connected and data sync has started.
              </p>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}