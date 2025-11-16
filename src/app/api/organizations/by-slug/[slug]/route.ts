// src/app/api/organizations/by-slug/[slug]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { slug } = await params

    // Find organization by slug
    const organization = await prisma.organization.findUnique({
      where: { slug },
      include: {
        members: {
          where: { userId: session.user.id },
          select: {
            role: true,
            joinedAt: true
          }
        },
        _count: {
          select: {
            integrations: true,
            members: true
          }
        }
      }
    })

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    // Check if user is a member of this organization
    if (organization.members.length === 0) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const userMembership = organization.members[0]

    return NextResponse.json({
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: organization.createdAt,
        subscriptionTier: organization.subscriptionTier,
        userRole: userMembership.role,
        memberSince: userMembership.joinedAt,
        stats: {
          totalIntegrations: organization._count.integrations,
          totalMembers: organization._count.members
        }
      }
    })

  } catch (error) {
    console.error('Get organization by slug error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}