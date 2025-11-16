// Analyze current Shopify data in database without requiring API access
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function analyzeShopifyData() {
  console.log('🔍 ANALYZING CURRENT SHOPIFY DATA\n')
  
  try {
    // Get all Shopify integrations
    const integrations = await prisma.integration.findMany({
      where: { platform: 'shopify' },
      include: {
        organization: true,
        _count: { select: { dataPoints: true } }
      }
    })

    for (const integration of integrations) {
      console.log(`📊 Integration: ${integration.organization.name}`)
      console.log(`   Store: ${integration.platformAccountId}`)
      console.log(`   Status: ${integration.status}`)
      console.log(`   Total Data Points: ${integration._count.dataPoints}`)
      console.log(`   Last Sync: ${integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}`)
      console.log('')

      // Analyze data points by metric type
      const metricSummary = await prisma.dataPoint.groupBy({
        by: ['metricType'],
        where: { integrationId: integration.id },
        _count: { metricType: true },
        _sum: { value: true },
        _avg: { value: true },
        _min: { dateRecorded: true },
        _max: { dateRecorded: true }
      })

      console.log('   📈 Metrics Summary:')
      metricSummary.forEach(metric => {
        console.log(`      ${metric.metricType.toUpperCase()}:`)
        console.log(`         Count: ${metric._count.metricType}`)
        console.log(`         Total: ${metric._sum.value?.toFixed(2) || '0'}`)
        console.log(`         Average: ${metric._avg.value?.toFixed(2) || '0'}`)
        console.log(`         Date Range: ${new Date(metric._min.dateRecorded).toLocaleDateString()} - ${new Date(metric._max.dateRecorded).toLocaleDateString()}`)
      })

      // Get recent revenue data points to check for patterns
      const revenueData = await prisma.dataPoint.findMany({
        where: {
          integrationId: integration.id,
          metricType: 'revenue'
        },
        orderBy: { dateRecorded: 'desc' },
        take: 10
      })

      console.log('\n   💰 Recent Revenue Data:')
      revenueData.forEach((point, index) => {
        const metadata = typeof point.metadata === 'string' ? JSON.parse(point.metadata) : point.metadata
        console.log(`      ${index + 1}. $${point.value.toFixed(2)} - ${new Date(point.dateRecorded).toLocaleDateString()}`)
        console.log(`         Order #${metadata.orderNumber || 'N/A'} (ID: ${metadata.orderId || 'N/A'})`)
        console.log(`         Status: ${metadata.financialStatus || 'N/A'}, Source: ${metadata.source || 'N/A'}`)
      })

      // Check for suspicious patterns
      console.log('\n   🚨 Data Quality Analysis:')
      
      // Check for demo data patterns
      const demoDataCount = await prisma.dataPoint.count({
        where: {
          integrationId: integration.id,
          metadata: {
            path: ['source'],
            equals: 'shopify_demo'
          }
        }
      })

      const syncDataCount = await prisma.dataPoint.count({
        where: {
          integrationId: integration.id,
          metadata: {
            path: ['source'],
            equals: 'shopify_sync'
          }
        }
      })

      const webhookDataCount = await prisma.dataPoint.count({
        where: {
          integrationId: integration.id,
          metadata: {
            path: ['source'],
            equals: 'shopify_webhook'
          }
        }
      })

      console.log(`      Demo Data: ${demoDataCount} points`)
      console.log(`      Sync Data: ${syncDataCount} points`)
      console.log(`      Webhook Data: ${webhookDataCount} points`)

      // Check for decimal precision issues (might indicate demo/generated data)
      const precisionCheck = await prisma.dataPoint.findMany({
        where: {
          integrationId: integration.id,
          metricType: 'revenue'
        },
        select: { value: true },
        take: 20
      })

      const highPrecisionCount = precisionCheck.filter(p => {
        const str = p.value.toString()
        return str.includes('.') && str.split('.')[1].length > 4
      }).length

      if (highPrecisionCount > 0) {
        console.log(`      ⚠️  High precision values: ${highPrecisionCount}/20 (may indicate generated data)`)
      }

      // Check order counts vs revenue counts
      const orderCount = await prisma.dataPoint.count({
        where: { integrationId: integration.id, metricType: 'orders' }
      })
      const revenueCount = await prisma.dataPoint.count({
        where: { integrationId: integration.id, metricType: 'revenue' }
      })

      console.log(`      Order data points: ${orderCount}`)
      console.log(`      Revenue data points: ${revenueCount}`)
      
      if (orderCount !== revenueCount && integration.lastSyncAt) {
        console.log(`      ⚠️  Order/Revenue count mismatch (expected for unpaid orders)`)
      }

      console.log('\n' + '='.repeat(60) + '\n')
    }

    // Overall recommendations
    console.log('🎯 RECOMMENDATIONS:\n')
    
    const testOrgIntegration = integrations.find(i => i.organization.name === 'Test Organization')
    if (testOrgIntegration && !testOrgIntegration.lastSyncAt) {
      console.log('1. **Test Organization**: This appears to be demo data')
      console.log('   - No sync timestamp suggests generated/demo data')
      console.log('   - Use for UI testing only\n')
    }

    const realIntegration = integrations.find(i => i.lastSyncAt)
    if (realIntegration) {
      console.log(`2. **${realIntegration.organization.name}**: This appears to be real Shopify data`)
      console.log('   - Has sync timestamp indicating real API connection')
      console.log('   - Use this for data verification\n')
      
      console.log('3. **To verify data accuracy:**')
      console.log('   a. Get your Shopify private app access token')
      console.log('   b. Update verify-shopify-data.js with your token')
      console.log('   c. Run: node verify-shopify-data.js')
      console.log('   d. Compare the results with your Shopify admin panel\n')
    }

    console.log('4. **Common issues to check:**')
    console.log('   - Are unpaid orders being excluded from revenue?')
    console.log('   - Is currency conversion working correctly?')
    console.log('   - Are refunds and cancellations handled properly?')
    console.log('   - Are webhook updates working for real-time sync?')

  } catch (error) {
    console.error('❌ Analysis failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  analyzeShopifyData()
}

module.exports = { analyzeShopifyData }