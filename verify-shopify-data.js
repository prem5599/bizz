// Shopify Data Verification Script
// This script helps verify that the data from Shopify matches what's stored in your database

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Configuration - Update these with your actual Shopify credentials
const SHOPIFY_CONFIG = {
  shopDomain: 'bizinsights-test-store', // e.g., 'mystore' (without .myshopify.com)
  accessToken: 'shpat_your_access_token_here', // Your private app access token
  organizationId: 'cmdbiv9j90000khqs8rn9j76f' // Premkumar organization
}

// Shopify API helper
class ShopifyAPI {
  constructor(accessToken, shopDomain) {
    this.accessToken = accessToken
    this.shopDomain = shopDomain.replace('.myshopify.com', '')
    this.baseUrl = `https://${this.shopDomain}.myshopify.com/admin/api/2023-10`
  }

  async makeRequest(endpoint) {
    const url = `${this.baseUrl}/${endpoint}`
    const response = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getOrders(params = {}) {
    const searchParams = new URLSearchParams({
      limit: '250',
      status: 'any',
      ...params
    })
    
    const data = await this.makeRequest(`orders.json?${searchParams.toString()}`)
    return data.orders || []
  }

  async getOrdersInDateRange(startDate, endDate) {
    const params = {
      created_at_min: startDate.toISOString(),
      created_at_max: endDate.toISOString(),
      status: 'any'
    }
    return this.getOrders(params)
  }

  async getShopInfo() {
    const data = await this.makeRequest('shop.json')
    return data.shop
  }
}

// Data verification functions
async function verifyConfiguration() {
  console.log('🔧 Verifying Configuration...\n')
  
  // Check if configuration is provided
  if (!SHOPIFY_CONFIG.shopDomain || SHOPIFY_CONFIG.shopDomain === 'your-shop-name') {
    console.log('❌ Please update SHOPIFY_CONFIG.shopDomain in the script')
    return false
  }

  if (!SHOPIFY_CONFIG.accessToken || SHOPIFY_CONFIG.accessToken === 'shpat_your_access_token_here') {
    console.log('❌ Please update SHOPIFY_CONFIG.accessToken in the script')
    return false
  }

  if (!SHOPIFY_CONFIG.organizationId || SHOPIFY_CONFIG.organizationId === 'your-organization-id') {
    console.log('❌ Please update SHOPIFY_CONFIG.organizationId in the script')
    return false
  }

  console.log('✅ Configuration provided')
  return true
}

async function testShopifyConnection() {
  console.log('🔗 Testing Shopify Connection...\n')
  
  try {
    const shopifyAPI = new ShopifyAPI(SHOPIFY_CONFIG.accessToken, SHOPIFY_CONFIG.shopDomain)
    const shopInfo = await shopifyAPI.getShopInfo()
    
    console.log('✅ Connected to Shopify successfully')
    console.log(`   Shop Name: ${shopInfo.name}`)
    console.log(`   Shop Domain: ${shopInfo.domain}`)
    console.log(`   Currency: ${shopInfo.currency}`)
    console.log(`   Country: ${shopInfo.country_name}`)
    console.log(`   Created: ${new Date(shopInfo.created_at).toLocaleDateString()}`)
    
    return shopifyAPI
  } catch (error) {
    console.log('❌ Failed to connect to Shopify:', error.message)
    console.log('\n🔍 Troubleshooting:')
    console.log('   1. Verify your shop domain is correct')
    console.log('   2. Ensure your access token starts with "shpat_"')
    console.log('   3. Check that the private app is installed and active')
    console.log('   4. Confirm the API scopes include read_orders, read_customers, read_products')
    return null
  }
}

async function checkDatabaseIntegration() {
  console.log('\n📊 Checking Database Integration...\n')
  
  try {
    // Find integration in database
    const integration = await prisma.integration.findFirst({
      where: {
        organizationId: SHOPIFY_CONFIG.organizationId,
        platform: 'shopify'
      },
      include: {
        _count: {
          select: { dataPoints: true }
        }
      }
    })

    if (!integration) {
      console.log('❌ No Shopify integration found in database')
      console.log('   Please connect your Shopify store first')
      return null
    }

    console.log('✅ Database integration found')
    console.log(`   Integration ID: ${integration.id}`)
    console.log(`   Platform Account: ${integration.platformAccountId}`)
    console.log(`   Status: ${integration.status}`)
    console.log(`   Last Sync: ${integration.lastSyncAt ? new Date(integration.lastSyncAt).toLocaleString() : 'Never'}`)
    console.log(`   Total Data Points: ${integration._count.dataPoints}`)

    return integration
  } catch (error) {
    console.log('❌ Database error:', error.message)
    return null
  }
}

async function compareOrderData(shopifyAPI, integration) {
  console.log('\n🔄 Comparing Order Data...\n')

  // Get last 30 days of data
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - 30)

  try {
    // Get orders from Shopify
    console.log('📡 Fetching orders from Shopify...')
    const shopifyOrders = await shopifyAPI.getOrdersInDateRange(startDate, endDate)
    console.log(`   Found ${shopifyOrders.length} orders in last 30 days`)

    // Calculate Shopify metrics
    const paidOrders = shopifyOrders.filter(order => 
      order.financial_status === 'paid' || order.financial_status === 'partially_paid'
    )
    
    const shopifyMetrics = {
      totalOrders: shopifyOrders.length,
      paidOrders: paidOrders.length,
      totalRevenue: paidOrders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0),
      averageOrderValue: paidOrders.length > 0 ? 
        paidOrders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0) / paidOrders.length : 0
    }

    console.log('\n📊 Shopify Metrics (Last 30 days):')
    console.log(`   Total Orders: ${shopifyMetrics.totalOrders}`)
    console.log(`   Paid Orders: ${shopifyMetrics.paidOrders}`)
    console.log(`   Total Revenue: $${shopifyMetrics.totalRevenue.toFixed(2)}`)
    console.log(`   Average Order Value: $${shopifyMetrics.averageOrderValue.toFixed(2)}`)

    // Get data from your database
    console.log('\n💾 Fetching data from database...')
    const dbOrderCount = await prisma.dataPoint.count({
      where: {
        integrationId: integration.id,
        metricType: 'orders',
        dateRecorded: { gte: startDate, lte: endDate }
      }
    })

    const dbRevenueData = await prisma.dataPoint.findMany({
      where: {
        integrationId: integration.id,
        metricType: 'revenue',
        dateRecorded: { gte: startDate, lte: endDate }
      }
    })

    const dbRevenue = dbRevenueData.reduce((sum, point) => sum + (point.value || 0), 0)

    console.log('\n💾 Database Metrics (Last 30 days):')
    console.log(`   Order Count Data Points: ${dbOrderCount}`)
    console.log(`   Revenue Data Points: ${dbRevenueData.length}`)
    console.log(`   Total Revenue: $${dbRevenue.toFixed(2)}`)

    // Compare the data
    console.log('\n🔍 Data Comparison:')
    
    const orderCountMatch = dbOrderCount === shopifyMetrics.paidOrders
    const revenueMatch = Math.abs(dbRevenue - shopifyMetrics.totalRevenue) < 0.01
    
    console.log(`   Orders Match: ${orderCountMatch ? '✅' : '❌'} (DB: ${dbOrderCount}, Shopify: ${shopifyMetrics.paidOrders})`)
    console.log(`   Revenue Match: ${revenueMatch ? '✅' : '❌'} (DB: $${dbRevenue.toFixed(2)}, Shopify: $${shopifyMetrics.totalRevenue.toFixed(2)})`)

    if (!orderCountMatch || !revenueMatch) {
      console.log('\n⚠️ Data mismatch detected!')
      console.log('\n🔍 Possible reasons:')
      console.log('   1. Initial sync may not have completed properly')
      console.log('   2. Some orders might have been filtered out (e.g., unpaid orders)')
      console.log('   3. Webhook events might have been missed')
      console.log('   4. Currency conversion issues')
      console.log('   5. Date range differences in sync vs comparison')
      
      // Show detailed order breakdown
      console.log('\n📋 Detailed Shopify Order Breakdown:')
      const ordersByStatus = {}
      shopifyOrders.forEach(order => {
        const status = order.financial_status
        if (!ordersByStatus[status]) ordersByStatus[status] = []
        ordersByStatus[status].push(order)
      })
      
      Object.entries(ordersByStatus).forEach(([status, orders]) => {
        const revenue = orders.reduce((sum, order) => sum + parseFloat(order.total_price || '0'), 0)
        console.log(`   ${status}: ${orders.length} orders, $${revenue.toFixed(2)}`)
      })
    } else {
      console.log('\n✅ Data matches perfectly!')
    }

    return { shopifyMetrics, dbMetrics: { orderCount: dbOrderCount, revenue: dbRevenue } }

  } catch (error) {
    console.log('❌ Error comparing order data:', error.message)
    return null
  }
}

