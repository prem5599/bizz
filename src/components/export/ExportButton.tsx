// src/components/export/ExportButton.tsx
'use client'

import React, { useState } from 'react'
import { Download, FileText, FileSpreadsheet, File, ChevronDown, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExportFormat, ExportOptions } from '@/lib/export/exportUtils'

interface ExportButtonProps {
  exportType: 'dashboard' | 'analytics' | 'insights' | 'integrations' | 'reports' | 'raw_data'
  organizationId: string
  disabled?: boolean
  className?: string
  variant?: 'default' | 'ghost' | 'outline'
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  customLabel?: string
  onExportStart?: () => void
  onExportComplete?: () => void
  onExportError?: (error: string) => void
}

export function ExportButton({
  exportType,
  organizationId,
  disabled = false,
  className,
  variant = 'default',
  size = 'md',
  showLabel = true,
  customLabel,
  onExportStart,
  onExportComplete,
  onExportError
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [dateRange, setDateRange] = useState('30d')

  const handleExport = async (format: ExportFormat) => {
    try {
      setIsExporting(true)
      setShowDropdown(false)
      onExportStart?.()

      // Calculate date range
      const end = new Date()
      const start = new Date()
      
      switch (dateRange) {
        case '7d':
          start.setDate(start.getDate() - 7)
          break
        case '30d':
          start.setDate(start.getDate() - 30)
          break
        case '90d':
          start.setDate(start.getDate() - 90)
          break
        case '1y':
          start.setFullYear(start.getFullYear() - 1)
          break
        default:
          start.setDate(start.getDate() - 30)
      }

      const options: ExportOptions = {
        format,
        dateRange: { start, end },
        includeCharts: true,
        includeMetadata: true
      }

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          exportType,
          organizationId,
          options
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="([^"]*)"/)?.at(1) || 
        `export_${Date.now()}.${format}`

      // Download file
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      onExportComplete?.()
    } catch (error) {
      console.error('Export error:', error)
      onExportError?.(error instanceof Error ? error.message : 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  const getFormatIcon = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return <FileSpreadsheet className="h-4 w-4" />
      case 'json':
        return <File className="h-4 w-4" />
      case 'pdf':
        return <FileText className="h-4 w-4" />
      case 'excel':
        return <FileSpreadsheet className="h-4 w-4" />
      default:
        return <Download className="h-4 w-4" />
    }
  }

  const getFormatLabel = (format: ExportFormat) => {
    switch (format) {
      case 'csv':
        return 'CSV (Spreadsheet)'
      case 'json':
        return 'JSON (Data)'
      case 'pdf':
        return 'PDF (Document)'
      case 'excel':
        return 'Excel (Spreadsheet)'
      default:
        return format.toUpperCase()
    }
  }

  const buttonLabel = customLabel || (showLabel ? 'Export' : '')

  const baseClasses = cn(
    'inline-flex items-center justify-center font-medium transition-colors',
    'focus:outline-none focus:ring-2 focus:ring-offset-2',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    
    // Size variants
    {
      'text-xs px-2.5 py-1.5 rounded': size === 'sm',
      'text-sm px-3 py-2 rounded-md': size === 'md',
      'text-base px-4 py-2.5 rounded-md': size === 'lg',
    },
    
    // Style variants
    {
      'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500': variant === 'default',
      'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-gray-500': variant === 'outline',
      'text-gray-700 hover:bg-gray-100 focus:ring-gray-500': variant === 'ghost',
    },
    
    className
  )

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={disabled || isExporting}
        className={baseClasses}
      >
        {isExporting ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />
        ) : (
          <Download className="h-4 w-4 mr-2" />
        )}
        {buttonLabel}
        {showLabel && <ChevronDown className="h-3 w-3 ml-1" />}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Export Options</h4>
            
            {/* Date Range Selection */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                <Calendar className="h-3 w-3 inline mr-1" />
                Date Range
              </label>
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="1y">Last year</option>
              </select>
            </div>

            {/* Format Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-700 mb-2">
                Choose Format
              </label>
              
              {(['csv', 'json', 'excel'] as ExportFormat[]).map((format) => (
                <button
                  key={format}
                  onClick={() => handleExport(format)}
                  disabled={isExporting}
                  className="w-full flex items-center space-x-3 px-3 py-2 text-sm text-left rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="text-gray-400">
                    {getFormatIcon(format)}
                  </span>
                  <span className="flex-1 text-gray-900">
                    {getFormatLabel(format)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Simplified export button for quick actions
export function QuickExportButton({
  exportType,
  organizationId,
  format = 'csv',
  className,
  children
}: {
  exportType: 'dashboard' | 'analytics' | 'insights' | 'integrations' | 'reports' | 'raw_data'
  organizationId: string
  format?: ExportFormat
  className?: string
  children?: React.ReactNode
}) {
  const [isExporting, setIsExporting] = useState(false)

  const handleQuickExport = async () => {
    try {
      setIsExporting(true)

      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30) // Default to 30 days

      const options: ExportOptions = {
        format,
        dateRange: { start, end },
        includeCharts: true,
        includeMetadata: true
      }

      const response = await fetch('/api/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          exportType,
          organizationId,
          options
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Export failed')
      }

      const contentDisposition = response.headers.get('Content-Disposition')
      const filename = contentDisposition?.match(/filename="([^"]*)"/)?.at(1) || 
        `export_${Date.now()}.${format}`

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <button
      onClick={handleQuickExport}
      disabled={isExporting}
      className={cn(
        'inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
    >
      {isExporting ? (
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      {children || 'Export'}
    </button>
  )
}