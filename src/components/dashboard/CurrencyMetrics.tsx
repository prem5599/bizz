    // src/components/dashboard/CurrencyMetrics.tsx
'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Globe, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { useCurrency } from '@/hooks/useCurrency'
import { CurrencyDisplay } from '@/components/CurrencySelector'

interface CurrencyMetric {
  currency: string
  amount: number
  count: number
  change: number
  changePercent: number
}

interface CurrencyMetricsProps {
  integrationId?: string
  dateRange?: { start: Date; end: Date }
}

export function CurrencyMetrics({ integrationId, dateRange }: CurrencyMetricsProps) {
  const [metrics, setMetrics] = useState<CurrencyMetric[]>([])
  const [totalRevenue, setTotalRevenue] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { selectedCurrency, formatAmount, convertAmount } = useCurrency()

  useEffect(() => {
    fetchCurrencyMetrics()
  }, [integrationId, dateRange, selectedCurrency])

  const fetchCurrencyMetrics = async () => {
    if (!integrationId) return

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        integrationId,
        ...(dateRange && {
          startDate: dateRange.start.toISOString(),
          endDate: dateRange.end.toISOString()
        })
      })

      const response = await fetch(`/api/analytics/currency?${params}`)
      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch currency metrics')
      }

      // Transform the data for display
      const currencyMetrics: CurrencyMetric[] = Object.entries(data.currencyBreakdown || {})
        .map(([currency, data]: [string, any]) => ({
          currency,
          amount: data.total || 0,
          count: data.orders || 0,
          change: data.change || 0,
          changePercent: data.changePercent || 0
        }))
        .sort((a, b) => b.amount - a.amount)

      setMetrics(currencyMetrics)
      setTotalRevenue(data.totalRevenue || 0)

    } catch (error) {
      console.error('Error fetching currency metrics:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const getCurrencyFlag = (currency: string): string => {
    const flags: Record<string, string> = {
      INR: '🇮🇳', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
      AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', SGD: '🇸🇬'
    }
    return flags[currency] || '💱'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center space-x-2">
          <div className="text-red-600">⚠️</div>
          <div>
            <h3 className="text-sm font-medium text-red-800">Error Loading Currency Metrics</h3>
            <p className="text-sm text-red-600">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Total Revenue Summary */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium opacity-90">Total Revenue</h3>
            <div className="text-3xl font-bold mt-1">
              <CurrencyDisplay
                amount={totalRevenue}
                currency={selectedCurrency}
                className="text-white"
              />
            </div>
          </div>
          <div className="p-3 bg-white bg-opacity-20 rounded-full">
            <DollarSign className="h-8 w-8" />
          </div>
        </div>
      </div>

      {/* Currency Breakdown */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">Revenue by Currency</h3>
          </div>
        </div>

        <div className="p-6">
          {metrics.length === 0 ? (
            <div className="text-center py-8">
              <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-sm font-medium text-gray-900">No currency data available</h3>
              <p className="text-sm text-gray-500">Revenue data will appear here once you have transactions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {metrics.map((metric) => (
                <div
                  key={metric.currency}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{getCurrencyFlag(metric.currency)}</span>
                      <span className="font-medium text-gray-900">{metric.currency}</span>
                    </div>
                    <div className={`flex items-center space-x-1 text-sm ${
                      metric.changePercent >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {metric.changePercent >= 0 ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownRight className="h-4 w-4" />
                      )}
                      <span>{Math.abs(metric.changePercent).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-xl font-bold text-gray-900">
                      <CurrencyDisplay
                        amount={metric.amount}
                        currency={metric.currency}
                        showFlag={false}
                      />
                    </div>
                    
                    {metric.currency !== selectedCurrency && (
                      <div className="text-sm text-gray-500">
                        ≈ <CurrencyDisplay
                          amount={convertAmount(metric.amount, metric.currency, selectedCurrency)}
                          currency={selectedCurrency}
                          showFlag={false}
                        />
                      </div>
                    )}

                    <div className="text-sm text-gray-500">
                      {metric.count} {metric.count === 1 ? 'order' : 'orders'}
                    </div>
                  </div>

                  {/* Progress bar showing percentage of total */}
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${totalRevenue > 0 ? (metric.amount / totalRevenue) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {totalRevenue > 0 ? ((metric.amount / totalRevenue) * 100).toFixed(1) : 0}% of total
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Exchange Rate Summary */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Current Exchange Rates</h3>
          <p className="text-sm text-gray-500">Rates relative to {selectedCurrency}</p>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {metrics
              .filter(m => m.currency !== selectedCurrency)
              .slice(0, 6)
              .map((metric) => {
                const rate = convertAmount(1, metric.currency, selectedCurrency)
                return (
                  <div key={metric.currency} className="text-center">
                    <div className="text-lg mb-1">{getCurrencyFlag(metric.currency)}</div>
                    <div className="text-sm font-medium">{metric.currency}</div>
                    <div className="text-xs text-gray-500">
                      1 = {rate.toFixed(4)} {selectedCurrency}
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CurrencyMetrics