// src/contexts/SearchContext.tsx
'use client'

import React, { createContext, useContext, useState, useCallback } from 'react'

export interface SearchFilter {
  query: string
  dateRange: string
  category: string
  status: string
  platform: string
}

interface SearchResult {
  id: string
  type: 'integration' | 'insight' | 'report' | 'metric' | 'customer' | 'order'
  title: string
  description: string
  url: string
  metadata?: Record<string, any>
  relevanceScore: number
}

interface SearchContextType {
  searchQuery: string
  setSearchQuery: (query: string) => void
  filters: SearchFilter
  setFilters: (filters: Partial<SearchFilter>) => void
  results: SearchResult[]
  loading: boolean
  performSearch: (query: string, filters?: Partial<SearchFilter>) => Promise<void>
  clearSearch: () => void
  recentSearches: string[]
  suggestions: string[]
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

interface SearchProviderProps {
  children: React.ReactNode
}

export function SearchProvider({ children }: SearchProviderProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFiltersState] = useState<SearchFilter>({
    query: '',
    dateRange: '30d',
    category: 'all',
    status: 'all',
    platform: 'all'
  })
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<string[]>([
    'revenue trends',
    'customer analytics',
    'order analysis',
    'shopify data',
    'monthly report',
    'conversion rates'
  ])

  const setFilters = useCallback((newFilters: Partial<SearchFilter>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }))
  }, [])

  const performSearch = useCallback(async (query: string, newFilters?: Partial<SearchFilter>) => {
    if (!query.trim()) {
      setResults([])
      return
    }

    setLoading(true)
    
    try {
      const searchFilters = newFilters ? { ...filters, ...newFilters } : filters
      
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          query: query.trim(),
          filters: searchFilters
        })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data = await response.json()
      setResults(data.results || [])
      
      // Add to recent searches
      setRecentSearches(prev => {
        const newSearches = [query, ...prev.filter(s => s !== query)].slice(0, 5)
        localStorage.setItem('recentSearches', JSON.stringify(newSearches))
        return newSearches
      })
      
    } catch (error) {
      console.error('Search error:', error)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [filters])

  const clearSearch = useCallback(() => {
    setSearchQuery('')
    setResults([])
    setFilters({
      query: '',
      dateRange: '30d',
      category: 'all',
      status: 'all',
      platform: 'all'
    })
  }, [setFilters])

  // Load recent searches from localStorage
  React.useEffect(() => {
    const stored = localStorage.getItem('recentSearches')
    if (stored) {
      try {
        setRecentSearches(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse recent searches:', e)
      }
    }
  }, [])

  const value = {
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
  }

  return (
    <SearchContext.Provider value={value}>
      {children}
    </SearchContext.Provider>
  )
}

export function useSearch() {
  const context = useContext(SearchContext)
  if (context === undefined) {
    throw new Error('useSearch must be used within a SearchProvider')
  }
  return context
}