// src/app/dashboard/team/page.tsx
'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { 
  Plus, 
  MoreVertical, 
  Mail, 
  Crown, 
  Shield, 
  Eye, 
  Trash2, 
  UserCheck 
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  status: 'active' | 'pending' | 'suspended'
  joinedAt: string
  lastActive: string
  avatar?: string
}

interface PendingInvitation {
  id: string
  email: string
  role: string
  invitedBy: string
  invitedAt: string
  expiresAt: string
}

export default function TeamPage() {
  const { data: session } = useSession()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [organizationId, setOrganizationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    role: 'member'
  })
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.id) {
      fetchOrganizationAndTeamData()
    }
  }, [session?.user?.id])

  const fetchOrganizationAndTeamData = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // First, get the current organization
      const orgResponse = await fetch('/api/organizations/current')
      if (!orgResponse.ok) {
        throw new Error('Failed to fetch organization')
      }
      
      const orgData = await orgResponse.json()
      const currentOrgId = orgData.organization.id
      setOrganizationId(currentOrgId)
      
      // Then fetch team data
      await fetchTeamData(currentOrgId)
    } catch (error) {
      console.error('Failed to fetch organization and team data:', error)
      setError('Failed to load team data')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchTeamData = async (orgId: string) => {
    try {
      const response = await fetch(`/api/organizations/${orgId}/team`)
      if (!response.ok) {
        throw new Error('Failed to fetch team data')
      }
      
      const data = await response.json()
      
      // Transform the data to match the expected format
      const transformedMembers = data.members.map((member: any) => ({
        id: member.id,
        name: member.user.name || member.user.email,
        email: member.user.email,
        role: member.role,
        status: 'active', // Default status
        joinedAt: member.createdAt,
        lastActive: getRelativeTime(member.createdAt), // Fallback to joined time
        avatar: member.user.image
      }))
      
      const transformedInvitations = data.invitations.map((invitation: any) => ({
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        invitedBy: 'Team Admin', // Could be improved to show actual inviter name
        invitedAt: invitation.createdAt,
        expiresAt: invitation.expiresAt
      }))
      
      setTeamMembers(transformedMembers)
      setPendingInvitations(transformedInvitations)
    } catch (error) {
      console.error('Failed to fetch team data:', error)
      throw error
    }
  }

  const getRelativeTime = (dateString: string): string => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!organizationId) {
      alert('Organization not loaded. Please try again.')
      return
    }
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'invite',
          email: inviteForm.email,
          role: inviteForm.role
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }
      
      alert(`Invitation sent to ${inviteForm.email}`)
      setIsInviteDialogOpen(false)
      setInviteForm({ email: '', role: 'member' })
      
      // Refresh team data
      if (organizationId) {
        await fetchTeamData(organizationId)
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to send invitation')
    }
  }

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (!organizationId) {
      alert('Organization not loaded. Please try again.')
      return
    }
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update_role',
          memberId,
          newRole
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update role')
      }
      
      alert('Role updated successfully')
      
      // Refresh team data
      await fetchTeamData(organizationId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update role')
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!organizationId) {
      alert('Organization not loaded. Please try again.')
      return
    }
    
    if (!confirm('Are you sure you want to remove this team member?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'remove_member',
          memberId
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to remove team member')
      }
      
      alert('Team member removed')
      
      // Refresh team data
      await fetchTeamData(organizationId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to remove team member')
    }
  }

  const handleCancelInvitation = async (invitationId: string) => {
    if (!organizationId) {
      alert('Organization not loaded. Please try again.')
      return
    }
    
    if (!confirm('Are you sure you want to cancel this invitation?')) {
      return
    }
    
    try {
      const response = await fetch(`/api/organizations/${organizationId}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'cancel_invitation',
          invitationId
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel invitation')
      }
      
      alert('Invitation cancelled')
      
      // Refresh team data
      await fetchTeamData(organizationId)
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to cancel invitation')
    }
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />
      case 'member':
        return <UserCheck className="h-4 w-4 text-green-500" />
      case 'viewer':
        return <Eye className="h-4 w-4 text-gray-500" />
      default:
        return null
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-yellow-100 text-yellow-800'
      case 'admin':
        return 'bg-blue-100 text-blue-800'
      case 'member':
        return 'bg-green-100 text-green-800'
      case 'viewer':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div className="h-8 bg-gray-200 rounded w-48 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-32 animate-pulse"></div>
          </div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Error Loading Team</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchOrganizationAndTeamData}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              Try Again
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-gray-600 mt-1">
              Manage your team members and their permissions
            </p>
          </div>
          
          {/* Invite Dialog */}
          <div className="relative">
            <button
              onClick={() => setIsInviteDialogOpen(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Plus className="h-4 w-4 mr-2" />
              Invite Member
            </button>
            
            {isInviteDialogOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-30 z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold">Invite Team Member</h2>
                    <p className="text-sm text-gray-500">
                      Send an invitation to add a new member to your team.
                    </p>
                  </div>
                  
                  <form onSubmit={handleInviteSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Email Address</label>
                      <input
                        type="email"
                        required
                        value={inviteForm.email}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                        placeholder="member@company.com"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Role</label>
                      <select
                        value={inviteForm.role}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, role: e.target.value }))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="member">Member</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    
                    <div className="flex justify-end space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => setIsInviteDialogOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700"
                      >
                        Send Invitation
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Team Members Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
            <p className="text-sm text-gray-500">
              {teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Member</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Active</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th scope="col" className="relative px-6 py-3 w-[50px]">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamMembers.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 flex-shrink-0">
                          {member.avatar ? (
                            <img className="h-10 w-10 rounded-full" src={member.avatar} alt="" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-sm font-medium text-gray-700">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(member.role)}
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          getRoleBadgeColor(member.role)
                        )}>
                          {member.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={cn(
                        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                        member.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      )}>
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {member.lastActive}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="relative">
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === member.id ? null : member.id)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <MoreVertical className="h-5 w-5" />
                        </button>
                        
                        {activeDropdown === member.id && (
                          <div className="absolute right-0 z-10 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5">
                            <div className="py-1">
                              {member.role !== 'owner' && (
                                <>
                                  <button
                                    onClick={() => {
                                      handleRoleChange(member.id, 'admin')
                                      setActiveDropdown(null)
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    Make Admin
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleRoleChange(member.id, 'member')
                                      setActiveDropdown(null)
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    Make Member
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleRoleChange(member.id, 'viewer')
                                      setActiveDropdown(null)
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                  >
                                    Make Viewer
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleRemoveMember(member.id)
                                      setActiveDropdown(null)
                                    }}
                                    className="block w-full text-left px-4 py-2 text-sm text-red-700 hover:bg-red-50"
                                  >
                                    Remove Member
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pending Invitations */}
        {pendingInvitations.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Pending Invitations</h2>
              <p className="text-sm text-gray-500">
                {pendingInvitations.length} pending invitation{pendingInvitations.length !== 1 ? 's' : ''}
              </p>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invited By</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expires</th>
                    <th scope="col" className="relative px-6 py-3 w-[50px]">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingInvitations.map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <Mail className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">{invitation.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={cn(
                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                          getRoleBadgeColor(invitation.role)
                        )}>
                          {invitation.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invitation.invitedBy}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invitation.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleCancelInvitation(invitation.id)}
                          className="text-gray-400 hover:text-red-500"
                          title="Cancel invitation"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Team Permissions Info */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Permission Levels</h2>
            <p className="text-sm text-gray-500">
              Understanding team member roles and permissions
            </p>
          </div>
          
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-start space-x-3">
              <Crown className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900">Owner</div>
                <div className="text-sm text-gray-600">
                  Full access to all features, billing, and team management
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900">Admin</div>
                <div className="text-sm text-gray-600">
                  Can manage team members, integrations, and all data
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <UserCheck className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900">Member</div>
                <div className="text-sm text-gray-600">
                  Can view and edit data, create reports and insights
                </div>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <Eye className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <div className="font-medium text-gray-900">Viewer</div>
                <div className="text-sm text-gray-600">
                  Read-only access to dashboards and reports
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}