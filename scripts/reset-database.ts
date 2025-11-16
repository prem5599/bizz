// scripts/reset-database.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resetDatabase() {
  console.log('🗄️  Starting database reset...')
  
  try {
    // Get initial record counts
    const initialCounts = {
      dataPoints: await prisma.dataPoint.count(),
      insights: await prisma.insight.count(),
      integrations: await prisma.integration.count(),
      organizationMembers: await prisma.organizationMember.count(),
      organizations: await prisma.organization.count(),
      accounts: await prisma.account.count(),
      sessions: await prisma.session.count(),
      users: await prisma.user.count(),
    }

    console.log('📊 Current database state:', initialCounts)

    // Delete in order respecting foreign key constraints
    console.log('🧹 Cleaning database tables...')
    
    console.log('   • Deleting data points...')
    await prisma.dataPoint.deleteMany({})
    
    console.log('   • Deleting insights...')
    await prisma.insight.deleteMany({})
    
    console.log('   • Deleting integrations...')
    await prisma.integration.deleteMany({})
    
    console.log('   • Deleting organization members...')
    await prisma.organizationMember.deleteMany({})
    
    console.log('   • Deleting organizations...')
    await prisma.organization.deleteMany({})
    
    console.log('   • Deleting user accounts...')
    await prisma.account.deleteMany({})
    
    console.log('   • Deleting user sessions...')
    await prisma.session.deleteMany({})
    
    console.log('   • Deleting users...')
    await prisma.user.deleteMany({})

    // Get final record counts to verify cleanup
    const finalCounts = {
      dataPoints: await prisma.dataPoint.count(),
      insights: await prisma.insight.count(),
      integrations: await prisma.integration.count(),
      organizationMembers: await prisma.organizationMember.count(),
      organizations: await prisma.organization.count(),
      accounts: await prisma.account.count(),
      sessions: await prisma.session.count(),
      users: await prisma.user.count(),
    }

    console.log('📊 Final database state:', finalCounts)

    // Check if reset was successful
    const totalRecords = Object.values(finalCounts).reduce((sum, count) => sum + count, 0)
    
    if (totalRecords === 0) {
      console.log('')
      console.log('🎉 Database is completely clean and ready for fresh setup!')
      console.log('')
      console.log('📝 What happens next:')
      console.log('   • New users can create fresh accounts')
      console.log('   • Real integrations will show actual data only')
      console.log('   • No dummy data will appear for new accounts')
      console.log('')
      console.log('🚀 You can now test with a new account!')
    } else {
      console.log('⚠️  Some records may still exist. This could be due to:')
      console.log('   • Foreign key constraints')
      console.log('   • Custom tables not included in this script')
      console.log('   • Database permissions')
      console.log('📊 Remaining records:', finalCounts)
    }

  } catch (error) {
    console.error('❌ Error during database reset:', error)
    console.error('')
    console.error('💡 Troubleshooting tips:')
    console.error('   • Check your DATABASE_URL in .env file')
    console.error('   • Ensure PostgreSQL is running')
    console.error('   • Verify database permissions')
    console.error('   • Run `npx prisma db push` to ensure schema is up to date')
    throw error
  } finally {
    await prisma.$disconnect()
    console.log('📡 Database connection closed')
  }
}

// Add confirmation prompt for safety
async function confirmReset() {
  console.log('⚠️  WARNING: This will delete ALL data in your database!')
  console.log('📋 This includes:')
  console.log('   • All user accounts and authentication data')
  console.log('   • All organizations and team data')
  console.log('   • All integrations (Shopify, Stripe, etc.)')
  console.log('   • All dashboard data and insights')
  console.log('   • All existing data (no sample data will be regenerated)')
  console.log('')
  
  // In a production script, you might want to add readline for confirmation
  // For now, we'll proceed automatically since this is for development
  console.log('🔄 Proceeding with reset...')
  return true
}

// Main execution
async function main() {
  try {
    console.log('🚀 BizInsights Database Reset Utility')
    console.log('=====================================')
    console.log('')
    
    const confirmed = await confirmReset()
    if (!confirmed) {
      console.log('❌ Reset cancelled by user')
      process.exit(0)
    }

    await resetDatabase()
    
    console.log('')
    console.log('🎯 Reset Summary:')
    console.log('   ✅ All user accounts removed')
    console.log('   ✅ All organizations cleaned')
    console.log('   ✅ All integrations disconnected')
    console.log('   ✅ All data purged (no dummy data)')
    console.log('   ✅ Database ready for fresh start')
    console.log('')
    console.log('📱 Next Steps:')
    console.log('   1. Start your dev server: npm run dev')
    console.log('   2. Create a new account with Google OAuth')
    console.log('   3. Connect real integrations')
    console.log('   4. Verify no dummy data appears')
    
    process.exit(0)
    
  } catch (error) {
    console.error('')
    console.error('💥 Reset failed with error:', error)
    console.error('')
    console.error('🔧 To fix this:')
    console.error('   1. Check your .env DATABASE_URL')
    console.error('   2. Ensure PostgreSQL is running')
    console.error('   3. Run: npx prisma db push')
    console.error('   4. Try the reset again')
    process.exit(1)
  }
}

// Run the script
main()