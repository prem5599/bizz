// src/hooks/useOrganization.ts
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface Organization {
  id: string
  name: string
  slug: string
  createdAt: string
  subscriptionTier: string
  userRole: 'owner' | 'admin' | 'member' | 'viewer'
  memberSince: string
  stats: {
    totalIntegrations: number
    totalMembers: number
  }
}

interface UseOrganizationReturn {
  organization: Organization | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useOrganization(): UseOrganizationReturn {
  const params = useParams()
  const orgSlug = params.orgSlug as string
  
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrganization = async () => {
    if (!orgSlug) {
      setError('No organization slug provided')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/organizations/by-slug/${orgSlug}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Organization not found')
        }
        if (response.status === 403) {
          throw new Error('You do not have access to this organization')
        }
        throw new Error('Failed to fetch organization')
      }
      
      const data = await response.json()
      setOrganization(data.organization)
    } catch (error) {
      console.error('Failed to fetch organization:', error)
      setError(error instanceof Error ? error.message : 'Failed to load organization')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOrganization()
  }, [orgSlug])

  return {
    organization,
    loading,
    error,
    refetch: fetchOrganization
  }
}

// Helper hook for getting organization ID
export function useOrganizationId(): string | null {
  const { organization } = useOrganization()
  return organization?.id || null
}