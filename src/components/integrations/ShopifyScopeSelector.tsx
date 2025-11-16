// src/components/integrations/ShopifyScopeSelector.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { 
  Shield, 
  ShieldAlert, 
  ShieldCheck, 
  Info, 
  ChevronDown, 
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Zap,
  Package,
  Users,
  BarChart3,
  Megaphone,
  Truck,
  CreditCard,
  FileText,
  Settings,
  Wrench
} from 'lucide-react'
import {
  SHOPIFY_SCOPES,
  SHOPIFY_SCOPE_CATEGORIES,
  DEFAULT_SCOPE_SETS,
  ShopifyScopeManager,
  type ShopifyScope,
  type ScopeCategory
} from '@/lib/integrations/shopify-scopes'

interface ShopifyScopeSelectorProps {
  selectedScopes: string[]
  onScopeChange: (scopes: string[]) => void
  disabled?: boolean
  showPresets?: boolean
  compact?: boolean
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  orders: <Package className="h-4 w-4" />,
  products: <Zap className="h-4 w-4" />,
  customers: <Users className="h-4 w-4" />,
  analytics: <BarChart3 className="h-4 w-4" />,
  marketing: <Megaphone className="h-4 w-4" />,
  fulfillment: <Truck className="h-4 w-4" />,
  financial: <CreditCard className="h-4 w-4" />,
  content: <FileText className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  advanced: <Wrench className="h-4 w-4" />
}

