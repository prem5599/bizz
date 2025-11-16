// src/app/dashboard/settings/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { 
  Building2, 
  Bell, 
  Shield, 
  CreditCard, 
  Upload, 
  Globe, 
  Clock, 
  Check,
  Key,
  Mail,
  Phone,
  Lock,
  CreditCard as CardIcon,
  Download,
  Trash2,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
  Save,
  ExternalLink
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useCurrencyContext } from '@/contexts/CurrencyContext'

interface OrganizationSettings {
  id: string
  name: string
  email: string
  website: string
  phone: string
  address: string
  timezone: string
  logo: string | null
  industry: string
  companySize: string
  currency: string
}

interface UserProfile {
  id: string
  name: string
  email: string
  image: string | null
  phone: string | null
  timezone: string | null
}

interface SecurityInfo {
  twoFactorEnabled: boolean
  passwordLastChanged: string
  activeSessions: number
  sessions: Array<{
    id: string
    device: string
    location: string
    lastActive: string
    isCurrent: boolean
  }>
}

interface BillingInfo {
  currentPlan: {
    name: string
    tier: string
    price: number
    features: string[]
    restrictions: string[]
  }
  subscription: {
    status: string
    endsAt: string | null
    trialEndsAt: string | null
    isTrialActive: boolean
  }
  billing: {
    email: string | null
    address: string | null
    paymentMethod: string
    billingCycle: string
  }
  usage: {
    integrations: { current: number; limit: number; percentage: number }
    dataPoints: { current: number; limit: number; percentage: number }
    apiCalls: { current: number; limit: number; percentage: number }
  }
  history: Array<{
    id: string
    date: string
    description: string
    amount: number
    status: string
  }>
}

