'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { 
  FileText, 
  Download, 
  Calendar, 
  Plus,
  BarChart3,
  TrendingUp,
  Users,
  ShoppingCart,
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Trash2,
  Search,
  Grid3X3,
  List,
  Star,
  Activity,
  Zap,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Report {
  id: string
  title: string
  description: string
  type: 'revenue' | 'customers' | 'products' | 'marketing' | 'custom'
  format: 'pdf' | 'excel' | 'csv'
  status: 'completed' | 'generating' | 'failed' | 'scheduled'
  createdAt: string
  completedAt?: string
  downloadUrl?: string
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly'
  size?: string
  pages?: number
}

interface ReportTemplate {
  id: string
  name: string
  description: string
  type: string
  icon: React.ReactNode
  estimatedTime: string
  dataPoints: string[]
}

export default function ReportsPage() {
  const { data: session, status } = useSession()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'scheduled' | 'templates'>('templates')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [generating, setGenerating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showDateModal, setShowDateModal] = useState(false)
  const [customDateRange, setCustomDateRange] = useState({
    startDate: '',
    endDate: ''
  })

  // Report templates
  const reportTemplates: ReportTemplate[] = [
    {
      id: 'weekly',
      name: 'Weekly Summary Report',
      description: 'Comprehensive weekly overview of business performance and key metrics',
      type: 'weekly',
      icon: <Activity className="h-7 w-7 text-emerald-600" />,
      estimatedTime: '2-3 minutes',
      dataPoints: ['Revenue trends', 'Order volume', 'Customer acquisition', 'Performance insights']
    },
    {
      id: 'monthly',
      name: 'Monthly Business Report',
      description: 'Detailed monthly analysis with trends, forecasts, and recommendations',
      type: 'monthly',
      icon: <TrendingUp className="h-7 w-7 text-blue-600" />,
      estimatedTime: '3-4 minutes',
      dataPoints: ['Monthly growth', 'Revenue breakdown', 'Customer analytics', 'Actionable insights']
    },
    {
      id: 'custom',
      name: 'Custom Date Range Report',
      description: 'Generate reports for any date range with personalized analysis',
      type: 'custom',
      icon: <Zap className="h-7 w-7 text-purple-600" />,
      estimatedTime: '2-4 minutes',
      dataPoints: ['Custom metrics', 'Flexible date range', 'Targeted analysis', 'Comparative insights']
    }
  ]

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      fetchOrganizationAndReports()
    } else if (status === 'unauthenticated') {
      setError('Please sign in to view reports')
      setLoading(false)
    }
  }, [session, status])

  const fetchOrganizationAndReports = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // First, get the current organization
      const orgResponse = await fetch('/api/organizations/current')
      if (!orgResponse.ok) {
        throw new Error('Failed to fetch organization')
      }
      
      const orgData = await orgResponse.json()
      const currentOrgId = orgData.organization.id
      setOrganizationId(currentOrgId)
      
      // Then fetch reports data
      await fetchReports(currentOrgId)
    } catch (error) {
      console.error('Failed to fetch organization and reports:', error)
      setError('Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async (orgId: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/reports`)
      if (!response.ok) {
        throw new Error('Failed to fetch reports')
      }
      
      const data = await response.json()
      
      // Transform the data to match the expected format
      const transformedReports = data.reports.map((report: any) => ({
        id: report.id,
        title: report.title,
        description: `Report for ${new Date(report.dateRangeStart).toLocaleDateString()} - ${new Date(report.dateRangeEnd).toLocaleDateString()}`,
        type: report.reportType,
        format: 'pdf', // Default format
        status: report.emailedAt ? 'completed' : 'completed',
        createdAt: report.generatedAt,
        completedAt: report.generatedAt,
        downloadUrl: `/api/organizations/${orgId}/reports/${report.id}/download`,
        size: '1.2 MB', // Default size
        pages: 8 // Default pages
      }))
      
      setReports(transformedReports)
    } catch (error) {
      console.error('Failed to fetch reports:', error)
      throw error
    }
  }

  const handleGenerateReport = async (templateId: string, customDates?: {startDate: string, endDate: string}) => {
    const template = reportTemplates.find(t => t.id === templateId)
    if (!template || !organizationId) return

    // For custom reports, show date picker modal first
    if (template.type === 'custom' && !customDates) {
      setShowDateModal(true)
      return
    }

    setGenerating(templateId)
    
    try {
      const requestBody: any = {
        action: 'generate',
        reportType: template.type,
        emailReport: false
      }

      // Add date range for custom reports
      if (template.type === 'custom' && customDates) {
        requestBody.startDate = new Date(customDates.startDate).toISOString()
        requestBody.endDate = new Date(customDates.endDate).toISOString()
      } else if (template.type === 'custom') {
        // Fallback to default if no dates provided
        const endDate = new Date()
        const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)
        requestBody.startDate = startDate.toISOString()
        requestBody.endDate = endDate.toISOString()
      }

      const response = await fetch(`/api/organizations/${organizationId}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate report')
      }

      // Create a temporary report entry to show generation progress
      const newReport: Report = {
        id: `temp-${Date.now()}`,
        title: `${template.name} - ${new Date().toLocaleDateString()}`,
        description: template.description,
        type: template.type as any,
        format: 'pdf',
        status: 'generating',
        createdAt: new Date().toISOString()
      }
      
      setReports(prev => [newReport, ...prev])
      
      // Simulate completion and refresh reports
      setTimeout(async () => {
        try {
          await fetchReports(organizationId)
        } catch (error) {
          console.error('Error refreshing reports:', error)
        }
      }, 3000)
      
    } catch (error) {
      console.error('Error generating report:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate report')
    } finally {
      setGenerating(null)
    }
  }

  const handleCustomDateSubmit = () => {
    if (!customDateRange.startDate || !customDateRange.endDate) {
      setError('Please select both start and end dates')
      return
    }

    if (new Date(customDateRange.startDate) > new Date(customDateRange.endDate)) {
      setError('Start date cannot be after end date')
      return
    }

    setShowDateModal(false)
    handleGenerateReport('custom', customDateRange)
    
    // Reset the form
    setCustomDateRange({ startDate: '', endDate: '' })
  }

  const getDefaultDates = () => {
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - 30) // Default to last 30 days
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    }
  }

  // Set default dates when modal opens
  useEffect(() => {
    if (showDateModal && !customDateRange.startDate) {
      const defaults = getDefaultDates()
      setCustomDateRange(defaults)
    }
  }, [showDateModal])

  const handleDeleteReport = async (reportId: string) => {
    if (!organizationId) return
    
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return
    }

    setDeleting(reportId)
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}/reports/${reportId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete report')
      }

      // Remove report from local state
      setReports(prev => prev.filter(report => report.id !== reportId))
      
    } catch (error) {
      console.error('Error deleting report:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete report')
    } finally {
      setDeleting(null)
    }
  }

  const handleDownloadReport = (report: Report, format: string = 'html') => {
    if (!organizationId || !report.downloadUrl) return
    
    const downloadUrl = `${report.downloadUrl}?format=${format}`
    window.open(downloadUrl, '_blank')
  }

  const getStatusIcon = (status: Report['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case 'generating':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'scheduled':
        return <Clock className="h-5 w-5 text-orange-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  const getStatusText = (status: Report['status']) => {
    switch (status) {
      case 'completed': return 'Ready'
      case 'generating': return 'Generating...'
      case 'failed': return 'Failed'
      case 'scheduled': return 'Scheduled'
      default: return 'Unknown'
    }
  }

  const getTypeIcon = (type: Report['type']) => {
    switch (type) {
      case 'revenue': return <DollarSign className="h-4 w-4 text-green-600" />
      case 'customers': return <Users className="h-4 w-4 text-blue-600" />
      case 'products': return <ShoppingCart className="h-4 w-4 text-purple-600" />
      case 'marketing': return <BarChart3 className="h-4 w-4 text-orange-600" />
      default: return <FileText className="h-4 w-4 text-gray-600" />
    }
  }

  const filteredReports = reports.filter(report => {
    let matches = true
    
    if (activeTab === 'scheduled') matches = matches && !!report.scheduleFrequency
    if (selectedType !== 'all') matches = matches && report.type === selectedType
    if (searchQuery) {
      matches = matches && (
        report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    return matches
  })

  const reportsStats = {
    total: reports.length,
    completed: reports.filter(r => r.status === 'completed').length,
    generating: reports.filter(r => r.status === 'generating').length,
    scheduled: reports.filter(r => r.scheduleFrequency).length
  }

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Reports Hub</h1>
              <p className="mt-2 text-gray-600">
                Generate insights and track your business performance with AI-powered reports
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => setActiveTab('templates')}
                className="flex items-center px-6 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 shadow-lg transition-all duration-200"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Report
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 text-sm font-medium">Total Reports</p>
                  <p className="text-2xl font-bold text-blue-900">{reportsStats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-sm font-medium">Completed</p>
                  <p className="text-2xl font-bold text-green-900">{reportsStats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-sm font-medium">Generating</p>
                  <p className="text-2xl font-bold text-orange-900">{reportsStats.generating}</p>
                </div>
                <RefreshCw className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-sm font-medium">Scheduled</p>
                  <p className="text-2xl font-bold text-purple-900">{reportsStats.scheduled}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-1">
            {(['templates', 'all', 'scheduled'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 text-sm font-medium rounded-md transition-all duration-200",
                  activeTab === tab
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                )}
              >
                {tab === 'all' ? 'My Reports' : tab === 'scheduled' ? 'Scheduled' : 'Templates'}
              </button>
            ))}
          </div>

          {activeTab !== 'templates' && (
            <div className="flex items-center space-x-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
              </div>

              {/* Filter */}
              <select 
                value={selectedType} 
                onChange={(e) => setSelectedType(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="revenue">Revenue</option>
                <option value="customers">Customers</option>
                <option value="products">Products</option>
                <option value="marketing">Marketing</option>
              </select>

              {/* View Mode */}
              <div className="flex items-center border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-2 text-sm",
                    viewMode === 'grid' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 text-sm border-l border-gray-300",
                    viewMode === 'list' ? "bg-blue-50 text-blue-600" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
              <button
                onClick={() => {
                  setError(null)
                  if (organizationId) {
                    fetchReports(organizationId)
                  } else {
                    fetchOrganizationAndReports()
                  }
                }}
                className="ml-4 text-sm text-red-600 hover:text-red-800 font-medium"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        {activeTab === 'templates' ? (
          /* Report Templates */
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose a Report Template</h2>
              <p className="text-gray-600">Select from our professionally designed templates to generate insights for your business</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {reportTemplates.map((template) => (
                <div key={template.id} className="group bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-xl hover:border-blue-200 transition-all duration-300 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-50 to-transparent rounded-bl-3xl opacity-60"></div>
                  
                  <div className="relative">
                    <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl mb-6 group-hover:scale-110 transition-transform duration-300">
                      {template.icon}
                    </div>
                    
                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {template.name}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-6 leading-relaxed">
                      {template.description}
                    </p>
                    
                    <div className="space-y-3 mb-6">
                      {template.dataPoints.map((point, index) => (
                        <div key={index} className="flex items-center text-sm text-gray-700">
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
                          {point}
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock className="h-4 w-4 mr-2" />
                        {template.estimatedTime}
                      </div>
                      <div className="flex items-center text-sm text-blue-600">
                        <Star className="h-4 w-4 mr-1" />
                        Popular
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleGenerateReport(template.id)}
                      disabled={generating === template.id || !organizationId}
                      className="w-full py-3 px-4 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 group-hover:shadow-lg"
                    >
                      {generating === template.id ? (
                        <div className="flex items-center justify-center">
                          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                          Generating...
                        </div>
                      ) : (
                        'Generate Report'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Reports List */
          <div className="space-y-6">
            {loading ? (
              <div className={cn(
                "grid gap-6",
                viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
              )}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                        <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="text-center py-16">
                <div className="flex items-center justify-center w-20 h-20 bg-gray-100 rounded-full mx-auto mb-6">
                  <FileText className="h-10 w-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">No reports found</h3>
                <p className="text-gray-500 mb-6 max-w-md mx-auto">
                  {activeTab === 'scheduled' 
                    ? 'No scheduled reports configured yet. Set up automated reports to get regular insights.' 
                    : searchQuery 
                    ? `No reports match "${searchQuery}". Try adjusting your search or filters.`
                    : 'Generate your first report to get insights about your business performance.'
                  }
                </p>
                <div className="flex items-center justify-center space-x-3">
                  <button 
                    onClick={() => setActiveTab('templates')}
                    className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                  >
                    Create Your First Report
                  </button>
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="px-6 py-3 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Clear Search
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className={cn(
                "grid gap-6",
                viewMode === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
              )}>
                {filteredReports.map((report) => (
                  <div key={report.id} className={cn(
                    "bg-white rounded-xl border border-gray-200 hover:shadow-lg hover:border-blue-200 transition-all duration-300",
                    viewMode === 'grid' ? "p-6" : "p-6"
                  )}>
                    <div className={cn(
                      "flex",
                      viewMode === 'grid' ? "flex-col" : "items-center justify-between"
                    )}>
                      <div className={cn(
                        "flex",
                        viewMode === 'grid' ? "items-center space-x-3 mb-4" : "items-center space-x-4 flex-1"
                      )}>
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg flex items-center justify-center">
                            {getTypeIcon(report.type)}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <h3 className="font-semibold text-gray-900 truncate">
                              {report.title}
                            </h3>
                            {report.scheduleFrequency && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                {report.scheduleFrequency}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm mb-2 line-clamp-2">{report.description}</p>
                          <div className="flex items-center space-x-3 text-xs text-gray-500">
                            <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                            {report.size && <span>{report.size}</span>}
                            {report.pages && <span>{report.pages} pages</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className={cn(
                        "flex items-center",
                        viewMode === 'grid' ? "justify-between mt-4" : "space-x-4"
                      )}>
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(report.status)}
                          <span className="text-sm font-medium text-gray-700">
                            {getStatusText(report.status)}
                          </span>
                        </div>
                        
                        {report.status === 'completed' && report.downloadUrl && (
                          <div className="flex items-center space-x-2">
                            <div className="relative">
                              <button 
                                onClick={() => handleDownloadReport(report, 'csv')}
                                className="flex items-center px-3 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors duration-200"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                CSV
                              </button>
                            </div>
                            <button 
                              onClick={() => handleDownloadReport(report, 'html')}
                              className="flex items-center px-3 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                            >
                              <Download className="h-4 w-4 mr-2" />
                              HTML
                            </button>
                            <button
                              onClick={() => handleDeleteReport(report.id)}
                              disabled={deleting === report.id}
                              className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors duration-200"
                            >
                              {deleting === report.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom Date Range Modal */}
        {showDateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-gray-900">Select Date Range</h3>
                <button
                  onClick={() => {
                    setShowDateModal(false)
                    setCustomDateRange({ startDate: '', endDate: '' })
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) => setCustomDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {customDateRange.startDate && customDateRange.endDate && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Date Range:</strong> {new Date(customDateRange.startDate).toLocaleDateString()} - {new Date(customDateRange.endDate).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      {Math.ceil((new Date(customDateRange.endDate).getTime() - new Date(customDateRange.startDate).getTime()) / (1000 * 60 * 60 * 24))} days selected
                    </p>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setShowDateModal(false)
                    setCustomDateRange({ startDate: '', endDate: '' })
                  }}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCustomDateSubmit}
                  disabled={!customDateRange.startDate || !customDateRange.endDate || generating === 'custom'}
                  className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {generating === 'custom' ? (
                    <div className="flex items-center justify-center">
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                      Generating...
                    </div>
                  ) : (
                    'Generate Report'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}