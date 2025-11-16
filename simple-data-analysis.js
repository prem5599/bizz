// Simple analysis of Shopify data patterns
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function simpleAnalysis() {
  console.log('🔍 SIMPLE SHOPIFY DATA ANALYSIS\n')
  
  try {
    // Get integrations
    const integrations = await prisma.integration.findMany({
      where: { platform: 'shopify' },
      include: { organization: true }
    })

    for (const integration of integrations) {
      console.log(`📊 ${integration.organization.name} (${integration.platformAccountId})`)
      console.log(`   Status: ${integration.status}`)
      console.log(`   Last Sync: ${integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}`)
      
      // Get all data points for this integration
      const allDataPoints = await prisma.dataPoint.findMany({
        where: { integrationId: integration.id },
        orderBy: { dateRecorded: 'desc' }
      })

      console.log(`   Total Data Points: ${allDataPoints.length}`)

      // Group by metric type
      const byMetric = {}
      allDataPoints.forEach(point => {
        if (!byMetric[point.metricType]) {
          byMetric[point.metricType] = []
        }
        byMetric[point.metricType].push(point)
      })

      Object.entries(byMetric).forEach(([metricType, points]) => {
        const total = points.reduce((sum, p) => sum + (p.value || 0), 0)
        const avg = total / points.length
        console.log(`   ${metricType.toUpperCase()}: ${points.length} points, Total: ${total.toFixed(2)}, Avg: ${avg.toFixed(2)}`)
      })

      // Check recent revenue points for data source patterns
      const revenuePoints = byMetric['revenue'] || []
      const recentRevenue = revenuePoints.slice(0, 5)
      
      console.log('\n   Recent Revenue Points:')
      recentRevenue.forEach((point, i) => {
        let source = 'unknown'
        let orderInfo = 'No order info'
        try {
          const metadata = typeof point.metadata === 'string' ? JSON.parse(point.metadata) : point.metadata
          source = metadata.source || 'unknown'
          if (metadata.orderNumber) {
            orderInfo = `Order #${metadata.orderNumber}`
          } else if (metadata.orderId) {
            orderInfo = `Order ID: ${metadata.orderId}`
          }
        } catch (e) {
          // Ignore parsing errors
        }
        console.log(`      ${i + 1}. $${point.value.toFixed(2)} - ${new Date(point.dateRecorded).toLocaleDateString()}`)
        console.log(`         Source: ${source}, ${orderInfo}`)
      })

      // Check for data source distribution
      console.log('\n   Data Source Analysis:')
      const sourceCount = {}
      allDataPoints.forEach(point => {
        let source = 'unknown'
        try {
          const metadata = typeof point.metadata === 'string' ? JSON.parse(point.metadata) : point.metadata
          source = metadata.source || 'unknown'
        } catch (e) {
          // Ignore parsing errors
        }
        sourceCount[source] = (sourceCount[source] || 0) + 1
      })

      Object.entries(sourceCount).forEach(([source, count]) => {
        const percentage = ((count / allDataPoints.length) * 100).toFixed(1)
        console.log(`      ${source}: ${count} points (${percentage}%)`)
      })

      console.log('\n' + '='.repeat(50) + '\n')
    }

    // Summary and issues
    console.log('🎯 KEY FINDINGS:\n')
    
    const testOrg = integrations.find(i => i.organization.name === 'Test Organization')
    const premOrg = integrations.find(i => i.organization.name === 'Premkumar')
    
    if (testOrg) {
      const testData = await prisma.dataPoint.findMany({
        where: { integrationId: testOrg.id },
        take: 1
      })
      
      if (testData.length > 0) {
        let isDemo = false
        try {
          const metadata = typeof testData[0].metadata === 'string' ? JSON.parse(testData[0].metadata) : testData[0].metadata
          isDemo = metadata.source === 'daily_sync' || !testOrg.lastSyncAt
        } catch (e) {
          // Ignore parsing errors
        }
        
        if (isDemo || !testOrg.lastSyncAt) {
          console.log('1. **Test Organization** appears to contain DEMO/GENERATED data:')
          console.log('   - No real sync timestamp')
          console.log('   - Data source shows "daily_sync" (likely scheduled demo data)')
          console.log('   - Missing order details (no order numbers or IDs)')
          console.log('   ❌ This data is NOT from real Shopify orders\n')
        }
      }
    }

    if (premOrg && premOrg.lastSyncAt) {
      console.log('2. **Premkumar Organization** appears to contain REAL Shopify data:')
      console.log(`   - Has sync timestamp: ${new Date(premOrg.lastSyncAt).toLocaleString()}`)
      console.log('   - Likely connected to actual Shopify store')
      console.log('   ✅ This data should match your Shopify admin panel\n')
      
      // Get sample real data
      const realData = await prisma.dataPoint.findMany({
        where: { integrationId: premOrg.id, metricType: 'revenue' },
        orderBy: { dateRecorded: 'desc' },
        take: 3
      })
      
      console.log('   Recent real revenue data:')
      realData.forEach((point, i) => {
        let orderInfo = 'No order info'
        try {
          const metadata = typeof point.metadata === 'string' ? JSON.parse(point.metadata) : point.metadata
          if (metadata.orderNumber) {
            orderInfo = `Order #${metadata.orderNumber}`
          }
        } catch (e) {
          // Ignore parsing errors
        }
        console.log(`      ${i + 1}. $${point.value} - ${new Date(point.dateRecorded).toLocaleDateString()} (${orderInfo})`)
      })
    }

    console.log('\n🔧 TO VERIFY DATA ACCURACY:')
    console.log('1. Focus on the "Premkumar" organization data (real Shopify data)')
    console.log('2. Compare these values with your actual Shopify admin panel')
    console.log('3. Check orders in your Shopify admin for the same dates')
    console.log('4. Verify that only PAID orders are counted as revenue')
    console.log('5. If numbers don\'t match, we need to debug the sync logic')

  } catch (error) {
    console.error('❌ Analysis failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

if (require.main === module) {
  simpleAnalysis()
}

module.exports = { simpleAnalysis }