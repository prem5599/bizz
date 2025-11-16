// src/hooks/useAuthGuard.tsx
'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { SignUpPopup } from '@/components/auth/SignUpPopup'

interface UseAuthGuardOptions {
  feature?: string
  title?: string
  description?: string
}

export function useAuthGuard(options?: UseAuthGuardOptions) {
  const { data: session, status } = useSession()
  const [showSignUpPopup, setShowSignUpPopup] = useState(false)

  const requireAuth = (callback?: () => void) => {
    if (status === 'loading') return false

    if (!session) {
      setShowSignUpPopup(true)
      return false
    }

    // User is authenticated, execute callback
    callback?.()
    return true
  }

  const AuthPopup = () => (
    <SignUpPopup
      isOpen={showSignUpPopup}
      onClose={() => setShowSignUpPopup(false)}
      title={options?.title}
      description={options?.description}
      feature={options?.feature}
    />
  )

  return {
    isAuthenticated: !!session,
    isLoading: status === 'loading',
    requireAuth,
    AuthPopup
  }
}

// Higher-order component version
export function withAuthGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: UseAuthGuardOptions
) {
  return function AuthGuardedComponent(props: P) {
    const { requireAuth, AuthPopup } = useAuthGuard(options)

    return (
      <>
        <WrappedComponent {...props} requireAuth={requireAuth} />
        <AuthPopup />
      </>
    )
  }
}

export default useAuthGuard