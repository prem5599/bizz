// src/app/api/user/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's notification preferences
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        notificationSettings: true
      }
    })

    // Default notification settings if none exist
    const defaultSettings = {
      emailNotifications: true,
      pushNotifications: true,
      weeklyReports: true,
      monthlyReports: true,
      alertThresholds: true,
      integrationUpdates: true,
      marketingEmails: false,
      securityAlerts: true
    }

    const notificationSettings = (user?.notificationSettings as any) || defaultSettings

    return NextResponse.json({ notificationSettings })

  } catch (error) {
    console.error('Notification preferences GET error:', error)
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
    const { 
      emailNotifications,
      pushNotifications,
      weeklyReports,
      monthlyReports,
      alertThresholds,
      integrationUpdates,
      marketingEmails,
      securityAlerts
    } = body

    // Validate that all values are booleans
    const settings = {
      emailNotifications,
      pushNotifications,
      weeklyReports,
      monthlyReports,
      alertThresholds,
      integrationUpdates,
      marketingEmails,
      securityAlerts
    }

    for (const [key, value] of Object.entries(settings)) {
      if (value !== undefined && typeof value !== 'boolean') {
        return NextResponse.json({ 
          error: `Invalid value for ${key}. Must be boolean.` 
        }, { status: 400 })
      }
    }

    // Update user notification settings
    const updatedUser = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        notificationSettings: settings,
        updatedAt: new Date()
      },
      select: {
        notificationSettings: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Notification preferences updated successfully',
      notificationSettings: updatedUser.notificationSettings
    })

  } catch (error) {
    console.error('Notification preferences PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}