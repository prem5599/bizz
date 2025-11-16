// src/contexts/CurrencyContext.tsx
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface CurrencyContextType {
  currency: string
  setCurrency: (currency: string) => void
  formatCurrency: (amount: number) => string
  formatNumber: (amount: number) => string
  formatPercentage: (amount: number) => string
  loading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

interface CurrencyProviderProps {
  children: React.ReactNode
}

export function CurrencyProvider({ children }: CurrencyProviderProps) {
  const { data: session } = useSession()
  const [currency, setCurrencyState] = useState('INR')
  const [loading, setLoading] = useState(true)

  // Load user's currency preference
  useEffect(() => {
    const loadUserCurrency = async () => {
      if (!session?.user?.id) {
        setLoading(false)
        return
      }

      try {
        // Try to get from localStorage first (faster)
        const storedCurrency = localStorage.getItem('user-currency')
        if (storedCurrency) {
          setCurrencyState(storedCurrency)
        }

        // Then fetch from API to ensure it's up to date
        const response = await fetch('/api/user/preferences', {
          credentials: 'include'
        })

        if (response.ok) {
          const data = await response.json()
          const userCurrency = data.currency || 'INR'
          setCurrencyState(userCurrency)
          localStorage.setItem('user-currency', userCurrency)
        }
      } catch (error) {
        console.error('Failed to load currency preference:', error)
      } finally {
        setLoading(false)
      }
    }

    loadUserCurrency()
  }, [session?.user?.id])

  // Update currency preference
  const setCurrency = async (newCurrency: string) => {
    setCurrencyState(newCurrency)
    localStorage.setItem('user-currency', newCurrency)

    // Save to backend if user is logged in
    if (session?.user?.id) {
      try {
        await fetch('/api/user/preferences', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({ currency: newCurrency })
        })
      } catch (error) {
        console.error('Failed to save currency preference:', error)
      }
    }
  }

  // Currency formatting functions
  const formatCurrency = (amount: number): string => {
    const currencyConfig = {
      INR: { locale: 'en-IN', currency: 'INR' },
      USD: { locale: 'en-US', currency: 'USD' },
      EUR: { locale: 'en-EU', currency: 'EUR' },
      GBP: { locale: 'en-GB', currency: 'GBP' },
      JPY: { locale: 'ja-JP', currency: 'JPY' },
      AUD: { locale: 'en-AU', currency: 'AUD' },
      CAD: { locale: 'en-CA', currency: 'CAD' },
      CHF: { locale: 'de-CH', currency: 'CHF' },
      CNY: { locale: 'zh-CN', currency: 'CNY' },
      SGD: { locale: 'en-SG', currency: 'SGD' }
    }

    const config = currencyConfig[currency as keyof typeof currencyConfig] || currencyConfig.INR

    try {
      return new Intl.NumberFormat(config.locale, {
        style: 'currency',
        currency: config.currency,
        minimumFractionDigits: config.currency === 'JPY' ? 0 : 2,
        maximumFractionDigits: config.currency === 'JPY' ? 0 : 2
      }).format(amount)
    } catch (error) {
      // Fallback formatting
      const symbols = {
        INR: '₹', USD: '$', EUR: '€', GBP: '£', JPY: '¥',
        AUD: 'A$', CAD: 'C$', CHF: 'CHF', CNY: '¥', SGD: 'S$'
      }
      const symbol = symbols[currency as keyof typeof symbols] || '₹'
      return `${symbol}${amount.toFixed(2)}`
    }
  }

  const formatNumber = (amount: number): string => {
    const locale = currency === 'INR' ? 'en-IN' : 'en-US'
    
    try {
      if (amount >= 10000000) { // 1 crore
        return `${(amount / 10000000).toFixed(1)}Cr`
      } else if (amount >= 100000) { // 1 lakh
        return `${(amount / 100000).toFixed(1)}L`
      } else if (amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}K`
      } else {
        return new Intl.NumberFormat(locale).format(amount)
      }
    } catch (error) {
      return amount.toLocaleString()
    }
  }

  const formatPercentage = (amount: number): string => {
    return `${amount.toFixed(1)}%`
  }

  const value = {
    currency,
    setCurrency,
    formatCurrency,
    formatNumber,
    formatPercentage,
    loading
  }

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrencyContext() {
  const context = useContext(CurrencyContext)
  if (context === undefined) {
    throw new Error('useCurrencyContext must be used within a CurrencyProvider')
  }
  return context
}

// Convenience hook for formatting
export function useCurrencyFormatter() {
  const { formatCurrency, formatNumber, formatPercentage, currency } = useCurrencyContext()
  
  return {
    formatCurrency,
    formatNumber,
    formatPercentage,
    currency,
    // Helper for metric cards
    formatMetric: (value: number, format: 'currency' | 'number' | 'percentage') => {
      switch (format) {
        case 'currency':
          return formatCurrency(value)
        case 'percentage':
          return formatPercentage(value)
        case 'number':
        default:
          return formatNumber(value)
      }
    }
  }
}