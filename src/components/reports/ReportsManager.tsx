// src/components/reports/ReportsManager.tsx
'use client'

import { useState, useEffect } from 'react'
import { 
  FileText, 
  Download, 
  Mail, 
  Calendar, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Plus, 
  Clock, 
  Users,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ScheduledReport {
  id: string
  name: string
  description?: string
  reportType: 'weekly' | 'monthly' | 'quarterly'
  format: 'pdf' | 'html'
  schedule: string
  recipients: Array<{ email: string; name?: string }>
  isActive: boolean
  lastRunAt?: Date
  nextRunAt?: Date
  createdAt: Date
  createdByUser: {
    name: string
    email: string
  }
}

interface ReportsManagerProps {
  organizationId: string
}

export function ReportsManager({ organizationId }: ReportsManagerProps) {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  // Load scheduled reports
  useEffect(() => {
    loadReports()
  }, [organizationId])

  const loadReports = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/reports?organizationId=${organizationId}`)
      
      if (!response.ok) {
        throw new Error('Failed to load reports')
      }
      
      const data = await response.json()
      setReports(data.scheduledReports || [])
      setError(null)
    } catch (error) {
      console.error('Error loading reports:', error)
      setError(error instanceof Error ? error.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const generateReport = async (reportType: string, format: string) => {
    try {
      setLoading(true)
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          reportType,
          format
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate report')
      }

      // Download the report
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('Error generating report:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate report')
    } finally {
      setLoading(false)
    }
  }

  const toggleReportStatus = async (reportId: string, isActive: boolean) => {
    try {
      const response = await fetch('/api/reports', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId,
          action: 'update',
          updates: { isActive: !isActive }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update report status')
      }

      // Reload reports to get updated data
      loadReports()
      
    } catch (error) {
      console.error('Error updating report status:', error)
      setError(error instanceof Error ? error.message : 'Failed to update report')
    }
  }

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) {
      return
    }

    try {
      const response = await fetch('/api/reports', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reportId,
          action: 'delete'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to delete report')
      }

      // Reload reports
      loadReports()
      
    } catch (error) {
      console.error('Error deleting report:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete report')
    }
  }

  const formatSchedule = (schedule: string): string => {
    const scheduleMap: Record<string, string> = {
      '0 9 * * 1': 'Weekly on Mondays at 9 AM',
      '0 9 1 * *': 'Monthly on the 1st at 9 AM',
      '0 9 1 1,4,7,10 *': 'Quarterly at 9 AM'
    }
    return scheduleMap[schedule] || schedule
  }

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (loading && reports.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-gray-500">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          Loading reports...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Reports</h2>
          <p className="text-gray-600 dark:text-gray-400">
            Generate instant reports or schedule automated delivery
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Schedule Report
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Quick Generate Section */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Generate Report Now
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { type: 'weekly', label: 'Weekly Report', desc: 'Last 7 days performance' },
            { type: 'monthly', label: 'Monthly Report', desc: 'Last 30 days analytics' },
            { type: 'quarterly', label: 'Quarterly Report', desc: 'Last 90 days insights' }
          ].map((reportType) => (
            <div key={reportType.type} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-3">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    {reportType.label}
                  </h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {reportType.desc}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => generateReport(reportType.type, 'pdf')}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={() => generateReport(reportType.type, 'html')}
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400 rounded text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  HTML
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Scheduled Reports */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Scheduled Reports ({reports.length})
          </h3>
        </div>

        {reports.length === 0 ? (
          <div className="p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Scheduled Reports
            </h4>
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Create your first scheduled report to receive regular analytics updates
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Schedule Your First Report
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {reports.map((report) => (
              <div key={report.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                        {report.name}
                      </h4>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                        report.isActive
                          ? "bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
                      )}>
                        {report.isActive ? (
                          <>
                            <CheckCircle className="w-3 h-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <Pause className="w-3 h-3" />
                            Paused
                          </>
                        )}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-400">
                        {report.reportType}
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/20 text-purple-800 dark:text-purple-400">
                        {report.format.toUpperCase()}
                      </span>
                    </div>

                    {report.description && (
                      <p className="text-gray-600 dark:text-gray-400 mb-3">
                        {report.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {formatSchedule(report.schedule)}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                      </div>

                      {report.lastRunAt && (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Last run: {formatDate(report.lastRunAt)}
                        </div>
                      )}

                      {report.nextRunAt && report.isActive && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Next run: {formatDate(report.nextRunAt)}
                        </div>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-gray-400">
                      Created by {report.createdByUser.name} on {formatDate(report.createdAt)}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => toggleReportStatus(report.id, report.isActive)}
                      className={cn(
                        "p-2 rounded-lg transition-colors",
                        report.isActive
                          ? "bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/40 text-yellow-600 dark:text-yellow-400"
                          : "bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/40 text-green-600 dark:text-green-400"
                      )}
                      title={report.isActive ? 'Pause report' : 'Resume report'}
                    >
                      {report.isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>

                    <button
                      onClick={() => {/* TODO: Implement edit modal */}}
                      className="p-2 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 rounded-lg transition-colors"
                      title="Edit report"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => deleteReport(report.id)}
                      className="p-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                      title="Delete report"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Report Modal - Placeholder */}
      {showCreateModal && (
        <CreateReportModal
          organizationId={organizationId}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadReports()
          }}
        />
      )}
    </div>
  )
}

// Placeholder for Create Report Modal
interface CreateReportModalProps {
  organizationId: string
  onClose: () => void
  onSuccess: () => void
}

function CreateReportModal({ organizationId, onClose, onSuccess }: CreateReportModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    reportType: 'monthly' as const,
    format: 'pdf' as const,
    schedule: '0 9 1 * *', // Monthly on 1st at 9 AM
    recipients: [{ email: '', name: '' }]
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          organizationId,
          scheduleOptions: {
            name: formData.name,
            description: formData.description,
            schedule: formData.schedule,
            recipients: formData.recipients.filter(r => r.email),
            isActive: true
          },
          reportType: formData.reportType,
          format: formData.format
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create scheduled report')
      }

      onSuccess()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create report')
    } finally {
      setLoading(false)
    }
  }

  const addRecipient = () => {
    setFormData(prev => ({
      ...prev,
      recipients: [...prev.recipients, { email: '', name: '' }]
    }))
  }

  const removeRecipient = (index: number) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index)
    }))
  }

  const updateRecipient = (index: number, field: 'email' | 'name', value: string) => {
    setFormData(prev => ({
      ...prev,
      recipients: prev.recipients.map((recipient, i) => 
        i === index ? { ...recipient, [field]: value } : recipient
      )
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Schedule New Report
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <p className="text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Report Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Monthly Analytics Report"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Brief description of this report..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Report Type
              </label>
              <select
                value={formData.reportType}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  reportType: e.target.value as any,
                  schedule: e.target.value === 'weekly' ? '0 9 * * 1' : 
                           e.target.value === 'quarterly' ? '0 9 1 1,4,7,10 *' : '0 9 1 * *'
                }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Format
              </label>
              <select
                value={formData.format}
                onChange={(e) => setFormData(prev => ({ ...prev, format: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="pdf">PDF</option>
                <option value="html">HTML</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Recipients
            </label>
            <div className="space-y-2">
              {formData.recipients.map((recipient, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="email"
                    value={recipient.email}
                    onChange={(e) => updateRecipient(index, 'email', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="email@example.com"
                    required
                  />
                  <input
                    type="text"
                    value={recipient.name}
                    onChange={(e) => updateRecipient(index, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Name (optional)"
                  />
                  {formData.recipients.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeRecipient(index)}
                      className="px-3 py-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addRecipient}
              className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:underline"
            >
              + Add another recipient
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}