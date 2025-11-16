// src/components/layout/Sidebar.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  BarChart3, 
  Settings, 
  Users, 
  PlusCircle, 
  Home,
  Lightbulb,
  FileText,
  X,
  ChevronDown,
  Building2,
  Crown,
  Zap
} from 'lucide-react'
import { cn } from '@/lib/utils'

const getNavigation = (pathname: string) => {
  // Extract orgSlug from pathname for dynamic routes
  const pathSegments = pathname.split('/')
  const orgSlug = pathSegments[1] || 'demo' // fallback to demo
  
  return [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
    { name: 'Insights', href: '/dashboard/insights', icon: Lightbulb },
    { name: 'Reports', href: '/dashboard/reports', icon: FileText },
    { name: 'Integrations', href: `/${orgSlug}/integrations`, icon: PlusCircle },
    { name: 'Team', href: '/dashboard/team', icon: Users },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ]
}

interface SidebarProps {
  onClose?: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const pathname = usePathname()
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false)
  const navigation = getNavigation(pathname)

  // Sample organization data - in real app, this would come from context/props
  const currentOrg = {
    name: "My Business",
    plan: "Free Plan",
    avatar: null
  }

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 py-6 shadow-lg border-r border-slate-200">
      {/* Close button for mobile */}
      {onClose && (
        <div className="flex items-center justify-between lg:hidden">
          {/* <h1 className="text-xl font-bold text-blue-600">BizInsights</h1> */}
          <button
            type="button"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-500"
            onClick={onClose}
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      )}

      {/* Logo for desktop */}
      {/* <div className="hidden lg:flex lg:items-center">
        <h1 className="text-xl font-bold text-blue-600">BizInsights</h1>
      </div> */}

      {/* Organization selector */}
      <div className="relative">
        <button
          type="button"
          className="flex w-full items-center gap-x-3 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-100"
          onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white text-sm font-semibold">
            {currentOrg.avatar ? (
              <img 
                src={currentOrg.avatar} 
                alt={currentOrg.name}
                className="h-8 w-8 rounded-lg"
              />
            ) : (
              <Building2 className="h-4 w-4" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate font-medium text-slate-900">
              {currentOrg.name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {currentOrg.plan}
            </p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        {/* Organization dropdown */}
        {orgDropdownOpen && (
          <div className="absolute left-0 right-0 z-50 mt-2 origin-top rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="px-3 py-2 border-b border-slate-100">
              <p className="text-xs font-medium text-slate-900 uppercase tracking-wide">
                Organizations
              </p>
            </div>
            <Link
              href="/dashboard"
              className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
            >
              <Building2 className="h-4 w-4 mr-3 text-slate-400" />
              {currentOrg.name}
              <Crown className="h-3 w-3 ml-auto text-yellow-500" />
            </Link>
            <div className="border-t border-slate-100">
              <Link
                href="/dashboard/settings?tab=organizations"
                className="flex items-center px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
              >
                <PlusCircle className="h-4 w-4 mr-3 text-slate-400" />
                Create organization
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Plan upgrade banner */}
      <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border border-blue-100">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Zap className="h-5 w-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900">
              Upgrade to Pro
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Get unlimited integrations and advanced insights
            </p>
            <button className="mt-2 text-xs font-medium text-blue-600 hover:text-blue-500">
              Learn more →
            </button>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href))
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    'group flex gap-x-3 rounded-md px-3 py-2 text-sm font-medium leading-6 transition-colors',
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-700 hover:text-blue-600 hover:bg-slate-50'
                  )}
                  onClick={onClose} // Close mobile sidebar when navigating
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-colors',
                      isActive
                        ? 'text-blue-600'
                        : 'text-slate-400 group-hover:text-blue-600'
                    )}
                  />
                  {item.name}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-200 pt-4">
        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex items-center justify-between">
            <span>Version 1.0.0</span>
            <Link href="/help" className="text-blue-600 hover:text-blue-500">
              Help
            </Link>
          </div>
          <div>
            <Link href="/privacy" className="text-blue-600 hover:text-blue-500">
              Privacy
            </Link>
            {' • '}
            <Link href="/terms" className="text-blue-600 hover:text-blue-500">
              Terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}