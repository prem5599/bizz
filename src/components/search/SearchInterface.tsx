// src/components/search/SearchInterface.tsx
'use client'

import React, { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearch } from '@/contexts/SearchContext'
import { 
  Search, 
  X, 
  Filter, 
  Clock, 
  ArrowRight, 
  TrendingUp, 
  BarChart3, 
  Users, 
  ShoppingBag, 
  FileText, 
  Zap,
  Command,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchInterfaceProps {
  onClose?: () => void
  embedded?: boolean
  className?: string
}

export function SearchInterface({ onClose, embedded = false, className }: SearchInterfaceProps) {
  const router = useRouter()
  const { 
    searchQuery, 
    setSearchQuery, 
    filters, 
    setFilters, 
    results, 
    loading, 
    performSearch, 
    clearSearch, 
    recentSearches, 
    suggestions 
  } = useSearch()
  
  const [isOpen, setIsOpen] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [inputValue, setInputValue] = useState('')
  
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Handle search input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInputValue(value)
    setSearchQuery(value)
    
    if (value.length > 0) {
      setIsOpen(true)
      if (value.length >= 2) {
        performSearch(value)
      }
    } else {
      setIsOpen(false)
      clearSearch()
    }
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleResultClick(results[selectedIndex])
        } else if (inputValue.trim()) {
          performSearch(inputValue)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
    }
  }

  // Handle result selection
  const handleResultClick = (result: any) => {
    router.push(result.url)
    setIsOpen(false)
    setInputValue('')
    setSearchQuery('')
    onClose?.()
  }

  // Handle recent search click
  const handleRecentSearchClick = (query: string) => {
    setInputValue(query)
    setSearchQuery(query)
    performSearch(query)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Get icon for result type
  const getResultIcon = (type: string) => {
    switch (type) {
      case 'integration':
        return <Zap className="h-4 w-4" />
      case 'insight':
        return <TrendingUp className="h-4 w-4" />
      case 'report':
        return <FileText className="h-4 w-4" />
      case 'metric':
        return <BarChart3 className="h-4 w-4" />
      case 'customer':
        return <Users className="h-4 w-4" />
      case 'order':
        return <ShoppingBag className="h-4 w-4" />
      default:
        return <Search className="h-4 w-4" />
    }
  }

  // Get result type color
  const getResultTypeColor = (type: string) => {
    switch (type) {
      case 'integration':
        return 'text-blue-600'
      case 'insight':
        return 'text-green-600'
      case 'report':
        return 'text-purple-600'
      case 'metric':
        return 'text-orange-600'
      case 'customer':
        return 'text-pink-600'
      case 'order':
        return 'text-indigo-600'
      default:
        return 'text-gray-600'
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Search Input */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
          <Search className={cn(
            "h-4 w-4 transition-colors",
            isOpen ? "text-blue-500" : "text-gray-400"
          )} />
        </div>
        
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsOpen(true)}
          placeholder="Search insights, reports, data..."
          className={cn(
            "w-full pl-10 pr-12 py-2 text-sm border border-gray-300 rounded-lg",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
            "placeholder-gray-400 bg-white",
            isOpen && "border-blue-300 shadow-sm"
          )}
        />

        {/* Clear button */}
        {inputValue && (
          <button
            onClick={() => {
              setInputValue('')
              setSearchQuery('')
              clearSearch()
              setIsOpen(false)
            }}
            className="absolute inset-y-0 right-8 flex items-center pr-1 text-gray-400 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Filter button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn(
            "absolute inset-y-0 right-0 flex items-center pr-3",
            "text-gray-400 hover:text-gray-600",
            showFilters && "text-blue-500"
          )}
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.category}
                onChange={(e) => setFilters({ category: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="integration">Integrations</option>
                <option value="insight">Insights</option>
                <option value="report">Reports</option>
                <option value="metric">Metrics</option>
                <option value="customer">Customers</option>
                <option value="order">Orders</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Platform</label>
              <select
                value={filters.platform}
                onChange={(e) => setFilters({ platform: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Platforms</option>
                <option value="shopify">Shopify</option>
                <option value="stripe">Stripe</option>
                <option value="google_analytics">Google Analytics</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-2">Date Range</label>
              <select
                value={filters.dateRange}
                onChange={(e) => setFilters({ dateRange: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Search Results Dropdown */}
      {isOpen && (
        <div className="absolute top-12 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-40 max-h-96 overflow-y-auto">
          {loading && (
            <div className="px-4 py-8 text-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
              <p className="text-sm text-gray-500">Searching...</p>
            </div>
          )}

          {!loading && results.length === 0 && inputValue.length >= 2 && (
            <div className="px-4 py-8 text-center">
              <Search className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500 mb-1">No results found</p>
              <p className="text-xs text-gray-400">Try adjusting your search terms</p>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Results ({results.length})
              </div>
              
              {results.map((result, index) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result)}
                  className={cn(
                    "w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center space-x-3",
                    selectedIndex === index && "bg-blue-50 border-r-2 border-blue-500"
                  )}
                >
                  <div className={cn("flex-shrink-0", getResultTypeColor(result.type))}>
                    {getResultIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {result.title}
                      </p>
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        "bg-gray-100 text-gray-600"
                      )}>
                        {result.type}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {result.description}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </button>
              ))}
            </div>
          )}

          {/* Recent Searches */}
          {!loading && inputValue.length < 2 && recentSearches.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Recent Searches
              </div>
              {recentSearches.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(query)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{query}</span>
                </button>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {!loading && inputValue.length < 2 && suggestions.length > 0 && (
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Suggestions
              </div>
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleRecentSearchClick(suggestion)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center space-x-3"
                >
                  <Search className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-700">{suggestion}</span>
                </button>
              ))}
            </div>
          )}

          {/* Keyboard shortcuts */}
          <div className="border-t border-gray-100 px-4 py-2">
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>Use ↑↓ to navigate</span>
              <span>↵ to select</span>
              <span>esc to close</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}