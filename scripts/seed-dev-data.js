// Simple script to add test data to SQLite database
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function seedData() {
  try {
    console.log('🌱 Seeding development data...')

    // Create a test user
    const user = await prisma.user.upsert({
      where: { email: 'test@example.com' },
      update: {},
      create: {
        email: 'test@example.com',
        name: 'Test User',
        password: 'hashedpassword123' // In real app, this would be hashed
      }
    })
    console.log('✅ Test user created:', user.email)

    // Create a test organization
    const org = await prisma.organization.upsert({
      where: { slug: 'test-org' },
      update: {},
      create: {
        name: 'Test Organization',
        slug: 'test-org',
        subscriptionTier: 'free'
      }
    })
    console.log('✅ Test organization created:', org.name)

    // Create organization membership
    await prisma.organizationMember.upsert({
      where: {
        organizationId_userId: {
          userId: user.id,
          organizationId: org.id
        }
      },
      update: {},
      create: {
        userId: user.id,
        organizationId: org.id,
        role: 'owner'
      }
    })
    console.log('✅ Organization membership created')

    // Create test integration
    const integration = await prisma.integration.create({
      data: {
        organizationId: org.id,
        platform: 'shopify',
        platformAccountId: 'test-shop.myshopify.com',
        status: 'active'
      }
    })
    console.log('✅ Test integration created')

    // Create some sample data points
    const now = new Date()
    const dataPoints = []
    
    for (let i = 0; i < 30; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      
      // Revenue data point
      dataPoints.push({
        integrationId: integration.id,
        metricType: 'revenue',
        value: Math.random() * 1000 + 500, // Random revenue between 500-1500
        dateRecorded: date,
        metadata: JSON.stringify({ source: 'daily_sync' })
      })
      
      // Orders data point
      dataPoints.push({
        integrationId: integration.id,
        metricType: 'orders',
        value: Math.floor(Math.random() * 20) + 5, // Random orders between 5-25
        dateRecorded: date,
        metadata: JSON.stringify({ source: 'daily_sync' })
      })
    }

    await prisma.dataPoint.createMany({
      data: dataPoints
    })
    console.log('✅ Sample data points created:', dataPoints.length)

    console.log('🎉 Development data seeded successfully!')
    console.log('Test credentials:')
    console.log('  Email: test@example.com') 
    console.log('  Organization: test-org')

  } catch (error) {
    console.error('❌ Error seeding data:', error)
  } finally {
    await prisma.$disconnect()
  }
}

seedData()