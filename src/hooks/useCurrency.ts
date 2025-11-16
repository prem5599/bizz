// src/hooks/useCurrency.ts
import { useState, useEffect, useCallback } from 'react'
import { formatCurrencyLocale, getCurrencyDisplayInfo } from '@/lib/currency/utils'
import { getCurrencyOptions } from '@/lib/currency/config'

interface CurrencyState {
  selectedCurrency: string
  exchangeRates: Record<string, number>
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

interface CurrencyConversion {
  amount: number
  fromCurrency: string
  toCurrency: string
  convertedAmount: number
  rate: number
  loading: boolean
  error: string | null
}

export function useCurrency(defaultCurrency: string = 'INR') {
  const [state, setState] = useState<CurrencyState>({
    selectedCurrency: defaultCurrency,
    exchangeRates: {},
    loading: false,
    error: null,
    lastUpdated: null
  })

  // Fetch exchange rates
  const fetchRates = useCallback(async (baseCurrency?: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch(`/api/currency?action=rates&base=${baseCurrency || state.selectedCurrency}`)
      const data = await response.json()

      if (data.success) {
        setState(prev => ({
          ...prev,
          exchangeRates: data.rates,
          loading: false,
          lastUpdated: new Date()
        }))
      } else {
        throw new Error(data.error || 'Failed to fetch rates')
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))
    }
  }, [state.selectedCurrency])

  // Set selected currency
  const setCurrency = useCallback((currencyCode: string) => {
    setState(prev => ({ ...prev, selectedCurrency: currencyCode }))
  }, [])

  // Format amount with selected currency
  const formatAmount = useCallback((amount: number, currencyCode?: string) => {
    return formatCurrencyLocale(amount, currencyCode || state.selectedCurrency)
  }, [state.selectedCurrency])

  // Get currency info
  const getCurrencyInfo = useCallback((currencyCode?: string) => {
    return getCurrencyDisplayInfo(currencyCode || state.selectedCurrency)
  }, [state.selectedCurrency])

  // Convert amount
  const convertAmount = useCallback((amount: number, fromCurrency: string, toCurrency: string) => {
    if (!state.exchangeRates || Object.keys(state.exchangeRates).length === 0) {
      return amount
    }

    if (fromCurrency === toCurrency) return amount

    const fromRate = state.exchangeRates[fromCurrency] || 1
    const toRate = state.exchangeRates[toCurrency] || 1

    return (amount / fromRate) * toRate
  }, [state.exchangeRates])

  // Fetch rates on mount and currency change
  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  return {
    ...state,
    setCurrency,
    formatAmount,
    getCurrencyInfo,
    convertAmount,
    refreshRates: fetchRates,
    currencyOptions: getCurrencyOptions()
  }
}

export function useCurrencyConversion() {
  const [state, setState] = useState<CurrencyConversion>({
    amount: 0,
    fromCurrency: 'INR',
    toCurrency: 'USD',
    convertedAmount: 0,
    rate: 1,
    loading: false,
    error: null
  })

  const convert = useCallback(async (amount: number, fromCurrency: string, toCurrency: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }))

    try {
      const response = await fetch('/api/currency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'convert',
          amount,
          fromCurrency,
          toCurrency
        })
      })

      const data = await response.json()

      if (data.success) {
        setState({
          amount,
          fromCurrency,
          toCurrency,
          convertedAmount: data.convertedAmount,
          rate: data.rate,
          loading: false,
          error: null
        })
        return data
      } else {
        throw new Error(data.error || 'Conversion failed')
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }))
      throw error
    }
  }, [])

  return { ...state, convert }
}