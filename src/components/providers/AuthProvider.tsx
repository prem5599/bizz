// src/components/providers/AuthProvider.tsx
'use client'

import { SessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'
import type { Session } from 'next-auth'

/**
 * Props for the AuthProvider component
 */
interface AuthProviderProps {
  children: ReactNode
  session?: Session | null
}

/**
 * Authentication Provider Component
 * 
 * Wraps the application with NextAuth SessionProvider to enable
 * authentication throughout the app. This provider:
 * 
 * - Manages user session state
 * - Handles automatic token refresh
 * - Provides session context to all child components
 * - Persists authentication across page reloads
 * 
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children, session }: AuthProviderProps) {
  return (
    <SessionProvider 
      session={session}
      // Session configuration options
      refetchInterval={5 * 60} // Refetch session every 5 minutes
      refetchOnWindowFocus={true} // Refetch when window gains focus
      refetchWhenOffline={false} // Don't refetch when offline
    >
      {children}
    </SessionProvider>
  )
}

/**
 * Extended AuthProvider with additional error handling and loading states
 */
interface ExtendedAuthProviderProps extends AuthProviderProps {
  fallback?: ReactNode
  onError?: (error: Error) => void
}

export function ExtendedAuthProvider({ 
  children, 
  session, 
  fallback,
  onError 
}: ExtendedAuthProviderProps) {
  return (
    <SessionProvider 
      session={session}
      refetchInterval={5 * 60}
      refetchOnWindowFocus={true}
      refetchWhenOffline={false}
    >
      <AuthErrorBoundary onError={onError} fallback={fallback}>
        {children}
      </AuthErrorBoundary>
    </SessionProvider>
  )
}

/**
 * Error Boundary for Authentication Errors
 */
interface AuthErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error) => void
}

interface AuthErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class AuthErrorBoundary extends React.Component<
  AuthErrorBoundaryProps,
  AuthErrorBoundaryState
> {
  constructor(props: AuthErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): AuthErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Authentication Error:', error, errorInfo)
    this.props.onError?.(error)
  }

  render() {
    if (this.state.hasError) {
      // Custom error fallback
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Default error fallback
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg 
                className="w-8 h-8 text-red-600" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
            </div>
            
            <h2 className="text-xl font-semibold text-slate-900 mb-2">
              Authentication Error
            </h2>
            
            <p className="text-slate-600 mb-6">
              There was a problem with authentication. Please try refreshing the page or contact support if the issue persists.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
              
              <button
                onClick={() => window.location.href = '/auth/signin'}
                className="w-full bg-slate-100 text-slate-700 py-2 px-4 rounded-lg hover:bg-slate-200 transition-colors"
              >
                Go to Sign In
              </button>
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-6 text-left">
                <summary className="text-sm text-slate-500 cursor-pointer hover:text-slate-700">
                  Error Details (Development)
                </summary>
                <pre className="mt-2 text-xs text-red-600 bg-red-50 p-3 rounded border overflow-auto">
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Loading component for authentication states
 */
export function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-slate-900">BizInsights</span>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-slate-600">Initializing...</span>
        </div>
      </div>
    </div>
  )
}

/**
 * Hook to check authentication status with loading state
 */
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import React from 'react'

export function useAuthGuard(redirectTo: string = '/auth/signin') {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return // Still loading

    if (!session && status === 'unauthenticated') {
      router.push(redirectTo)
    }
  }, [session, status, router, redirectTo])

  return {
    session,
    loading: status === 'loading',
    authenticated: !!session,
  }
}

/**
 * Higher-order component for protecting routes
 */
export function withAuth<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    redirectTo?: string
    loadingComponent?: React.ComponentType
    roles?: string[]
  }
) {
  const AuthenticatedComponent = (props: P) => {
    const { session, loading, authenticated } = useAuthGuard(options?.redirectTo)
    
    // Show loading state
    if (loading) {
      const LoadingComponent = options?.loadingComponent || AuthLoading
      return <LoadingComponent />
    }

    // Not authenticated
    if (!authenticated) {
      return null // Will be redirected by useAuthGuard
    }

    // Check roles if specified
    if (options?.roles && session?.user) {
      const userRoles = (session.user as any).roles || []
      const hasRequiredRole = options.roles.some(role => userRoles.includes(role))
      
      if (!hasRequiredRole) {
        return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-slate-900 mb-2">Access Denied</h2>
              <p className="text-slate-600">You don't have permission to access this page.</p>
            </div>
          </div>
        )
      }
    }

    return <WrappedComponent {...props} />
  }

  AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`

  return AuthenticatedComponent
}

/**
 * Component for handling sign out with confirmation
 */
interface SignOutButtonProps {
  children?: ReactNode
  className?: string
  confirmMessage?: string
  onSignOut?: () => void
}

export function SignOutButton({ 
  children, 
  className, 
  confirmMessage = "Are you sure you want to sign out?",
  onSignOut 
}: SignOutButtonProps) {
  const { signOut } = useSession() as any

  const handleSignOut = async () => {
    if (window.confirm(confirmMessage)) {
      try {
        onSignOut?.()
        await signOut({ callbackUrl: '/' })
      } catch (error) {
        console.error('Sign out error:', error)
      }
    }
  }

  return (
    <button onClick={handleSignOut} className={className}>
      {children || 'Sign Out'}
    </button>
  )
}

// Export the main AuthProvider as default
export default AuthProvider