async function showRecentOrders(shopifyAPI, integration, limit = 10) {
  console.log(`\n📝 Recent Orders (Last ${limit})...\n`)

  try {
    const orders = await shopifyAPI.getOrders({ limit: limit.toString() })
    
    console.log('Shopify Orders:')
    orders.forEach((order, index) => {
      console.log(`   ${index + 1}. Order #${order.number}`)
      console.log(`      - Amount: $${order.total_price} (${order.currency})`)
      console.log(`      - Status: ${order.financial_status}`)
      console.log(`      - Date: ${new Date(order.created_at).toLocaleDateString()}`)
      console.log(`      - Customer: ${order.customer?.email || order.email || 'No email'}`)
    })

    // Show corresponding database entries
    console.log('\nDatabase Entries (Recent):')
    const recentDbData = await prisma.dataPoint.findMany({
      where: {
        integrationId: integration.id,
        OR: [
          { metricType: 'orders' },
          { metricType: 'revenue' }
        ]
      },
      orderBy: { dateRecorded: 'desc' },
      take: limit
    })

    recentDbData.forEach((dataPoint, index) => {
      const metadata = typeof dataPoint.metadata === 'string' ? 
        JSON.parse(dataPoint.metadata) : dataPoint.metadata
      
      console.log(`   ${index + 1}. ${dataPoint.metricType.toUpperCase()}`)
      console.log(`      - Value: ${dataPoint.metricType === 'revenue' ? '$' : ''}${dataPoint.value}`)
      console.log(`      - Date: ${new Date(dataPoint.dateRecorded).toLocaleDateString()}`)
      console.log(`      - Order #: ${metadata.orderNumber || 'N/A'}`)
    })

  } catch (error) {
    console.log('❌ Error showing recent orders:', error.message)
  }
}

async function suggestFixes() {
  console.log('\n🔧 Suggested Fixes:\n')
  
  console.log('1. **Re-sync Data:**')
  console.log('   Run: node scripts/resync-shopify.js')
  console.log('   Or trigger sync via API: POST /api/integrations/shopify/sync')
  
  console.log('\n2. **Check Webhook Configuration:**')
  console.log('   - Verify webhooks are set up in your Shopify app')
  console.log('   - Check webhook URLs are accessible')
  console.log('   - Review webhook logs in Shopify admin')
  
  console.log('\n3. **Verify Data Processing Logic:**')
  console.log('   - Check that financial_status filtering is correct')
  console.log('   - Ensure currency conversion is working')
  console.log('   - Verify date handling and timezone issues')
  
  console.log('\n4. **Manual Data Check:**')
  console.log('   - Compare specific orders between Shopify and database')
  console.log('   - Check for duplicate entries')
  console.log('   - Verify data point creation logic')
}

// Main verification function
async function verifyShopifyData() {
  console.log('🔍 SHOPIFY DATA VERIFICATION\n')
  console.log('This script will compare your Shopify data with what\'s stored in your database.\n')
  
  try {
    // Step 1: Verify configuration
    const configValid = await verifyConfiguration()
    if (!configValid) {
      console.log('\n❌ Configuration incomplete. Please update the script with your details.')
      return
    }

    // Step 2: Test Shopify connection
    const shopifyAPI = await testShopifyConnection()
    if (!shopifyAPI) return

    // Step 3: Check database integration
    const integration = await checkDatabaseIntegration()
    if (!integration) return

    // Step 4: Compare order data
    const comparison = await compareOrderData(shopifyAPI, integration)
    
    // Step 5: Show recent orders for manual verification
    await showRecentOrders(shopifyAPI, integration, 5)
    
    // Step 6: Suggest fixes if needed
    if (comparison && 
        (comparison.shopifyMetrics.totalRevenue !== comparison.dbMetrics.revenue ||
         comparison.shopifyMetrics.paidOrders !== comparison.dbMetrics.orderCount)) {
      await suggestFixes()
    }

    console.log('\n✅ Verification completed!')
    console.log('\nNext steps:')
    console.log('1. If data matches - everything is working correctly!')
    console.log('2. If data doesn\'t match - follow the suggested fixes above')
    console.log('3. Check the console logs for detailed error messages')
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

// Instructions for users
function showInstructions() {
  console.log('📋 BEFORE RUNNING THIS SCRIPT:\n')
  console.log('1. Update SHOPIFY_CONFIG at the top of this file:')
  console.log('   - shopDomain: Your store name (e.g., "mystore")')
  console.log('   - accessToken: Your private app access token (starts with "shpat_")')
  console.log('   - organizationId: Get this from your database or admin panel')
  console.log('')
  console.log('2. Ensure your Shopify private app has these scopes:')
  console.log('   - read_orders')
  console.log('   - read_customers')
  console.log('   - read_products')
  console.log('   - read_analytics')
  console.log('')
  console.log('3. Make sure your database is accessible and contains the integration')
  console.log('')
  console.log('4. Run: node verify-shopify-data.js')
  console.log('')
}

// Check if this is being run directly
if (require.main === module) {
  // Check if configuration looks updated
  if (SHOPIFY_CONFIG.shopDomain === 'your-shop-name' || 
      SHOPIFY_CONFIG.accessToken === 'shpat_your_access_token_here' ||
      SHOPIFY_CONFIG.organizationId === 'your-organization-id') {
    showInstructions()
  } else {
    verifyShopifyData()
  }
}

module.exports = { verifyShopifyData, ShopifyAPI }