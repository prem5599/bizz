// src/app/api/upload/logo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has admin access to organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!membership) {
      return NextResponse.json({ 
        error: 'Organization not found or insufficient permissions' 
      }, { status: 403 })
    }

    const data = await request.formData()
    const file: File | null = data.get('logo') as unknown as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' 
      }, { status: 400 })
    }

    // Validate file size (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ 
        error: 'File size too large. Maximum size is 2MB.' 
      }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Create unique filename
    const timestamp = Date.now()
    const extension = file.name.split('.').pop()
    const filename = `logo-${membership.organizationId}-${timestamp}.${extension}`
    
    // Save file to public uploads directory
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos')
    const filepath = join(uploadDir, filename)
    
    try {
      await writeFile(filepath, buffer)
    } catch (error) {
      console.error('File write error:', error)
      return NextResponse.json({ 
        error: 'Failed to save file' 
      }, { status: 500 })
    }

    // Update organization with logo URL
    const logoUrl = `/uploads/logos/${filename}`
    
    const updatedOrganization = await prisma.organization.update({
      where: { id: membership.organizationId },
      data: {
        logo: logoUrl,
        updatedAt: new Date()
      },
      select: {
        id: true,
        logo: true,
        updatedAt: true
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Logo uploaded successfully',
      logoUrl: logoUrl,
      organization: updatedOrganization
    })

  } catch (error) {
    console.error('Logo upload error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}