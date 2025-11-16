// src/components/integrations/GoogleAnalyticsConnect.tsx
'use client'

import { useState } from 'react'
import { X, Loader2, BarChart3, Check, ExternalLink, Globe, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface GoogleAnalyticsConnectProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (integration: any) => void
  organizationId: string
}

export function GoogleAnalyticsConnect({ isOpen, onClose, onSuccess, organizationId }: GoogleAnalyticsConnectProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'connect' | 'connecting' | 'success'>('connect')

  const handleConnect = async () => {
    setLoading(true)
    setError(null)
    setStep('connecting')

    try {
      // Initiate Google Analytics OAuth flow
      const response = await fetch('/api/integrations/google-analytics/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Google Analytics connection')
      }

      // Redirect to Google Analytics OAuth
      window.location.href = data.authUrl

    } catch (error) {
      console.error('Google Analytics connection error:', error)
      setError(error instanceof Error ? error.message : 'Failed to connect to Google Analytics')
      setStep('connect')
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <BarChart3 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Connect Google Analytics
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Get insights from your website traffic
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'connect' && (
            <>
              {/* Benefits */}
              <div className="space-y-4 mb-6">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                  What you'll get with Google Analytics:
                </h4>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-green-100 dark:bg-green-900/20 rounded">
                      <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Website Traffic Data</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Sessions, users, pageviews, and bounce rates</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-blue-100 dark:bg-blue-900/20 rounded">
                      <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Traffic Sources</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Understand where your visitors come from</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-purple-100 dark:bg-purple-900/20 rounded">
                      <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Device & Location Analytics</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">See how users interact across devices</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Security Notice */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Check className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                      Secure & Read-Only Access
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                      BizInsights will only read your analytics data. We cannot modify your Google Analytics settings or data.
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={loading}
                className={cn(
                  "w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors",
                  "bg-orange-600 hover:bg-orange-700 text-white",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <BarChart3 className="w-5 h-5" />
                )}
                {loading ? 'Connecting...' : 'Connect Google Analytics'}
                {!loading && <ExternalLink className="w-4 h-4" />}
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                You'll be redirected to Google to authorize access
              </p>
            </>
          )}

          {step === 'connecting' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full mb-4">
                <Loader2 className="w-8 h-8 text-orange-600 dark:text-orange-400 animate-spin" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Connecting to Google Analytics...
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Please complete the authorization in the popup window
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full mb-4">
                <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Google Analytics Connected!
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Your website analytics data is now being synchronized
              </p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
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

// Simple button version for inline use
interface GoogleAnalyticsConnectButtonProps {
  organizationId: string
  onSuccess?: (integration: any) => void
  className?: string
  children?: React.ReactNode
}

export function GoogleAnalyticsConnectButton({ 
  organizationId, 
  onSuccess, 
  className,
  children 
}: GoogleAnalyticsConnectButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/integrations/google-analytics/oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to initiate Google Analytics connection')
      }

      // Redirect to Google Analytics OAuth
      window.location.href = data.authUrl

    } catch (error) {
      console.error('Google Analytics connection error:', error)
      setError(error instanceof Error ? error.message : 'Failed to connect to Google Analytics')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleConnect}
        disabled={loading}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
          "bg-orange-600 hover:bg-orange-700 text-white",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className
        )}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <BarChart3 className="w-4 h-4" />
        )}
        {children || (loading ? 'Connecting...' : 'Connect Google Analytics')}
        {!loading && <ExternalLink className="w-3 h-3" />}
      </button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}