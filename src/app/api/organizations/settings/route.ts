// src/app/api/organizations/settings/route.ts
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

    // Get user's organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            website: true,
            phone: true,
            address: true,
            timezone: true,
            logo: true,
            industry: true,
            companySize: true,
            currency: true,
            subscriptionTier: true,
            settings: true,
            createdAt: true,
            updatedAt: true
          }
        }
      }
    })

    if (!membership?.organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
    }

    return NextResponse.json({
      organization: membership.organization,
      userRole: membership.role
    })

  } catch (error) {
    console.error('Organization settings GET error:', error)
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
      name, 
      email, 
      website, 
      phone, 
      address, 
      timezone, 
      logo, 
      industry, 
      companySize,
      currency
    } = body

    // Check if user has admin access to organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      },
      include: {
        organization: true
      }
    })

    if (!membership) {
      return NextResponse.json({ 
        error: 'Organization not found or insufficient permissions' 
      }, { status: 403 })
    }

    // Validate inputs
    if (name && (typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ error: 'Invalid organization name' }, { status: 400 })
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    if (website && !/^https?:\/\/.+/.test(website)) {
      return NextResponse.json({ error: 'Invalid website URL' }, { status: 400 })
    }

    // Prepare update data
    const updateData: Record<string, any> = {}
    if (name !== undefined) updateData.name = name.trim()
    if (email !== undefined) updateData.email = email
    if (website !== undefined) updateData.website = website
    if (phone !== undefined) updateData.phone = phone
    if (address !== undefined) updateData.address = address
    if (timezone !== undefined) updateData.timezone = timezone
    if (logo !== undefined) updateData.logo = logo
    if (industry !== undefined) updateData.industry = industry
    if (companySize !== undefined) updateData.companySize = companySize
    if (currency !== undefined) updateData.currency = currency

    // Update organization
    const updatedOrganization = await prisma.organization.update({
      where: { id: membership.organizationId },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      select: {
        id: true,
        name: true,
        email: true,
        website: true,
        phone: true,
        address: true,
        timezone: true,
        logo: true,
        industry: true,
        companySize: true,
        currency: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Organization settings updated successfully',
      organization: updatedOrganization
    })

  } catch (error) {
    console.error('Organization settings PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}