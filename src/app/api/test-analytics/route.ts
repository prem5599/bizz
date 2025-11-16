// Test route for debugging analytics issues
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Testing analytics debug route...')

    // Check session
    const session = await getServerSession(authOptions)
    console.log('Session status:', session ? 'authenticated' : 'not authenticated')
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        error: 'Unauthorized',
        step: 'authentication'
      }, { status: 401 })
    }

    // Check database connection
    console.log('Testing database connection...')
    const dbTest = await prisma.$queryRaw`SELECT 1 as test`
    console.log('Database test result:', dbTest)

    // Get organization ID
    const { searchParams } = new URL(req.url)
    const organizationId = searchParams.get('organizationId')
    console.log('Organization ID:', organizationId)

    if (!organizationId) {
      return NextResponse.json({
        error: 'Missing organizationId parameter',
        step: 'parameters'
      }, { status: 400 })
    }

    // Check organization access
    console.log('Checking organization access...')
    const member = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: session.user.id
      }
    })
    console.log('Member found:', !!member)

    if (!member) {
      return NextResponse.json({
        error: 'Access denied to organization',
        step: 'authorization',
        organizationId,
        userId: session.user.id
      }, { status: 403 })
    }

    // Test data queries
    console.log('Testing data queries...')
    const integrationCount = await prisma.integration.count({
      where: { organizationId }
    })
    
    const dataPointCount = await prisma.dataPoint.count({
      where: {
        integration: { organizationId }
      }
    })

    console.log('Integration count:', integrationCount)
    console.log('Data point count:', dataPointCount)

    // Test a simple aggregate
    console.log('Testing aggregate query...')
    const revenueSum = await prisma.dataPoint.aggregate({
      where: {
        integration: { organizationId },
        metricType: 'revenue'
      },
      _sum: { value: true },
      _count: { id: true }
    })
    console.log('Revenue aggregate:', revenueSum)

    return NextResponse.json({
      success: true,
      debug: {
        authenticated: true,
        organizationId,
        userId: session.user.id,
        integrationCount,
        dataPointCount,
        revenueSum: {
          total: Number(revenueSum._sum.value) || 0,
          count: revenueSum._count.id
        }
      }
    })

  } catch (error) {
    console.error('❌ Test analytics error:', error)
    
    return NextResponse.json({
      error: 'Test failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}