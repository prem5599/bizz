// src/components/providers/ClientOnly.tsx
'use client'

import { ReactNode, useEffect, useState } from 'react'

/**
 * Props for the ClientOnly component
 */
interface ClientOnlyProps {
  children: ReactNode
  fallback?: ReactNode
  className?: string
}

/**
 * ClientOnly Component
 * 
 * Prevents hydration mismatches by only rendering children on the client side
 * after the component has mounted. This is essential for:
 * 
 * - Components that use browser-only APIs (localStorage, window, etc.)
 * - Components with different server/client rendering behavior
 * - Third-party libraries that don't support SSR
 * - Dynamic content that changes based on client state
 * 
 * @example
 * ```tsx
 * <ClientOnly fallback={<div>Loading...</div>}>
 *   <ComponentThatUsesWindow />
 * </ClientOnly>
 * ```
 */
export function ClientOnly({ children, fallback = null, className }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => {
    setHasMounted(true)
  }, [])

  if (!hasMounted) {
    return fallback ? (
      <div className={className}>
        {fallback}
      </div>
    ) : null
  }

  return <div className={className}>{children}</div>
}

/**
 * Enhanced ClientOnly with loading states and error handling
 */
interface EnhancedClientOnlyProps extends ClientOnlyProps {
  showLoading?: boolean
  loadingComponent?: ReactNode
  onMount?: () => void
  onError?: (error: Error) => void
}

export function EnhancedClientOnly({ 
  children, 
  fallback, 
  className,
  showLoading = false,
  loadingComponent,
  onMount,
  onError
}: EnhancedClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    try {
      setHasMounted(true)
      onMount?.()
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error during mount')
      setError(error)
      onError?.(error)
    }
  }, [onMount, onError])

  // Error state
  if (error) {
    return (
      <div className={className}>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h3 className="text-sm font-medium text-red-800">
            Client Rendering Error
          </h3>
          <p className="mt-1 text-sm text-red-700">
            Failed to render client-side component.
          </p>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-2 text-xs text-red-600 bg-red-100 p-2 rounded overflow-auto">
              {error.message}
            </pre>
          )}
        </div>
      </div>
    )
  }

  // Not mounted yet
  if (!hasMounted) {
    if (showLoading && loadingComponent) {
      return <div className={className}>{loadingComponent}</div>
    }
    if (fallback) {
      return <div className={className}>{fallback}</div>
    }
    return null
  }

  return <div className={className}>{children}</div>
}

/**
 * Default loading component for ClientOnly
 */
export function ClientOnlyLoading() {
  return (
    <div className="flex items-center justify-center p-4">
      <div className="flex items-center space-x-2">
        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-slate-400"></div>
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    </div>
  )
}

/**
 * Minimal loading skeleton for ClientOnly
 */
export function ClientOnlySkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-slate-200 rounded w-1/2 mb-2"></div>
      <div className="h-4 bg-slate-200 rounded w-5/6"></div>
    </div>
  )
}

/**
 * Hook to check if component has mounted (client-side)
 */
export function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  return isMounted
}

/**
 * Hook to safely access browser APIs
 */
export function useBrowserAPI<T>(
  apiFunction: () => T,
  fallback: T
): T {
  const [result, setResult] = useState<T>(fallback)
  const isMounted = useIsMounted()

  useEffect(() => {
    if (isMounted) {
      try {
        const apiResult = apiFunction()
        setResult(apiResult)
      } catch (error) {
        console.warn('Browser API access failed:', error)
        setResult(fallback)
      }
    }
  }, [isMounted, apiFunction, fallback])

  return result
}

/**
 * Hook for client-side only storage operations
 */
export function useClientStorage(key: string, defaultValue: any = null) {
  const isMounted = useIsMounted()
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    if (isMounted && typeof window !== 'undefined') {
      try {
        const item = window.localStorage.getItem(key)
        if (item !== null) {
          setValue(JSON.parse(item))
        }
      } catch (error) {
        console.warn('Failed to read from localStorage:', error)
      }
    }
  }, [key, isMounted])

  const setStoredValue = (newValue: any) => {
    try {
      setValue(newValue)
      if (typeof window !== 'undefined') {
        if (newValue === null) {
          window.localStorage.removeItem(key)
        } else {
          window.localStorage.setItem(key, JSON.stringify(newValue))
        }
      }
    } catch (error) {
      console.warn('Failed to write to localStorage:', error)
    }
  }

  return [value, setStoredValue] as const
}

/**
 * Higher-order component to make any component client-only
 */
export function withClientOnly<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode
    loadingComponent?: ReactNode
    showLoading?: boolean
  }
) {
  const ClientOnlyComponent = (props: P) => {
    return (
      <ClientOnly
        fallback={options?.fallback}
      >
        <WrappedComponent {...props} />
      </ClientOnly>
    )
  }

  ClientOnlyComponent.displayName = `withClientOnly(${WrappedComponent.displayName || WrappedComponent.name})`

  return ClientOnlyComponent
}

/**
 * Component for conditionally rendering based on client/server state
 */
interface ConditionalRenderProps {
  client?: ReactNode
  server?: ReactNode
  loading?: ReactNode
}

export function ConditionalRender({ client, server, loading }: ConditionalRenderProps) {
  const isMounted = useIsMounted()

  if (!isMounted) {
    return (
      <>
        {loading}
        {server}
      </>
    )
  }

  return <>{client}</>
}

/**
 * Safe component for rendering client-side only content with error boundaries
 */
interface SafeClientOnlyProps extends ClientOnlyProps {
  errorFallback?: ReactNode
}

export function SafeClientOnly({ 
  children, 
  fallback, 
  errorFallback,
  className 
}: SafeClientOnlyProps) {
  return (
    <ClientOnlyErrorBoundary fallback={errorFallback}>
      <ClientOnly fallback={fallback} className={className}>
        {children}
      </ClientOnly>
    </ClientOnlyErrorBoundary>
  )
}

/**
 * Error boundary specifically for client-only components
 */
interface ClientOnlyErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ClientOnlyErrorBoundaryState {
  hasError: boolean
  error?: Error
}

class ClientOnlyErrorBoundary extends React.Component<
  ClientOnlyErrorBoundaryProps,
  ClientOnlyErrorBoundaryState
> {
  constructor(props: ClientOnlyErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ClientOnlyErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ClientOnly Error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
          <p className="text-yellow-800">
            ⚠️ Client component failed to render
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-2">
              <summary className="cursor-pointer text-yellow-700">
                Error Details
              </summary>
              <pre className="mt-1 text-xs text-yellow-600 overflow-auto">
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      )
    }

    return this.props.children
  }
}

// Import React for class component
import React from 'react'

// Export the main ClientOnly as default
export default ClientOnly