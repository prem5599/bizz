// src/components/integrations/ShopifyAdvancedConnect.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Store, 
  Settings, 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  ExternalLink, 
  Loader2, 
  ArrowRight, 
  ArrowLeft,
  Key,
  Zap,
  Globe,
  Lock,
  Info,
  Copy,
  Eye,
  EyeOff
} from 'lucide-react'
import ShopifyScopeSelector from './ShopifyScopeSelector'
import { 
  ShopifyScopeManager, 
  DEFAULT_SCOPE_SETS 
} from '@/lib/integrations/shopify-scopes'

interface ShopifyAdvancedConnectProps {
  onSuccess?: (integration: any) => void
  onError?: (error: string) => void
  existingIntegration?: any
  disabled?: boolean
}

type AuthMethod = 'oauth' | 'private_app'
type ConnectionStep = 'method' | 'scopes' | 'setup' | 'connect' | 'connecting' | 'success'

interface ConnectionState {
  step: ConnectionStep
  authMethod: AuthMethod
  selectedScopes: string[]
  shopDomain: string
  accessToken: string
  clientId: string
  clientSecret: string
  testing: boolean
  error: string | null
}

export default function ShopifyAdvancedConnect({
  onSuccess,
  onError,
  existingIntegration,
  disabled = false
}: ShopifyAdvancedConnectProps) {
  const [state, setState] = useState<ConnectionState>({
    step: 'method',
    authMethod: 'oauth',
    selectedScopes: DEFAULT_SCOPE_SETS.basic.scopes,
    shopDomain: '',
    accessToken: '',
    clientId: '',
    clientSecret: '',
    testing: false,
    error: null
  })

  const [showToken, setShowToken] = useState(false)
  const [validationResults, setValidationResults] = useState<any>(null)

  // Progress calculation
  const getProgress = () => {
    const stepProgress = {
      method: 20,
      scopes: 40,
      setup: 60,
      connect: 80,
      connecting: 90,
      success: 100
    }
    return stepProgress[state.step] || 0
  }

  // Validate current configuration
  const validateConfiguration = () => {
    const scopeValidation = ShopifyScopeManager.validateScopes(state.selectedScopes)
    const domainValid = state.shopDomain.trim().length > 0
    const tokenValid = state.authMethod === 'private_app' ? 
      state.accessToken.trim().startsWith('shpat_') : true
    const oauthValid = state.authMethod === 'oauth' ? 
      state.clientId.trim().length > 0 && state.clientSecret.trim().length > 0 : true

    return {
      scopes: scopeValidation,
      domain: domainValid,
      token: tokenValid,
      oauth: oauthValid,
      overall: scopeValidation.valid && domainValid && tokenValid && oauthValid
    }
  }

  // Test Shopify connection
  const testConnection = async () => {
    setState(prev => ({ ...prev, testing: true, error: null }))
    
    try {
      const cleanDomain = state.shopDomain
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\.myshopify\.com\/?$/, '')
        .replace(/\/.*$/, '')

      let testUrl: string
      let headers: Record<string, string>

      if (state.authMethod === 'private_app') {
        testUrl = `https://${cleanDomain}.myshopify.com/admin/api/2023-10/shop.json`
        headers = {
          'X-Shopify-Access-Token': state.accessToken,
          'Content-Type': 'application/json'
        }
      } else {
        // For OAuth, we can't test directly without going through the flow
        // Instead, validate the OAuth app configuration
        testUrl = `https://${cleanDomain}.myshopify.com/admin/oauth/authorize?client_id=${state.clientId}&scope=read_products&redirect_uri=https://example.com&state=test`
        headers = {}
      }

      const response = await fetch('/api/integrations/shopify/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: cleanDomain,
          accessToken: state.authMethod === 'private_app' ? state.accessToken : undefined,
          clientId: state.authMethod === 'oauth' ? state.clientId : undefined,
          method: state.authMethod
        })
      })

      const result = await response.json()
      
      if (result.success) {
        setValidationResults({
          success: true,
          shopName: result.shopName,
          plan: result.plan,
          country: result.country
        })
      } else {
        throw new Error(result.error || 'Connection test failed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection test failed'
      setState(prev => ({ ...prev, error: errorMessage }))
      setValidationResults({ success: false, error: errorMessage })
    } finally {
      setState(prev => ({ ...prev, testing: false }))
    }
  }

  // Handle OAuth flow
  const initiateOAuthFlow = () => {
    const scopeString = ShopifyScopeManager.buildScopeString(state.selectedScopes)
    const stateParam = btoa(JSON.stringify({ 
      scopes: state.selectedScopes,
      timestamp: Date.now() 
    }))
    
    const cleanDomain = state.shopDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\.myshopify\.com\/?$/, '')
      .replace(/\/.*$/, '')

    const authUrl = `https://${cleanDomain}.myshopify.com/admin/oauth/authorize?` +
      `client_id=${state.clientId}&` +
      `scope=${encodeURIComponent(scopeString)}&` +
      `redirect_uri=${encodeURIComponent(window.location.origin + '/api/integrations/shopify/callback')}&` +
      `state=${stateParam}`

    setState(prev => ({ ...prev, step: 'connecting' }))
    window.location.href = authUrl
  }

  // Handle private app connection
  const connectPrivateApp = async () => {
    setState(prev => ({ ...prev, step: 'connecting', error: null }))

    try {
      const response = await fetch('/api/integrations/shopify/private-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopDomain: state.shopDomain,
          accessToken: state.accessToken,
          selectedScopes: state.selectedScopes
        })
      })

      const result = await response.json()

      if (result.success) {
        setState(prev => ({ ...prev, step: 'success' }))
        onSuccess?.(result.integration)
      } else {
        throw new Error(result.error || 'Connection failed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed'
      setState(prev => ({ ...prev, error: errorMessage, step: 'connect' }))
      onError?.(errorMessage)
    }
  }

  // Navigation helpers
  const goToStep = (step: ConnectionStep) => {
    setState(prev => ({ ...prev, step, error: null }))
  }

  const canProceed = () => {
    const validation = validateConfiguration()
    switch (state.step) {
      case 'method': return true
      case 'scopes': return validation.scopes.valid
      case 'setup': return validation.domain
      case 'connect': return validation.overall
      default: return false
    }
  }

  // Render method selection
  const renderMethodSelection = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Integration Method</h2>
        <p className="text-gray-600">Select how you'd like to connect your Shopify store</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* OAuth Method */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${
            state.authMethod === 'oauth' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}
          onClick={() => setState(prev => ({ ...prev, authMethod: 'oauth' }))}
        >
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-lg bg-blue-100">
                <Globe className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <span>OAuth App</span>
                  <Badge variant="secondary">Recommended</Badge>
                </CardTitle>
                <CardDescription>Secure, user-friendly connection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Easy setup for users</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Granular permission control</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Automatic token refresh</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-orange-600">
                <Info className="h-4 w-4" />
                <span>Requires app registration</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Private App Method */}
        <Card 
          className={`cursor-pointer transition-all hover:shadow-lg ${
            state.authMethod === 'private_app' ? 'ring-2 ring-blue-500 bg-blue-50' : ''
          }`}
          onClick={() => setState(prev => ({ ...prev, authMethod: 'private_app' }))}
        >
          <CardHeader>
            <div className="flex items-center space-x-3">
              <div className="p-3 rounded-lg bg-purple-100">
                <Key className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <CardTitle>Private App</CardTitle>
                <CardDescription>Direct access token connection</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Quick setup</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                <span>Direct API access</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-orange-600">
                <Info className="h-4 w-4" />
                <span>Manual token management</span>
              </div>
              <div className="flex items-center space-x-2 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>Store admin access required</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button 
          onClick={() => goToStep('scopes')}
          className="px-8"
        >
          Next: Configure Permissions
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )

  // Render scope selection
  const renderScopeSelection = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Configure Permissions</h2>
          <p className="text-gray-600">Choose which data you need to access from Shopify</p>
        </div>
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          {state.authMethod === 'oauth' ? 'OAuth App' : 'Private App'}
        </Badge>
      </div>

      <ShopifyScopeSelector
        selectedScopes={state.selectedScopes}
        onScopeChange={(scopes) => setState(prev => ({ ...prev, selectedScopes: scopes }))}
        disabled={disabled}
        showPresets={true}
        compact={false}
      />

      <div className="flex justify-between">
        <Button 
          variant="outline"
          onClick={() => goToStep('method')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={() => goToStep('setup')}
          disabled={!canProceed()}
        >
          Next: Store Setup
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )

  // Render setup instructions
  const renderSetupInstructions = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Store Configuration</h2>
        <p className="text-gray-600">
          {state.authMethod === 'oauth' 
            ? 'Configure your OAuth app settings' 
            : 'Set up your private app and get access token'
          }
        </p>
      </div>

      {/* Shop Domain */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Store className="h-5 w-5" />
            <span>Shop Domain</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label htmlFor="shopDomain">Shopify Store Domain</Label>
            <div className="flex">
              <Input
                id="shopDomain"
                placeholder="your-store"
                value={state.shopDomain}
                onChange={(e) => setState(prev => ({ ...prev, shopDomain: e.target.value }))}
                className="rounded-r-none"
              />
              <div className="px-3 py-2 bg-gray-100 border border-l-0 rounded-r-md text-sm text-gray-600">
                .myshopify.com
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Enter your Shopify store's subdomain (e.g., "my-store" for my-store.myshopify.com)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* OAuth Configuration */}
      {state.authMethod === 'oauth' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="h-5 w-5" />
              <span>OAuth App Configuration</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Setup Required</AlertTitle>
                <AlertDescription>
                  Create an OAuth app in your Partner Dashboard with these settings:
                  <br />
                  <strong>Redirect URL:</strong> {window.location.origin}/api/integrations/shopify/callback
                  <br />
                  <strong>Scopes:</strong> {ShopifyScopeManager.buildScopeString(state.selectedScopes)}
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="clientId">Client ID</Label>
                  <Input
                    id="clientId"
                    value={state.clientId}
                    onChange={(e) => setState(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Enter your OAuth app client ID"
                  />
                </div>
                <div>
                  <Label htmlFor="clientSecret">Client Secret</Label>
                  <Input
                    id="clientSecret"
                    type="password"
                    value={state.clientSecret}
                    onChange={(e) => setState(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter your OAuth app client secret"
                  />
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open('https://partners.shopify.com/organizations', '_blank')}
              >
                Open Partner Dashboard
                <ExternalLink className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Private App Configuration */}
      {state.authMethod === 'private_app' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Key className="h-5 w-5" />
              <span>Private App Access Token</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Instructions</AlertTitle>
                <AlertDescription className="space-y-2">
                  <div>1. Go to your Shopify admin → Apps → "App and sales channel settings"</div>
                  <div>2. Click "Develop apps" → "Create an app"</div>
                  <div>3. Configure API scopes with the permissions you selected</div>
                  <div>4. Install the app and copy the Admin API access token</div>
                </AlertDescription>
              </Alert>

              <div>
                <Label htmlFor="accessToken">Admin API Access Token</Label>
                <div className="flex">
                  <Input
                    id="accessToken"
                    type={showToken ? 'text' : 'password'}
                    value={state.accessToken}
                    onChange={(e) => setState(prev => ({ ...prev, accessToken: e.target.value }))}
                    placeholder="shpat_..."
                    className="rounded-r-none font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowToken(!showToken)}
                    className="rounded-l-none border-l-0"
                  >
                    {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Token will be encrypted and stored securely
                </p>
              </div>

              {state.shopDomain && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(
                    `https://${state.shopDomain.replace(/\.myshopify\.com$/, '')}.myshopify.com/admin/settings/apps`,
                    '_blank'
                  )}
                >
                  Open Shopify Admin
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Test Connection */}
      {canProceed() && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Test Connection</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button
                onClick={testConnection}
                disabled={state.testing || !canProceed()}
                className="w-full"
              >
                {state.testing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Test Configuration
                  </>
                )}
              </Button>

              {validationResults && (
                <Alert className={validationResults.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
                  {validationResults.success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">Connection Successful!</AlertTitle>
                      <AlertDescription className="text-green-700">
                        Connected to <strong>{validationResults.shopName}</strong> 
                        {validationResults.plan && ` (${validationResults.plan})`}
                        {validationResults.country && ` in ${validationResults.country}`}
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <AlertTitle className="text-red-800">Connection Failed</AlertTitle>
                      <AlertDescription className="text-red-700">
                        {validationResults.error}
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-between">
        <Button 
          variant="outline"
          onClick={() => goToStep('scopes')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={() => goToStep('connect')}
          disabled={!canProceed() || !validationResults?.success}
        >
          Next: Connect Store
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )

  // Render final connection step
  const renderConnectionStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Ready to Connect</h2>
        <p className="text-gray-600">Review your configuration and connect your Shopify store</p>
      </div>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-600">Store Domain</Label>
                <p className="font-mono text-sm">{state.shopDomain}.myshopify.com</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Authentication Method</Label>
                <p className="text-sm">{state.authMethod === 'oauth' ? 'OAuth App' : 'Private App'}</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Selected Permissions</Label>
                <p className="text-sm">{state.selectedScopes.length} scopes selected</p>
              </div>
              <div>
                <Label className="text-sm font-medium text-gray-600">Connection Status</Label>
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-600">Verified</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {state.error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Connection Error</AlertTitle>
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between">
        <Button 
          variant="outline"
          onClick={() => goToStep('setup')}
          disabled={state.step === 'connecting'}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          onClick={state.authMethod === 'oauth' ? initiateOAuthFlow : connectPrivateApp}
          disabled={state.step === 'connecting'}
          className="bg-green-600 hover:bg-green-700"
        >
          {state.step === 'connecting' ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Connecting...
            </>
          ) : (
            <>
              Connect Shopify Store
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  )

  // Render success state
  const renderSuccess = () => (
    <div className="text-center space-y-6">
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-green-600" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Integration Successful!</h2>
        <p className="text-gray-600">Your Shopify store has been connected successfully</p>
      </div>
      
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Store Connected:</span>
              <span className="font-medium">{state.shopDomain}.myshopify.com</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Permissions:</span>
              <span className="font-medium">{state.selectedScopes.length} scopes</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Method:</span>
              <span className="font-medium">{state.authMethod === 'oauth' ? 'OAuth' : 'Private App'}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => window.location.reload()}>
        Continue to Dashboard
      </Button>
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-600">Setup Progress</span>
          <span className="text-sm text-gray-600">{getProgress()}%</span>
        </div>
        <Progress value={getProgress()} className="h-2" />
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg border shadow-sm p-6">
        {state.step === 'method' && renderMethodSelection()}
        {state.step === 'scopes' && renderScopeSelection()}
        {state.step === 'setup' && renderSetupInstructions()}
        {state.step === 'connect' && renderConnectionStep()}
        {state.step === 'connecting' && (
          <div className="text-center py-12">
            <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {state.authMethod === 'oauth' ? 'Redirecting to Shopify...' : 'Connecting to your store...'}
            </h3>
            <p className="text-gray-600">Please wait while we establish the connection.</p>
          </div>
        )}
        {state.step === 'success' && renderSuccess()}
      </div>
    </div>
  )
}