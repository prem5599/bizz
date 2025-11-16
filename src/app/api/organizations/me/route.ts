// src/app/api/organizations/me/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/organizations/me
 * Get current user's organizations
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('🏢 Fetching organizations for user:', session.user.id)

    // First, ensure the user exists in the database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id }
    })

    if (!user) {
      console.log('👤 User not found in database, creating user record...')
      
      // Create user record if it doesn't exist (this can happen with NextAuth)
      await prisma.user.create({
        data: {
          id: session.user.id,
          email: session.user.email!,
          name: session.user.name,
          image: session.user.image
        }
      })
      
      console.log('✅ User record created successfully')
    }

    // Get user's organization memberships
    const memberships = await prisma.organizationMember.findMany({
      where: {
        userId: session.user.id
      },
      include: {
        organization: {
          include: {
            _count: {
              select: {
                members: true,
                integrations: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // First joined organization first
      }
    })

    // Transform the data
    const organizations = memberships.map(membership => ({
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      subscriptionTier: membership.organization.subscriptionTier,
      role: membership.role,
      joinedAt: membership.createdAt,
      memberCount: membership.organization._count.members,
      integrationCount: membership.organization._count.integrations,
      createdAt: membership.organization.createdAt,
      updatedAt: membership.organization.updatedAt
    }))

    console.log('✅ Found', organizations.length, 'organizations')

    // If user has no organizations, create a default one
    if (organizations.length === 0) {
      console.log('🆕 Creating default organization for user')
      
      try {
        // Generate a unique slug
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
          },
          include: {
            _count: {
              select: {
                members: true,
                integrations: true
              }
            }
          }
        })

        console.log('✅ Default organization created:', defaultOrg.id)

        const newOrganization = {
          id: defaultOrg.id,
          name: defaultOrg.name,
          slug: defaultOrg.slug,
          subscriptionTier: defaultOrg.subscriptionTier,
          role: 'owner',
          joinedAt: defaultOrg.createdAt,
          memberCount: defaultOrg._count.members,
          integrationCount: defaultOrg._count.integrations,
          createdAt: defaultOrg.createdAt,
          updatedAt: defaultOrg.updatedAt
        }

        return NextResponse.json({
          organizations: [newOrganization],
          defaultOrganization: newOrganization,
          totalCount: 1
        })
        
      } catch (createError) {
        console.error('❌ Error creating default organization:', createError)
        
        // If there's still an error, return empty state
        return NextResponse.json({
          organizations: [],
          defaultOrganization: null,
          totalCount: 0,
          message: 'Please create an organization to get started'
        })
      }
    }

    // Return organizations with default (first/primary) organization
    const defaultOrganization = organizations.find(org => org.role === 'owner') || organizations[0]

    return NextResponse.json({
      organizations,
      defaultOrganization,
      totalCount: organizations.length
    })

  } catch (error) {
    console.error('❌ Error fetching user organizations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch organizations' },
      { status: 500 }
    )
  }
}