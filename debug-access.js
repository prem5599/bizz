// Debug access issue for insights generation
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function debugAccess() {
  try {
    console.log('🔍 Debugging access issue...')
    
    // Get all users
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true }
    })
    
    console.log('👥 Users in database:')
    users.forEach((user, i) => {
      console.log(`  ${i+1}. ${user.name || 'No name'} (${user.email}) - ID: ${user.id}`)
    })
    
    // Get all organizations
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true }
    })
    
    console.log('🏢 Organizations in database:')
    organizations.forEach((org, i) => {
      console.log(`  ${i+1}. ${org.name} - ID: ${org.id}`)
    })
    
    // Get all organization members
    const members = await prisma.organizationMember.findMany({
      include: {
        user: { select: { id: true, email: true, name: true } },
        organization: { select: { id: true, name: true } }
      }
    })
    
    console.log('👤 Organization memberships:')
    members.forEach((member, i) => {
      console.log(`  ${i+1}. ${member.user.name || member.user.email} in ${member.organization.name} (Role: ${member.role})`)
      console.log(`      User ID: ${member.userId}`)
      console.log(`      Org ID: ${member.organizationId}`)
    })
    
    // Get integrations
    const integrations = await prisma.integration.findMany({
      select: { 
        id: true, 
        platform: true, 
        status: true, 
        organizationId: true 
      }
    })
    
    console.log('🔌 Integrations:')
    integrations.forEach((integration, i) => {
      console.log(`  ${i+1}. ${integration.platform} (${integration.status}) - Org: ${integration.organizationId}`)
    })
    
    // Check sessions table if it exists
    try {
      const sessions = await prisma.session.findMany({
        select: { 
          id: true, 
          userId: true, 
          expires: true 
        },
        take: 5,
        orderBy: { expires: 'desc' }
      })
      
      console.log('🔑 Recent sessions:')
      sessions.forEach((session, i) => {
        const isExpired = session.expires < new Date()
        console.log(`  ${i+1}. User: ${session.userId} - Expires: ${session.expires.toISOString()} ${isExpired ? '(EXPIRED)' : '(ACTIVE)'}`)
      })
    } catch (error) {
      console.log('⚠️ Could not fetch sessions (table might not exist)')
    }
    
    console.log('✅ Debug completed!')
    
  } catch (error) {
    console.error('❌ Debug failed:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugAccess()