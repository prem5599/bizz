// app/api/organizations/[orgId]/team/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TeamManager } from '@/lib/team/manager'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    // Check if user has permission to view team
    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canRead'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get team members and pending invitations
    const [members, invitations] = await Promise.all([
      TeamManager.getTeamMembers(orgId),
      TeamManager.getPendingInvitations(orgId)
    ])

    return NextResponse.json({
      members,
      invitations,
      totalMembers: members.length,
      pendingInvitations: invitations.length
    })

  } catch (error) {
    console.error('Get team error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    // Check if user has permission to invite
    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canInvite'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, email, role, memberId, newRole, invitationId } = await req.json()

    switch (action) {
      case 'invite':
        if (!email || !role) {
          return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
        }

        if (!['admin', 'member', 'viewer'].includes(role)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const inviteResult = await TeamManager.inviteTeamMember(
          orgId,
          email,
          role,
          session.user.id
        )

        if (!inviteResult.success) {
          return NextResponse.json({ error: inviteResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Invitation sent successfully',
          invitation: inviteResult.invitation
        })

      case 'update_role':
        if (!memberId || !newRole) {
          return NextResponse.json({ error: 'Member ID and new role are required' }, { status: 400 })
        }

        if (!['admin', 'member', 'viewer'].includes(newRole)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
        }

        const updateResult = await TeamManager.updateMemberRole(
          orgId,
          memberId,
          newRole,
          session.user.id
        )

        if (!updateResult.success) {
          return NextResponse.json({ error: updateResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Member role updated successfully'
        })

      case 'remove_member':
        if (!memberId) {
          return NextResponse.json({ error: 'Member ID is required' }, { status: 400 })
        }

        const removeResult = await TeamManager.removeMember(
          orgId,
          memberId,
          session.user.id
        )

        if (!removeResult.success) {
          return NextResponse.json({ error: removeResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Member removed successfully'
        })

      case 'cancel_invitation':
        if (!invitationId) {
          return NextResponse.json({ error: 'Invitation ID is required' }, { status: 400 })
        }

        const cancelResult = await TeamManager.cancelInvitation(
          orgId,
          invitationId,
          session.user.id
        )

        if (!cancelResult.success) {
          return NextResponse.json({ error: cancelResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Invitation cancelled successfully'
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Team action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}