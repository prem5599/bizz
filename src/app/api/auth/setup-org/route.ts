// src/app/api/auth/setup-org/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = session.user.id

    // Check if user already has an organization
    const existingMembership = await prisma.organizationMember.findFirst({
      where: { userId },
      include: { organization: true }
    })

    if (existingMembership) {
      return NextResponse.json({ 
        organization: existingMembership.organization,
        membership: existingMembership,
        message: 'User already has organization access'
      })
    }

    // Create a default organization for the user
    const organization = await prisma.organization.create({
      data: {
        name: `${session.user.name || session.user.email}'s Organization`,
        slug: `org-${userId.slice(-8)}`,
        subscriptionTier: 'free'
      }
    })

    // Create organization membership
    const membership = await prisma.organizationMember.create({
      data: {
        organizationId: organization.id,
        userId: userId,
        role: 'owner'
      }
    })

    return NextResponse.json({
      organization,
      membership,
      message: 'Organization created successfully'
    })

  } catch (error) {
    console.error('Setup organization error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}