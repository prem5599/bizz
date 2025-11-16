// src/app/api/test-db/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    console.log('🧪 Testing database connection...')
    
    const session = await getServerSession(authOptions)
    console.log('Session:', session ? 'Found' : 'Not found')
    
    if (session?.user?.id) {
      console.log('User ID:', session.user.id)
      console.log('User Email:', session.user.email)
      console.log('User Name:', session.user.name)
    }

    // Test basic database connectivity
    console.log('Testing basic database query...')
    const userCount = await prisma.user.count()
    console.log('Total users in database:', userCount)

    // Test finding current user
    if (session?.user?.id) {
      console.log('Looking for current user in database...')
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: {
          organizations: {
            include: {
              organization: true
            }
          }
        }
      })
      console.log('Current user found:', currentUser ? 'Yes' : 'No')
      console.log('User organizations:', currentUser?.organizations?.length || 0)
    }

    // Test organization creation with minimal data
    if (session?.user?.id) {
      console.log('Testing organization creation...')
      const testSlug = `test-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      
      try {
        const testOrg = await prisma.organization.create({
          data: {
            name: 'Test Organization',
            slug: testSlug,
            subscriptionTier: 'free'
          }
        })
        console.log('Test organization created:', testOrg.id)
        
        // Clean up - delete the test organization
        await prisma.organization.delete({
          where: { id: testOrg.id }
        })
        console.log('Test organization cleaned up')
        
      } catch (createError) {
        console.error('Organization creation test failed:', createError)
        return NextResponse.json({
          success: false,
          error: 'Organization creation failed',
          details: createError instanceof Error ? createError.message : 'Unknown error',
          session: !!session,
          userId: session?.user?.id
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Database connection working',
      userCount,
      hasSession: !!session,
      userId: session?.user?.id,
      userEmail: session?.user?.email
    })

  } catch (error) {
    console.error('Database test failed:', error)
    return NextResponse.json({
      success: false,
      error: 'Database test failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}