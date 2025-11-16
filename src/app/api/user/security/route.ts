// src/app/api/user/security/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user security information
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        passwordUpdatedAt: true,
        securitySettings: true,
        sessions: {
          select: {
            id: true,
            sessionToken: true,
            expires: true,
            userId: true
          },
          orderBy: {
            expires: 'desc'
          }
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate password age
    const passwordAge = user.passwordUpdatedAt 
      ? Math.floor((Date.now() - user.passwordUpdatedAt.getTime()) / (1000 * 60 * 60 * 24))
      : null

    const securityInfo = {
      twoFactorEnabled: user.twoFactorEnabled || false,
      passwordLastChanged: passwordAge ? `${passwordAge} days ago` : 'Unknown',
      activeSessions: user.sessions?.length || 0,
      sessions: user.sessions?.map(session => ({
        id: session.id,
        device: 'Browser Session',
        location: 'Unknown',
        userAgent: 'Unknown Browser',
        lastActive: session.expires.toISOString(),
        isCurrent: false // We'd need to determine this based on current session
      })) || [],
      securitySettings: (user.securitySettings as any) || {}
    }

    return NextResponse.json({ security: securityInfo })

  } catch (error) {
    console.error('Security settings GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, currentPassword, newPassword, confirmPassword } = body

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        password: true,
        twoFactorEnabled: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    switch (action) {
      case 'change_password':
        // Validate inputs
        if (!currentPassword || !newPassword || !confirmPassword) {
          return NextResponse.json({ 
            error: 'All password fields are required' 
          }, { status: 400 })
        }

        if (newPassword !== confirmPassword) {
          return NextResponse.json({ 
            error: 'New passwords do not match' 
          }, { status: 400 })
        }

        if (newPassword.length < 8) {
          return NextResponse.json({ 
            error: 'Password must be at least 8 characters long' 
          }, { status: 400 })
        }

        // Verify current password
        if (user.password) {
          const isValidPassword = await bcrypt.compare(currentPassword, user.password)
          if (!isValidPassword) {
            return NextResponse.json({ 
              error: 'Current password is incorrect' 
            }, { status: 400 })
          }
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 12)

        // Update password
        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            password: hashedPassword,
            passwordUpdatedAt: new Date(),
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Password changed successfully'
        })

      case 'toggle_2fa':
        // Toggle two-factor authentication
        const newTwoFactorStatus = !user.twoFactorEnabled

        await prisma.user.update({
          where: { id: session.user.id },
          data: {
            twoFactorEnabled: newTwoFactorStatus,
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          message: `Two-factor authentication ${newTwoFactorStatus ? 'enabled' : 'disabled'}`,
          twoFactorEnabled: newTwoFactorStatus
        })

      case 'revoke_session':
        const { sessionId } = body
        if (!sessionId) {
          return NextResponse.json({ 
            error: 'Session ID is required' 
          }, { status: 400 })
        }

        // Delete the specific session
        await prisma.session.deleteMany({
          where: {
            id: sessionId,
            userId: session.user.id
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Session revoked successfully'
        })

      case 'revoke_all_sessions':
        // Delete all sessions except current one
        await prisma.session.deleteMany({
          where: {
            userId: session.user.id,
            // Keep current session - we'd need to identify it properly
            NOT: {
              id: body.currentSessionId || 'current'
            }
          }
        })

        return NextResponse.json({
          success: true,
          message: 'All other sessions revoked successfully'
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Security settings PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}