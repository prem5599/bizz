// src/components/CurrencySelector.tsx
'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { getCurrencyOptions, getCurrency } from '@/lib/currency/config'
import { useCurrency } from '@/hooks/useCurrency'

interface CurrencySelectorProps {
  value: string
  onChange: (currency: string) => void
  showFlag?: boolean
  showFullName?: boolean
  disabled?: boolean
  className?: string
}

export function CurrencySelector({
  value,
  onChange,
  showFlag = true,
  showFullName = false,
  disabled = false,
  className = ''
}: CurrencySelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { currencyOptions } = useCurrency()
  const selectedCurrency = getCurrency(value)

  const handleSelect = (currencyCode: string) => {
    onChange(currencyCode)
    setIsOpen(false)
  }

  const getCurrencyFlag = (code: string): string => {
    const flags: Record<string, string> = {
      INR: '🇮🇳', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
      AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', SGD: '🇸🇬'
    }
    return flags[code] || '💱'
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center justify-between w-full px-3 py-2 text-left bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:cursor-not-allowed"
      >
        <div className="flex items-center space-x-2">
          {showFlag && (
            <span className="text-lg">{getCurrencyFlag(value)}</span>
          )}
          <span className="font-medium">{selectedCurrency?.code || value}</span>
          <span className="text-gray-500">{selectedCurrency?.symbol}</span>
          {showFullName && (
            <span className="text-sm text-gray-600 hidden sm:inline">
              {selectedCurrency?.name}
            </span>
          )}
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
          {currencyOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => handleSelect(option.value)}
              className="flex items-center justify-between w-full px-3 py-2 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                {showFlag && (
                  <span className="text-lg">{getCurrencyFlag(option.value)}</span>
                )}
                <span className="font-medium">{option.value}</span>
                <span className="text-gray-500">{option.symbol}</span>
                <span className="text-sm text-gray-600">{option.name}</span>
              </div>
              {value === option.value && (
                <Check className="w-4 h-4 text-blue-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface CurrencyInputProps {
  value: number
  currency: string
  onValueChange: (value: number) => void
  onCurrencyChange: (currency: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export function CurrencyInput({
  value,
  currency,
  onValueChange,
  onCurrencyChange,
  placeholder = "0.00",
  disabled = false,
  className = ''
}: CurrencyInputProps) {
  const selectedCurrency = getCurrency(currency)

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value.replace(/[^0-9.]/g, '')
    const numValue = parseFloat(inputValue) || 0
    onValueChange(numValue)
  }

  return (
    <div className={`flex ${className}`}>
      <div className="flex-1">
        <input
          type="text"
          value={value === 0 ? '' : value.toString()}
          onChange={handleInputChange}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
        />
      </div>
      <div className="w-32">
        <CurrencySelector
          value={currency}
          onChange={onCurrencyChange}
          disabled={disabled}
          className="border-l-0 rounded-l-none rounded-r-md"
        />
      </div>
    </div>
  )
}

interface CurrencyDisplayProps {
  amount: number
  currency: string
  showFlag?: boolean
  showCode?: boolean
  precision?: number
  className?: string
}

export function CurrencyDisplay({
  amount,
  currency,
  showFlag = false,
  showCode = false,
  precision,
  className = ''
}: CurrencyDisplayProps) {
  const { formatAmount } = useCurrency()
  
  const getCurrencyFlag = (code: string): string => {
    const flags: Record<string, string> = {
      INR: '🇮🇳', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧', JPY: '🇯🇵',
      AUD: '🇦🇺', CAD: '🇨🇦', CHF: '🇨🇭', CNY: '🇨🇳', SGD: '🇸🇬'
    }
    return flags[code] || '💱'
  }

  const formattedAmount = precision !== undefined
    ? formatAmount(amount, currency)
    : formatAmount(amount, currency)

  return (
    <span className={`inline-flex items-center space-x-1 ${className}`}>
      {showFlag && (
        <span className="text-sm">{getCurrencyFlag(currency)}</span>
      )}
      <span className="font-medium">{formattedAmount}</span>
      {showCode && (
        <span className="text-sm text-gray-500">{currency}</span>
      )}
    </span>
  )
}