const SUPPORTED_CURRENCIES = [
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', flag: '🇮🇳' },
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', flag: '🇯🇵' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', flag: '🇦🇺' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', flag: '🇨🇦' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', flag: '🇨🇭' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', flag: '🇨🇳' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', flag: '🇸🇬' }
]

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('organization')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const { currency, setCurrency, formatCurrency } = useCurrencyContext()
  
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [orgSettings, setOrgSettings] = useState<OrganizationSettings | null>(null)
  const [securityInfo, setSecurityInfo] = useState<SecurityInfo | null>(null)
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    weeklyReports: true,
    monthlyReports: true,
    alertThresholds: true,
    integrationUpdates: true,
    marketingEmails: false,
    securityAlerts: true
  })

  const [securitySettings, setSecuritySettings] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  useEffect(() => {
    loadAllSettings()
  }, [])

  const loadAllSettings = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const [orgResponse, notificationResponse, securityResponse, billingResponse] = await Promise.all([
        fetch('/api/organizations/settings'),
        fetch('/api/user/notifications'),
        fetch('/api/user/security'),
        fetch('/api/billing')
      ])

      if (orgResponse.ok) {
        const orgData = await orgResponse.json()
        setOrgSettings(orgData.organization)
      }

      if (notificationResponse.ok) {
        const notifData = await notificationResponse.json()
        setNotificationSettings(notifData.notificationSettings)
      }

      if (securityResponse.ok) {
        const secData = await securityResponse.json()
        setSecurityInfo(secData.security)
      }

      if (billingResponse.ok) {
        const billData = await billingResponse.json()
        setBillingInfo(billData.billing)
      }

    } catch (error) {
      console.error('Failed to load settings:', error)
      setError('Failed to load settings. Please refresh the page.')
    } finally {
      setIsLoading(false)
    }
  }

  const showMessage = (message: string, isError = false) => {
    if (isError) {
      setError(message)
      setSuccess(null)
    } else {
      setSuccess(message)
      setError(null)
    }
    setTimeout(() => {
      setError(null)
      setSuccess(null)
    }, 5000)
  }

  const handleSaveOrganization = async () => {
    if (!orgSettings) return
    
    setIsSaving(true)
    setError(null)
    
    try {
      const response = await fetch('/api/organizations/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orgSettings)
      })

      const data = await response.json()

      if (response.ok) {
        setOrgSettings(data.organization)
        showMessage('Organization settings saved successfully!')
      } else {
        throw new Error(data.error || 'Failed to save settings')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to save settings', true)
    } finally {
      setIsSaving(false)
    }
  }

  const handleSaveNotifications = async () => {
    setIsSaving(true)
    setError(null)
    
    try {
      const response = await fetch('/api/user/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationSettings)
      })

      const data = await response.json()

      if (response.ok) {
        showMessage('Notification preferences saved successfully!')
      } else {
        throw new Error(data.error || 'Failed to save notifications')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to save notification preferences', true)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCurrencyChange = async (newCurrency: string) => {
    if (!orgSettings) return
    
    try {
      // Update organization currency
      const updatedOrg = { ...orgSettings, currency: newCurrency }
      setOrgSettings(updatedOrg)
      
      // Update global currency context
      await setCurrency(newCurrency)
      
      // Save to backend
      const response = await fetch('/api/organizations/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currency: newCurrency })
      })

      if (response.ok) {
        showMessage(`Currency changed to ${newCurrency}. This will reflect across all pages.`)
      } else {
        throw new Error('Failed to save currency preference')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to update currency', true)
    }
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !orgSettings) return

    if (file.size > 2 * 1024 * 1024) {
      showMessage('File size must be less than 2MB', true)
      return
    }

    setIsSaving(true)
    try {
      const formData = new FormData()
      formData.append('logo', file)
      
      const response = await fetch('/api/upload/logo', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (response.ok) {
        setOrgSettings(prev => prev ? { ...prev, logo: data.logoUrl } : null)
        showMessage('Logo uploaded successfully!')
      } else {
        throw new Error(data.error || 'Failed to upload logo')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to upload logo', true)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePasswordChange = async () => {
    if (securitySettings.newPassword !== securitySettings.confirmPassword) {
      showMessage('New passwords do not match', true)
      return
    }

    if (securitySettings.newPassword.length < 8) {
      showMessage('Password must be at least 8 characters long', true)
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/user/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change_password',
          currentPassword: securitySettings.currentPassword,
          newPassword: securitySettings.newPassword,
          confirmPassword: securitySettings.confirmPassword
        })
      })

      const data = await response.json()

      if (response.ok) {
        showMessage('Password changed successfully!')
        setSecuritySettings({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        })
        // Reload security info
        if (securityInfo) {
          setSecurityInfo({
            ...securityInfo,
            passwordLastChanged: 'Just now'
          })
        }
      } else {
        throw new Error(data.error || 'Failed to change password')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to change password', true)
    } finally {
      setIsSaving(false)
    }
  }

  const toggle2FA = async () => {
    if (!securityInfo) return
    
    setIsSaving(true)
    try {
      const response = await fetch('/api/user/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle_2fa' })
      })

      const data = await response.json()

      if (response.ok) {
        setSecurityInfo({
          ...securityInfo,
          twoFactorEnabled: data.twoFactorEnabled
        })
        showMessage(data.message)
      } else {
        throw new Error(data.error || 'Failed to update two-factor authentication')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to update two-factor authentication', true)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDataExport = async (exportType: string) => {
    try {
      const response = await fetch('/api/user/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exportType, format: 'json' })
      })

      const data = await response.json()

      if (response.ok) {
        // Create download link
        const element = document.createElement('a')
        element.href = data.downloadUrl
        element.download = data.filename
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
        
        showMessage(`${exportType} data exported successfully!`)
      } else {
        throw new Error(data.error || 'Failed to export data')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to export data', true)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const response = await fetch('/api/user/security', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_session', sessionId })
      })

      const data = await response.json()

      if (response.ok) {
        // Remove session from list
        if (securityInfo) {
          setSecurityInfo({
            ...securityInfo,
            sessions: securityInfo.sessions.filter(s => s.id !== sessionId),
            activeSessions: securityInfo.activeSessions - 1
          })
        }
        showMessage('Session revoked successfully')
      } else {
        throw new Error(data.error || 'Failed to revoke session')
      }
    } catch (error: any) {
      showMessage(error.message || 'Failed to revoke session', true)
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded animate-pulse"></div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto mt-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-900 mb-2">Error Loading Settings</h3>
            <p className="text-red-700 mb-4">{error}</p>
            <button
              onClick={loadAllSettings}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700"
            >
              <Loader2 className="h-4 w-4 mr-2" />
              Retry
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-gray-600 mt-1">
            Manage your organization preferences and configurations
          </p>
          
          {/* Success/Error Messages */}
          {success && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <Check className="h-5 w-5 text-green-600 mr-2" />
                <p className="text-green-800">{success}</p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                <p className="text-red-800">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'organization', icon: <Building2 className="h-4 w-4 mr-2" />, label: 'Organization' },
              { id: 'notifications', icon: <Bell className="h-4 w-4 mr-2" />, label: 'Notifications' },
              { id: 'security', icon: <Shield className="h-4 w-4 mr-2" />, label: 'Security' },
              { id: 'billing', icon: <CreditCard className="h-4 w-4 mr-2" />, label: 'Billing' },
              { id: 'privacy', icon: <Download className="h-4 w-4 mr-2" />, label: 'Privacy & Data' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Organization Tab */}
        {activeTab === 'organization' && orgSettings && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Basic Information</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Organization Name</label>
                    <input
                      type="text"
                      value={orgSettings.name}
                      onChange={(e) => setOrgSettings(prev => prev ? { ...prev, name: e.target.value } : null)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input
                      type="email"
                      value={orgSettings.email || ''}
                      onChange={(e) => setOrgSettings(prev => prev ? { ...prev, email: e.target.value } : null)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Website</label>
                    <input
                      type="url"
                      value={orgSettings.website || ''}
                      onChange={(e) => setOrgSettings(prev => prev ? { ...prev, website: e.target.value } : null)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input
                      type="tel"
                      value={orgSettings.phone || ''}
                      onChange={(e) => setOrgSettings(prev => prev ? { ...prev, phone: e.target.value } : null)}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <textarea
                    value={orgSettings.address || ''}
                    onChange={(e) => setOrgSettings(prev => prev ? { ...prev, address: e.target.value } : null)}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>
              </div>

              {/* Currency & Regional Settings */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <Globe className="h-5 w-5 mr-2" />
                  Currency & Regional Settings
                </h3>
                
                {/* Currency Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Primary Currency
                  </label>
                  <p className="text-sm text-gray-500 mb-4">
                    This currency will be used for all revenue calculations and reports across the entire application.
                    <br />
                    <span className="font-medium">Current example: {formatCurrency(10000)}</span>
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {SUPPORTED_CURRENCIES.map((curr) => (
                      <button
                        key={curr.code}
                        onClick={() => handleCurrencyChange(curr.code)}
                        className={`relative flex items-center p-3 border rounded-lg hover:bg-gray-50 transition-colors ${
                          currency === curr.code
                            ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                            : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          <span className="text-xl">{curr.flag}</span>
                          <div className="text-left">
                            <div className="font-medium text-sm">{curr.code}</div>
                            <div className="text-xs text-gray-500">{curr.symbol}</div>
                          </div>
                          <div className="text-xs text-gray-600 flex-1">{curr.name}</div>
                        </div>
                        {currency === curr.code && (
                          <Check className="h-4 w-4 text-blue-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Timezone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    <Clock className="inline h-4 w-4 mr-1" />
                    Timezone
                  </label>
                  <select
                    value={orgSettings.timezone}
                    onChange={(e) => setOrgSettings(prev => ({ ...prev, timezone: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="Asia/Kolkata">India Standard Time (IST)</option>
                    <option value="America/New_York">Eastern Time (EST)</option>
                    <option value="America/Chicago">Central Time (CST)</option>
                    <option value="America/Denver">Mountain Time (MST)</option>
                    <option value="America/Los_Angeles">Pacific Time (PST)</option>
                    <option value="Europe/London">Greenwich Mean Time (GMT)</option>
                    <option value="UTC">Coordinated Universal Time (UTC)</option>
                    <option value="Asia/Dubai">Gulf Standard Time (GST)</option>
                    <option value="Asia/Singapore">Singapore Time (SGT)</option>
                    <option value="Asia/Tokyo">Japan Standard Time (JST)</option>
                  </select>
                </div>
              </div>

              {/* Business Details */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Business Details</h3>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Industry</label>
                    <select
                      value={orgSettings.industry}
                      onChange={(e) => setOrgSettings(prev => ({ ...prev, industry: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="E-commerce">E-commerce</option>
                      <option value="SaaS">SaaS</option>
                      <option value="Retail">Retail</option>
                      <option value="Manufacturing">Manufacturing</option>
                      <option value="Services">Services</option>
                      <option value="Healthcare">Healthcare</option>
                      <option value="Education">Education</option>
                      <option value="Finance">Finance</option>
                      <option value="Real Estate">Real Estate</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company Size</label>
                    <select
                      value={orgSettings.companySize}
                      onChange={(e) => setOrgSettings(prev => ({ ...prev, companySize: e.target.value }))}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    >
                      <option value="1-10">1-10 employees</option>
                      <option value="10-50">10-50 employees</option>
                      <option value="50-200">50-200 employees</option>
                      <option value="200-1000">200-1000 employees</option>
                      <option value="1000+">1000+ employees</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSaveOrganization}
                  disabled={isSaving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Logo Upload */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Organization Logo</h3>
                <div className="text-center">
                  {orgSettings.logo ? (
                    <img
                      src={orgSettings.logo}
                      alt="Organization logo"
                      className="mx-auto h-24 w-24 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="mx-auto h-24 w-24 rounded-lg bg-gray-200 flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                  <div className="mt-4">
                    <label className="cursor-pointer">
                      <span className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    PNG, JPG up to 2MB
                  </p>
                </div>
              </div>

              {/* Currency Preview */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium mb-4">Currency Preview</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Sample Revenue:</span>
                    <span className="font-medium">{formatCurrency(125000)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Sample AOV:</span>
                    <span className="font-medium">{formatCurrency(450)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Large Amount:</span>
                    <span className="font-medium">{formatCurrency(2500000)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Current Currency:</span>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {SUPPORTED_CURRENCIES.find(c => c.code === currency)?.flag} {currency}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-6">Notification Preferences</h3>
            <div className="space-y-6">
              {Object.entries(notificationSettings).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900 capitalize">
                      {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </h4>
                    <p className="text-sm text-gray-500">
                      {key === 'emailNotifications' && 'Receive email notifications for important updates'}
                      {key === 'pushNotifications' && 'Get browser push notifications'}
                      {key === 'weeklyReports' && 'Weekly summary of your business metrics'}
                      {key === 'monthlyReports' && 'Monthly detailed analytics report'}
                      {key === 'alertThresholds' && 'Alerts when metrics exceed thresholds'}
                      {key === 'integrationUpdates' && 'Updates about your connected integrations'}
                      {key === 'marketingEmails' && 'Product updates and marketing content'}
                      {key === 'securityAlerts' && 'Important security and login alerts'}
                    </p>
                  </div>
                  <button
                    onClick={() => setNotificationSettings(prev => ({ ...prev, [key]: !value }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      value ? 'bg-blue-600' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        value ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
              
              <div className="pt-4 border-t">
                <button
                  onClick={handleSaveNotifications}
                  disabled={isSaving}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Notification Preferences'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            {!securityInfo && (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  <span className="ml-3 text-gray-600">Loading security information...</span>
                </div>
              </div>
            )}
            
            {securityInfo && (
              <>
            {/* Two-Factor Authentication */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Two-Factor Authentication</h3>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    2FA Status: {securityInfo?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                  </h4>
                  <p className="text-sm text-gray-600">
                    Add an extra layer of security to your account with two-factor authentication
                  </p>
                </div>
                <button
                  onClick={toggle2FA}
                  disabled={isSaving}
                  className={`px-4 py-2 rounded-md text-sm font-medium ${
                    securityInfo?.twoFactorEnabled
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  } disabled:opacity-50`}
                >
                  {isSaving ? 'Processing...' : securityInfo?.twoFactorEnabled ? 'Disable 2FA' : 'Enable 2FA'}
                </button>
              </div>
            </div>

            {/* Password Change */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Change Password</h3>
              <p className="text-sm text-gray-600 mb-4">
                Last changed: {securityInfo?.passwordLastChanged || 'Unknown'}
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Password</label>
                  <div className="mt-1 relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={securitySettings.currentPassword}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showCurrentPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">New Password</label>
                  <div className="mt-1 relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={securitySettings.newPassword}
                      onChange={(e) => setSecuritySettings(prev => ({ ...prev, newPassword: e.target.value }))}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={securitySettings.confirmPassword}
                    onChange={(e) => setSecuritySettings(prev => ({ ...prev, confirmPassword: e.target.value }))}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  />
                </div>

                <button
                  onClick={handlePasswordChange}
                  disabled={isSaving || !securitySettings.currentPassword || !securitySettings.newPassword || !securitySettings.confirmPassword}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? 'Changing Password...' : 'Change Password'}
                </button>
              </div>
            </div>

            {/* Active Sessions */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Active Sessions</h3>
              <p className="text-sm text-gray-600 mb-4">
                You have {securityInfo?.activeSessions || 0} active sessions across different devices
              </p>
              <div className="space-y-3">
                {securityInfo?.sessions?.map(session => (
                  <div key={session.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                    <div>
                      <div className="text-sm font-medium">{session.device}</div>
                      <div className="text-xs text-gray-500">{session.location} • {new Date(session.lastActive).toLocaleDateString()}</div>
                    </div>
                    {session.isCurrent ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Current
                      </span>
                    ) : (
                      <button 
                        onClick={() => handleRevokeSession(session.id)}
                        className="text-red-600 hover:text-red-800 text-sm font-medium"
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                )) || []}
                {(!securityInfo?.sessions || securityInfo.sessions.length === 0) && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No active sessions found</p>
                  </div>
                )}
              </div>
              <div className="mt-4">
                <button 
                  onClick={() => {
                    // Handle revoke all sessions
                    fetch('/api/user/security', {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ action: 'revoke_all_sessions' })
                    }).then(() => {
                      if (securityInfo) {
                        setSecurityInfo({
                          ...securityInfo,
                          sessions: securityInfo.sessions?.filter(s => s.isCurrent) || [],
                          activeSessions: 1
                        })
                      }
                      showMessage('All other sessions revoked successfully')
                    }).catch(() => {
                      showMessage('Failed to revoke sessions', true)
                    })
                  }}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Revoke All Other Sessions
                </button>
              </div>
            </div>

            {/* Security Alerts */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Recent Security Activity</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Successful login</div>
                    <div className="text-xs text-gray-500">Chrome on Windows • 2 minutes ago</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Password changed</div>
                    <div className="text-xs text-gray-500">30 days ago</div>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-2 h-2 bg-blue-400 rounded-full mt-2"></div>
                  </div>
                  <div>
                    <div className="text-sm font-medium">Email verification</div>
                    <div className="text-xs text-gray-500">45 days ago</div>
                  </div>
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            {!billingInfo && (
              <div className="bg-white shadow rounded-lg p-6">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  <span className="ml-3 text-gray-600">Loading billing information...</span>
                </div>
              </div>
            )}
            
            {billingInfo && (
              <>
            {/* Current Plan */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Current Plan</h3>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xl font-bold text-gray-900">{billingInfo.currentPlan.name} Plan</h4>
                  <p className="text-gray-600">Perfect for getting started</p>
                  <div className="mt-2">
                    <span className="text-2xl font-bold text-green-600">{formatCurrency(billingInfo.currentPlan.price)}</span>
                    <span className="text-gray-500 ml-1">/ month</span>
                  </div>
                </div>
                <button className="px-6 py-3 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700">
                  Upgrade Plan
                </button>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h5 className="font-medium text-gray-900 mb-3">Plan Features</h5>
                <ul className="space-y-2">
                  {billingInfo.currentPlan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-600">
                      <Check className="h-4 w-4 text-green-500 mr-2" />
                      {feature}
                    </li>
                  ))}
                  {billingInfo.currentPlan.restrictions.map((restriction, index) => (
                    <li key={index} className="flex items-center text-sm text-gray-500">
                      <AlertTriangle className="h-4 w-4 text-gray-400 mr-2" />
                      {restriction} (Higher tier feature)
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Billing Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Billing Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                  <div className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg">
                    <CardIcon className="h-5 w-5 text-gray-400" />
                    <span className="text-sm">{billingInfo.billing.paymentMethod}</span>
                    <button className="text-blue-600 hover:text-blue-800 text-sm font-medium ml-auto">
                      Update
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Billing Cycle</label>
                  <select 
                    value={billingInfo.billing.billingCycle}
                    onChange={(e) => {
                      // Handle billing cycle change
                      console.log('Billing cycle changed to:', e.target.value)
                    }}
                    className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly (Save 20%)</option>
                  </select>
                </div>
              </div>

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Billing Address</label>
                <p className="text-sm text-gray-600">{billingInfo.billing.address || 'No billing address set'}</p>
                <button className="text-blue-600 hover:text-blue-800 text-sm font-medium mt-1">
                  Update Address
                </button>
              </div>
            </div>

            {/* Billing History */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Billing History</h3>
              <div className="space-y-3">
                {billingInfo.history.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-200">
                    <div>
                      <div className="text-sm font-medium">{item.description}</div>
                      <div className="text-xs text-gray-500">{item.date}</div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className={`text-sm font-medium ${
                        item.status === 'paid' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {formatCurrency(item.amount)}
                      </span>
                      <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {billingInfo.history.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No billing history available</p>
                    <p className="text-xs">Upgrade to a paid plan to see billing history</p>
                  </div>
                )}
              </div>
            </div>

            {/* Usage & Limits */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Usage & Limits</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Integrations</span>
                    <span className="text-sm text-gray-600">
                      {billingInfo.usage.integrations.current} / {billingInfo.usage.integrations.limit === -1 ? '∞' : billingInfo.usage.integrations.limit}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(billingInfo.usage.integrations.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Data Points (This Month)</span>
                    <span className="text-sm text-gray-600">
                      {billingInfo.usage.dataPoints.current.toLocaleString()} / {billingInfo.usage.dataPoints.limit === -1 ? '∞' : billingInfo.usage.dataPoints.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(billingInfo.usage.dataPoints.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
                
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">API Calls (This Month)</span>
                    <span className="text-sm text-gray-600">
                      {billingInfo.usage.apiCalls.current.toLocaleString()} / {billingInfo.usage.apiCalls.limit === -1 ? '∞' : billingInfo.usage.apiCalls.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-yellow-600 h-2 rounded-full" 
                      style={{ width: `${Math.min(billingInfo.usage.apiCalls.percentage, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div className="bg-white shadow rounded-lg p-6 border-l-4 border-red-500">
              <h3 className="text-lg font-medium mb-4 text-red-900">Danger Zone</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-red-900">Cancel Subscription</h4>
                    <p className="text-sm text-red-700">Cancel your current subscription and downgrade to free plan</p>
                  </div>
                  <button className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700">
                    Cancel Plan
                  </button>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-red-200">
                  <div>
                    <h4 className="text-sm font-medium text-red-900">Delete Account</h4>
                    <p className="text-sm text-red-700">Permanently delete your account and all associated data</p>
                  </div>
                  <button className="px-4 py-2 bg-red-700 text-white rounded-md text-sm font-medium hover:bg-red-800">
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
              </>
            )}
          </div>
        )}

        {/* Privacy & Data Tab */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            {/* Data Export */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Download className="h-5 w-5 mr-2" />
                Data Export
              </h3>
              <p className="text-gray-600 mb-6">
                Export your data in various formats. This includes your profile, organization settings, and business data.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleDataExport('profile')}
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Profile Data
                </button>
                
                <button
                  onClick={() => handleDataExport('settings')}
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Organization Settings
                </button>
                
                <button
                  onClick={() => handleDataExport('data')}
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Business Data (90 days)
                </button>
                
                <button
                  onClick={() => handleDataExport('all')}
                  className="flex items-center justify-center px-4 py-3 border border-blue-500 rounded-md shadow-sm bg-blue-50 text-sm font-medium text-blue-700 hover:bg-blue-100"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All Data
                </button>
              </div>
            </div>

            {/* Privacy Settings */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4 flex items-center">
                <Shield className="h-5 w-5 mr-2" />
                Privacy Settings
              </h3>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Data Processing</h4>
                    <p className="text-sm text-gray-600">Allow us to process your data for analytics and insights</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600 transition-colors">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-6" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Anonymous Analytics</h4>
                    <p className="text-sm text-gray-600">Help improve our service with anonymous usage analytics</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 transition-colors">
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform translate-x-1" />
                  </button>
                </div>
                
                <div className="flex items-center justify-between py-3 border-b border-gray-200">
                  <div>
                    <h4 className="text-sm font-medium text-gray-900">Data Retention</h4>
                    <p className="text-sm text-gray-600">Automatically delete old data after specified periods</p>
                  </div>
                  <select className="mt-1 block border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                    <option>Keep forever</option>
                    <option>Delete after 1 year</option>
                    <option>Delete after 2 years</option>
                    <option>Delete after 5 years</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Account Deletion */}
            <div className="bg-white shadow rounded-lg p-6 border-l-4 border-red-500">
              <h3 className="text-lg font-medium mb-4 text-red-900 flex items-center">
                <Trash2 className="h-5 w-5 mr-2" />
                Account Deletion
              </h3>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 mr-3" />
                  <div>
                    <h4 className="text-sm font-medium text-red-800">This action cannot be undone</h4>
                    <p className="text-sm text-red-700 mt-1">
                      Deleting your account will permanently remove all your data, including:
                    </p>
                    <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
                      <li>All business data and analytics</li>
                      <li>Integration configurations</li>
                      <li>Reports and insights</li>
                      <li>Organization settings</li>
                      <li>Team member access</li>
                    </ul>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-red-900">Request Account Deletion</h4>
                  <p className="text-sm text-red-700">This will start the account deletion process</p>
                </div>
                <button className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                  Delete Account
                </button>
              </div>
            </div>

            {/* Legal Information */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">Legal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <a 
                  href="/privacy-policy" 
                  target="_blank"
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Privacy Policy
                </a>
                
                <a 
                  href="/terms-of-service" 
                  target="_blank"
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Terms of Service
                </a>
                
                <a 
                  href="/gdpr-compliance" 
                  target="_blank"
                  className="flex items-center justify-center px-4 py-3 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  GDPR Compliance
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}