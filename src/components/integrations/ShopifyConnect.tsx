// src/components/integrations/ShopifyConnect.tsx
'use client'

import { useState } from 'react'
import { X, Loader2, ShoppingBag, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShopifyConnectProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (integration: any) => void
}

export function ShopifyConnect({ isOpen, onClose, onSuccess }: ShopifyConnectProps) {
  const [shopDomain, setShopDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'domain' | 'connecting' | 'success'>('domain')

  const handleConnect = async () => {
    if (!shopDomain.trim()) {
      setError('Please enter your shop domain')
      return
    }

    setLoading(true)
    setError(null)
    setStep('connecting')

    try {
      const response = await fetch('/api/integrations/shopify/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          shopDomain: shopDomain.trim()
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Shopify store')
      }

      setStep('success')
      
      // Wait a moment to show success, then call onSuccess
      setTimeout(() => {
        onSuccess(data.integration)
        onClose()
        // Reset component state
        setStep('domain')
        setShopDomain('')
        setError(null)
      }, 2000)

    } catch (error) {
      console.error('Shopify connection error:', error)
      setError(error instanceof Error ? error.message : 'Failed to connect store')
      setStep('domain')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (!loading) {
      onClose()
      // Reset state
      setStep('domain')
      setShopDomain('')
      setError(null)
    }
  }

  const handleDomainChange = (value: string) => {
    setShopDomain(value)
    setError(null) // Clear error when user starts typing
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg mr-3">
              <ShoppingBag className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Connect Shopify Store</h2>
          </div>
          <button
            onClick={handleCancel}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'domain' && (
            <>
              <div className="mb-4">
                <label htmlFor="shopDomain" className="block text-sm font-medium text-gray-700 mb-2">
                  Shopify Store Domain
                </label>
                <div className="relative">
                  <input
                    id="shopDomain"
                    type="text"
                    value={shopDomain}
                    onChange={(e) => handleDomainChange(e.target.value)}
                    placeholder="mystore.myshopify.com or mystore.com"
                    className={cn(
                      "w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                      error && "border-red-300 focus:ring-red-500"
                    )}
                    disabled={loading}
                  />
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  <p>Enter your shop domain in any of these formats:</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    <li>• <code>mystore.myshopify.com</code></li>
                    <li>• <code>mystore.com</code> (custom domain)</li>
                    <li>• <code>https://mystore.myshopify.com</code></li>
                    <li>• <code>mystore</code> (just the store name)</li>
                  </ul>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-900 mb-3">What we'll sync:</h3>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Order data and revenue
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Customer information
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Product catalog
                  </li>
                  <li className="flex items-center">
                    <Check className="h-4 w-4 text-green-500 mr-2" />
                    Real-time order updates
                  </li>
                </ul>
              </div>
            </>
          )}

          {step === 'connecting' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Connecting to Shopify</h3>
              <p className="text-gray-600">Setting up your store integration...</p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Store Connected!</h3>
              <p className="text-gray-600">Your Shopify store has been successfully connected.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'domain' && (
          <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
            <button
              onClick={handleCancel}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConnect}
              disabled={loading || !shopDomain.trim()}
              className={cn(
                "px-4 py-2 text-sm font-medium text-white rounded-md",
                "bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed",
                "flex items-center"
              )}
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect Store
            </button>
          </div>
        )}
      </div>
    </div>
  )
}