// src/app/api/organizations/current/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find user's organization memberships
    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionTier: true,
            createdAt: true,
            updatedAt: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // Return the first organization they joined
      }
    })

    if (memberships.length === 0) {
      // Create a default organization for the user
      const timestamp = Date.now()
      const userIdShort = session.user.id.slice(-6)
      const slug = `org-${userIdShort}-${timestamp}`
      
      const defaultOrg = await prisma.organization.create({
        data: {
          name: session.user.name || session.user.email || 'My Organization',
          slug: slug,
          subscriptionTier: 'free',
          members: {
            create: {
              userId: session.user.id,
              role: 'owner'
            }
          }
        }
      })

      return NextResponse.json({
        organization: {
          id: defaultOrg.id,
          name: defaultOrg.name,
          slug: defaultOrg.slug,
          subscriptionTier: defaultOrg.subscriptionTier,
          role: 'owner',
          createdAt: defaultOrg.createdAt,
          updatedAt: defaultOrg.updatedAt
        }
      })
    }

    // Return the first organization
    const membership = memberships[0]
    
    return NextResponse.json({
      organization: {
        id: membership.organization.id,
        name: membership.organization.name,
        slug: membership.organization.slug,
        subscriptionTier: membership.organization.subscriptionTier,
        role: membership.role,
        createdAt: membership.organization.createdAt,
        updatedAt: membership.organization.updatedAt
      }
    })

  } catch (error) {
    console.error('Current organization API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}