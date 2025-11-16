// Demo Shopify integration for testing without real credentials
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    console.log('🎭 Demo Shopify integration initiated')
    
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { organizationId, storeName } = await request.json()
    
    if (!organizationId || !storeName) {
      return NextResponse.json(
        { error: 'Organization ID and store name are required' },
        { status: 400 }
      )
    }

    // Verify user has access to the organization
    const userMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: organizationId,
        userId: session.user.id
      },
      include: {
        organization: true
      }
    })

    if (!userMembership) {
      return NextResponse.json(
        { error: 'Organization not found or access denied' },
        { status: 404 }
      )
    }

    // Clean store name
    const cleanStoreName = storeName.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    
    // Check if demo integration already exists
    const existingIntegration = await prisma.integration.findFirst({
      where: {
        organizationId: organizationId,
        platform: 'shopify',
        platformAccountId: `demo-${cleanStoreName}`
      }
    })

    if (existingIntegration) {
      return NextResponse.json(
        { error: 'Demo Shopify integration already exists for this store' },
        { status: 409 }
      )
    }

    // Create demo integration
    const integration = await prisma.integration.create({
      data: {
        organizationId: organizationId,
        platform: 'shopify',
        platformAccountId: `demo-${cleanStoreName}`,
        accessToken: 'demo_token_' + Math.random().toString(36).substr(2, 9),
        status: 'active',
        lastSyncAt: new Date(),
        metadata: {
          type: 'demo',
          storeName: cleanStoreName,
          shopInfo: {
            name: `${cleanStoreName} Demo Store`,
            domain: `${cleanStoreName}.myshopify.com`,
            email: `admin@${cleanStoreName}.com`,
            planName: 'Basic Shopify',
            currency: 'USD',
            country: 'United States'
          },
          connectedAt: new Date().toISOString(),
          isDemo: true
        }
      }
    })

    // Create demo data points
    await createDemoDataPoints(integration.id)

    console.log('✅ Demo integration created:', integration.id)

    return NextResponse.json({
      success: true,
      integration: {
        id: integration.id,
        platform: 'shopify',
        platformAccountId: `demo-${cleanStoreName}`,
        status: 'active',
        lastSyncAt: integration.lastSyncAt,
        createdAt: integration.createdAt,
        metadata: integration.metadata
      },
      message: 'Demo Shopify store connected successfully'
    })

  } catch (error) {
    console.error('Demo Shopify integration error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function createDemoDataPoints(integrationId: string) {
  const now = new Date()
  const dataPoints = []

  // Create 30 days of demo data
  for (let i = 0; i < 30; i++) {
    const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000))
    
    // Random daily revenue between $100-$2000
    const dailyRevenue = Math.floor(Math.random() * 1900) + 100
    
    // Random daily orders between 1-15
    const dailyOrders = Math.floor(Math.random() * 15) + 1
    
    // Random daily customers between 1-10
    const dailyCustomers = Math.floor(Math.random() * 10) + 1
    
    // Revenue data point
    dataPoints.push({
      integrationId,
      metricType: 'revenue',
      value: dailyRevenue,
      metadata: {
        source: 'demo',
        currency: 'USD',
        ordersCount: dailyOrders
      },
      dateRecorded: date
    })
    
    // Orders data point
    dataPoints.push({
      integrationId,
      metricType: 'orders',
      value: dailyOrders,
      metadata: {
        source: 'demo',
        averageOrderValue: dailyRevenue / dailyOrders
      },
      dateRecorded: date
    })
    
    // Customers data point
    dataPoints.push({
      integrationId,
      metricType: 'customer_created',
      value: dailyCustomers,
      metadata: {
        source: 'demo'
      },
      dateRecorded: date
    })
  }

  // Add some products
  for (let i = 0; i < 10; i++) {
    dataPoints.push({
      integrationId,
      metricType: 'product_created',
      value: 1,
      metadata: {
        source: 'demo',
        productName: `Demo Product ${i + 1}`,
        productId: `demo_product_${i + 1}`
      },
      dateRecorded: new Date(now.getTime() - (Math.random() * 30 * 24 * 60 * 60 * 1000))
    })
  }

  // Batch create all data points
  await prisma.dataPoint.createMany({ data: dataPoints })
  
  console.log(`✅ Created ${dataPoints.length} demo data points`)
}