const RISK_LEVEL_CONFIG = {
  low: {
    icon: <ShieldCheck className="h-4 w-4 text-green-500" />,
    color: 'bg-green-50 border-green-200 text-green-800',
    badgeColor: 'bg-green-100 text-green-800'
  },
  medium: {
    icon: <Shield className="h-4 w-4 text-yellow-500" />,
    color: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  high: {
    icon: <ShieldAlert className="h-4 w-4 text-red-500" />,
    color: 'bg-red-50 border-red-200 text-red-800',
    badgeColor: 'bg-red-100 text-red-800'
  }
}

export default function ShopifyScopeSelector({
  selectedScopes,
  onScopeChange,
  disabled = false,
  showPresets = true,
  compact = false
}: ShopifyScopeSelectorProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['orders', 'products', 'customers', 'analytics']))
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Validate current selection
  const validation = ShopifyScopeManager.validateScopes(selectedScopes)
  const dataUsage = ShopifyScopeManager.estimateDataUsage(selectedScopes)

  // Handle scope toggle
  const handleScopeToggle = (scopeId: string, checked: boolean) => {
    if (disabled) return

    let newScopes: string[]
    
    if (checked) {
      // Add scope and resolve dependencies
      const scopesToAdd = ShopifyScopeManager.getResolveDependencies([...selectedScopes, scopeId])
      newScopes = Array.from(new Set(scopesToAdd))
    } else {
      // Remove scope (but keep required ones)
      const scope = ShopifyScopeManager.getScopeById(scopeId)
      if (scope?.required) return // Don't allow removing required scopes
      
      newScopes = selectedScopes.filter(id => id !== scopeId)
    }

    onScopeChange(newScopes)
    setSelectedPreset(null) // Clear preset selection when manually changing
  }

  // Handle preset selection
  const handlePresetSelect = (presetKey: string) => {
    const preset = DEFAULT_SCOPE_SETS[presetKey as keyof typeof DEFAULT_SCOPE_SETS]
    if (preset) {
      const resolvedScopes = ShopifyScopeManager.getResolveDependencies(preset.scopes)
      onScopeChange(resolvedScopes)
      setSelectedPreset(presetKey)
    }
  }

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  // Get category statistics
  const getCategoryStats = (categoryId: string) => {
    const categoryScopes = ShopifyScopeManager.getScopesByCategory(categoryId)
    const selectedCount = categoryScopes.filter(scope => selectedScopes.includes(scope.id)).length
    const totalCount = categoryScopes.length
    const requiredCount = categoryScopes.filter(scope => scope.required).length
    
    return { selectedCount, totalCount, requiredCount }
  }

  // Render scope item
  const renderScopeItem = (scope: ShopifyScope) => {
    const isSelected = selectedScopes.includes(scope.id)
    const riskConfig = RISK_LEVEL_CONFIG[scope.riskLevel]

    return (
      <div
        key={scope.id}
        className={`p-3 border rounded-lg transition-all ${
          isSelected ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200 hover:border-gray-300'
        } ${scope.required ? 'ring-2 ring-blue-100' : ''}`}
      >
        <div className="flex items-start space-x-3">
          <Checkbox
            id={scope.id}
            checked={isSelected}
            onCheckedChange={(checked) => handleScopeToggle(scope.id, checked as boolean)}
            disabled={disabled || scope.required}
            className="mt-1"
          />
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center space-x-2">
                <label
                  htmlFor={scope.id}
                  className={`font-medium text-sm cursor-pointer ${
                    scope.required ? 'text-blue-700' : 'text-gray-900'
                  }`}
                >
                  {scope.name}
                </label>
                
                {scope.required && (
                  <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                    Required
                  </Badge>
                )}
                
                {riskConfig.icon}
              </div>
              
              <Badge 
                variant="outline" 
                className={`text-xs ${riskConfig.badgeColor}`}
              >
                {scope.riskLevel}
              </Badge>
            </div>
            
            <p className="text-sm text-gray-600 mb-2">
              {scope.description}
            </p>
            
            {!compact && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-gray-500">Data Access:</p>
                <div className="flex flex-wrap gap-1">
                  {scope.dataAccess.map((data, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="text-xs bg-gray-50 text-gray-600"
                    >
                      {data}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Render category
  const renderCategory = (category: ScopeCategory) => {
    const scopes = ShopifyScopeManager.getScopesByCategory(category.id)
    const stats = getCategoryStats(category.id)
    const isExpanded = expandedCategories.has(category.id)

    return (
      <Card key={category.id} className="mb-4">
        <Collapsible open={isExpanded} onOpenChange={() => toggleCategory(category.id)}>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-gray-100">
                    {CATEGORY_ICONS[category.id]}
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center space-x-2">
                      <span>{category.name}</span>
                      <span className="text-sm font-normal text-gray-500">
                        ({stats.selectedCount}/{stats.totalCount})
                      </span>
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {category.description}
                    </CardDescription>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {stats.requiredCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {stats.requiredCount} required
                    </Badge>
                  )}
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="space-y-3">
                {scopes.map(renderScopeItem)}
              </div>
            </CardContent>
          </CollapsibleContent>
        </Collapsible>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Validation Alerts */}
      {!validation.valid && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Invalid Scope Selection</AlertTitle>
          <AlertDescription>
            {validation.missing.length > 0 && (
              <div>Missing required scopes: {validation.missing.join(', ')}</div>
            )}
            {validation.invalid.length > 0 && (
              <div>Invalid scopes: {validation.invalid.join(', ')}</div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Data Usage Indicator */}
      <Alert className={dataUsage.level === 'high' ? 'border-orange-200 bg-orange-50' : ''}>
        <Info className="h-4 w-4" />
        <AlertTitle>Data Usage: {dataUsage.level.charAt(0).toUpperCase() + dataUsage.level.slice(1)}</AlertTitle>
        <AlertDescription>
          Selected scopes will access {dataUsage.details.length} types of data including: {dataUsage.details.slice(0, 3).join(', ')}
          {dataUsage.details.length > 3 && ` and ${dataUsage.details.length - 3} more`}.
        </AlertDescription>
      </Alert>

      {/* Main Content */}
      <Tabs defaultValue="categories" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="categories">Categories</TabsTrigger>
          {showPresets && <TabsTrigger value="presets">Quick Setup</TabsTrigger>}
        </TabsList>

        {/* Presets Tab */}
        {showPresets && (
          <TabsContent value="presets" className="space-y-4">
            <div className="grid gap-4">
              {Object.entries(DEFAULT_SCOPE_SETS).map(([key, preset]) => (
                <Card 
                  key={key}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedPreset === key ? 'ring-2 ring-blue-500 bg-blue-50' : ''
                  }`}
                  onClick={() => handlePresetSelect(key)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base flex items-center space-x-2">
                          <span>{preset.name}</span>
                          {selectedPreset === key && <CheckCircle2 className="h-4 w-4 text-blue-500" />}
                        </CardTitle>
                        <CardDescription>{preset.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {preset.scopes.length} scopes
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  {!compact && (
                    <CardContent className="pt-0">
                      <div className="flex flex-wrap gap-1">
                        {preset.scopes.map(scopeId => {
                          const scope = ShopifyScopeManager.getScopeById(scopeId)
                          return scope ? (
                            <Badge key={scopeId} variant="outline" className="text-xs">
                              {scope.name}
                            </Badge>
                          ) : null
                        })}
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          </TabsContent>
        )}

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          {/* Category Filter */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedCategories(new Set(SHOPIFY_SCOPE_CATEGORIES.map(c => c.id)))}
              >
                Expand All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExpandedCategories(new Set())}
              >
                Collapse All
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-gray-600"
            >
              {showAdvanced ? 'Hide Advanced' : 'Show Advanced'}
            </Button>
          </div>

          {/* Categories */}
          <div className="space-y-4">
            {SHOPIFY_SCOPE_CATEGORIES
              .filter(category => showAdvanced || !['advanced', 'settings'].includes(category.id))
              .map(renderCategory)}
          </div>
        </TabsContent>
      </Tabs>

      {/* Selection Summary */}
      <Card className="bg-gray-50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Selection Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-blue-600">{selectedScopes.length}</div>
              <div className="text-xs text-gray-600">Total Scopes</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {ShopifyScopeManager.getRequiredScopes().filter(s => selectedScopes.includes(s.id)).length}
              </div>
              <div className="text-xs text-gray-600">Required</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{dataUsage.details.length}</div>
              <div className="text-xs text-gray-600">Data Types</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${
                dataUsage.level === 'high' ? 'text-red-600' : 
                dataUsage.level === 'medium' ? 'text-yellow-600' : 'text-green-600'
              }`}>
                {dataUsage.level.charAt(0).toUpperCase() + dataUsage.level.slice(1)}
              </div>
              <div className="text-xs text-gray-600">Risk Level</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}