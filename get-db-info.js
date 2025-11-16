// Get database information for Shopify verification
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function getDatabaseInfo() {
  console.log('📊 Getting Database Information...\n')
  
  try {
    // Get organizations
    const organizations = await prisma.organization.findMany({
      include: {
        members: {
          include: {
            user: true
          }
        }
      }
    })

    console.log('🏢 Organizations:')
    organizations.forEach((org, index) => {
      console.log(`   ${index + 1}. ${org.name} (ID: ${org.id})`)
      console.log(`      Slug: ${org.slug}`)
      console.log(`      Members: ${org.members.length}`)
      org.members.forEach(member => {
        console.log(`        - ${member.user.email} (${member.role})`)
      })
    })

    // Get integrations
    const integrations = await prisma.integration.findMany({
      include: {
        organization: true,
        _count: {
          select: { dataPoints: true }
        }
      }
    })

    console.log('\n🔗 Integrations:')
    if (integrations.length === 0) {
      console.log('   No integrations found')
    } else {
      integrations.forEach((integration, index) => {
        console.log(`   ${index + 1}. ${integration.platform.toUpperCase()}`)
        console.log(`      Organization: ${integration.organization.name}`)
        console.log(`      Platform Account: ${integration.platformAccountId}`)
        console.log(`      Status: ${integration.status}`)
        console.log(`      Data Points: ${integration._count.dataPoints}`)
        console.log(`      Last Sync: ${integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}`)
        console.log(`      Integration ID: ${integration.id}`)
        console.log(`      Organization ID: ${integration.organizationId}`)
      })
    }

    // Get recent data points for context
    const recentDataPoints = await prisma.dataPoint.findMany({
      take: 10,
      orderBy: { dateRecorded: 'desc' },
      include: {
        integration: {
          include: {
            organization: true
          }
        }
      }
    })

    console.log('\n📈 Recent Data Points:')
    if (recentDataPoints.length === 0) {
      console.log('   No data points found')
    } else {
      recentDataPoints.forEach((point, index) => {
        const metadata = typeof point.metadata === 'string' ? JSON.parse(point.metadata) : point.metadata
        console.log(`   ${index + 1}. ${point.metricType.toUpperCase()}`)
        console.log(`      Value: ${point.value}`)
        console.log(`      Date: ${new Date(point.dateRecorded).toLocaleString()}`)
        console.log(`      Platform: ${point.integration.platform}`)
        console.log(`      Organization: ${point.integration.organization.name}`)
        if (metadata.orderNumber) {
          console.log(`      Order #: ${metadata.orderNumber}`)
        }
      })
    }

    // Show configuration template
    console.log('\n📋 Configuration Template for verify-shopify-data.js:')
    const shopifyIntegration = integrations.find(i => i.platform === 'shopify')
    if (shopifyIntegration) {
      console.log('\nconst SHOPIFY_CONFIG = {')
      console.log(`  shopDomain: '${shopifyIntegration.platformAccountId}', // Your Shopify store domain`)
      console.log(`  accessToken: 'shpat_your_access_token_here', // Update with your actual token`)
      console.log(`  organizationId: '${shopifyIntegration.organizationId}' // ${shopifyIntegration.organization.name}`)
      console.log('}')
    } else {
      console.log('\n⚠️  No Shopify integration found in database')
      if (organizations.length > 0) {
        console.log('\nTo create a Shopify integration, use:')
        console.log('const SHOPIFY_CONFIG = {')
        console.log(`  shopDomain: 'your-store-name',`)
        console.log(`  accessToken: 'shpat_your_access_token_here',`)
        console.log(`  organizationId: '${organizations[0].id}' // ${organizations[0].name}`)
        console.log('}')
      }
    }

    return { organizations, integrations, shopifyIntegration }

  } catch (error) {
    console.error('❌ Database error:', error.message)
    return null
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  getDatabaseInfo()
}

module.exports = { getDatabaseInfo }