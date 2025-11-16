// Setup Neon Database using pg client
require('dotenv').config();
const { Client } = require('pg');

async function setupDatabase() {
  // Parse the DATABASE_URL
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    console.error('❌ DATABASE_URL not found in environment variables');
    process.exit(1);
  }

  console.log('🚀 Connecting to Neon database...\n');

  const client = new Client({
    connectionString: connectionString,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('✅ Connected to database successfully!\n');
    console.log('Creating tables...\n');

    // User table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT PRIMARY KEY,
        "email" TEXT UNIQUE NOT NULL,
        "name" TEXT,
        "image" TEXT,
        "password" TEXT,
        "phone" TEXT,
        "timezone" TEXT,
        "twoFactorEnabled" BOOLEAN DEFAULT false NOT NULL,
        "passwordUpdatedAt" TIMESTAMP,
        "notificationSettings" TEXT DEFAULT '{}' NOT NULL,
        "securitySettings" TEXT DEFAULT '{}' NOT NULL,
        "preferences" TEXT DEFAULT '{}' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('✓ User table created');

    // Account table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Account" (
        "id" TEXT PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "provider" TEXT NOT NULL,
        "providerAccountId" TEXT NOT NULL,
        "refresh_token" TEXT,
        "access_token" TEXT,
        "expires_at" INTEGER,
        "token_type" TEXT,
        "scope" TEXT,
        "id_token" TEXT,
        "session_state" TEXT,
        CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
        UNIQUE("provider", "providerAccountId")
      );
    `);
    console.log('✓ Account table created');

    // Session table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Session" (
        "id" TEXT PRIMARY KEY,
        "sessionToken" TEXT UNIQUE NOT NULL,
        "userId" TEXT NOT NULL,
        "expires" TIMESTAMP NOT NULL,
        CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
      );
    `);
    console.log('✓ Session table created');

    // VerificationToken table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "VerificationToken" (
        "identifier" TEXT NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "expires" TIMESTAMP NOT NULL,
        UNIQUE("identifier", "token")
      );
    `);
    console.log('✓ VerificationToken table created');

    // Organization table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Organization" (
        "id" TEXT PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT UNIQUE NOT NULL,
        "email" TEXT,
        "website" TEXT,
        "phone" TEXT,
        "address" TEXT,
        "timezone" TEXT DEFAULT 'UTC' NOT NULL,
        "logo" TEXT,
        "industry" TEXT DEFAULT 'Other' NOT NULL,
        "companySize" TEXT DEFAULT '1-10' NOT NULL,
        "currency" TEXT DEFAULT 'USD' NOT NULL,
        "subscriptionTier" TEXT DEFAULT 'free' NOT NULL,
        "subscriptionStatus" TEXT DEFAULT 'active' NOT NULL,
        "subscriptionEndsAt" TIMESTAMP,
        "trialEndsAt" TIMESTAMP,
        "billingEmail" TEXT,
        "billingAddress" TEXT,
        "settings" TEXT DEFAULT '{}' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      );
    `);
    console.log('✓ Organization table created');

    // OrganizationMember table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "OrganizationMember" (
        "id" TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "role" TEXT DEFAULT 'member' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
        CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
        UNIQUE("organizationId", "userId")
      );
    `);
    console.log('✓ OrganizationMember table created');

    // OrganizationInvitation table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "OrganizationInvitation" (
        "id" TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "email" TEXT NOT NULL,
        "role" TEXT NOT NULL,
        "invitedBy" TEXT NOT NULL,
        "token" TEXT UNIQUE NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "acceptedAt" TIMESTAMP,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "OrganizationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
        UNIQUE("organizationId", "email")
      );
    `);
    console.log('✓ OrganizationInvitation table created');

    // Integration table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Integration" (
        "id" TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "platform" TEXT NOT NULL,
        "platformAccountId" TEXT,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "tokenExpiresAt" TIMESTAMP,
        "status" TEXT DEFAULT 'active' NOT NULL,
        "lastSyncAt" TIMESTAMP,
        "metadata" TEXT DEFAULT '{}' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "Integration_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE,
        UNIQUE("organizationId", "platform")
      );
    `);
    console.log('✓ Integration table created');

    // DataPoint table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "DataPoint" (
        "id" TEXT PRIMARY KEY,
        "integrationId" TEXT NOT NULL,
        "metricType" TEXT NOT NULL,
        "value" DOUBLE PRECISION NOT NULL,
        "metadata" TEXT DEFAULT '{}' NOT NULL,
        "dateRecorded" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "DataPoint_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE
      );
    `);
    console.log('✓ DataPoint table created');

    // Create index for DataPoint
    await client.query(`
      CREATE INDEX IF NOT EXISTS "DataPoint_integrationId_metricType_dateRecorded_idx"
      ON "DataPoint"("integrationId", "metricType", "dateRecorded");
    `);
    console.log('✓ DataPoint indexes created');

    // WebhookEvent table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "WebhookEvent" (
        "id" TEXT PRIMARY KEY,
        "integrationId" TEXT NOT NULL,
        "topic" TEXT NOT NULL,
        "status" TEXT NOT NULL,
        "externalId" TEXT,
        "error" TEXT,
        "receivedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "processedAt" TIMESTAMP,
        "metadata" TEXT DEFAULT '{}' NOT NULL,
        CONSTRAINT "WebhookEvent_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE CASCADE
      );
    `);
    console.log('✓ WebhookEvent table created');

    // Create indexes for WebhookEvent
    await client.query(`
      CREATE INDEX IF NOT EXISTS "WebhookEvent_integrationId_topic_receivedAt_idx"
      ON "WebhookEvent"("integrationId", "topic", "receivedAt");
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "WebhookEvent_integrationId_status_idx"
      ON "WebhookEvent"("integrationId", "status");
    `);
    console.log('✓ WebhookEvent indexes created');

    // Insight table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Insight" (
        "id" TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "description" TEXT NOT NULL,
        "impactScore" INTEGER NOT NULL,
        "isRead" BOOLEAN DEFAULT false NOT NULL,
        "metadata" TEXT DEFAULT '{}' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "Insight_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );
    `);
    console.log('✓ Insight table created');

    // Create index for Insight
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Insight_organizationId_createdAt_idx"
      ON "Insight"("organizationId", "createdAt");
    `);
    console.log('✓ Insight indexes created');

    // Report table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Report" (
        "id" TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "reportType" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "content" TEXT NOT NULL,
        "dateRangeStart" TIMESTAMP NOT NULL,
        "dateRangeEnd" TIMESTAMP NOT NULL,
        "generatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "emailedAt" TIMESTAMP,
        CONSTRAINT "Report_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );
    `);
    console.log('✓ Report table created');

    // Create index for Report
    await client.query(`
      CREATE INDEX IF NOT EXISTS "Report_organizationId_reportType_generatedAt_idx"
      ON "Report"("organizationId", "reportType", "generatedAt");
    `);
    console.log('✓ Report indexes created');

    // ScheduledReport table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "ScheduledReport" (
        "id" TEXT PRIMARY KEY,
        "organizationId" TEXT NOT NULL,
        "reportType" TEXT NOT NULL,
        "title" TEXT NOT NULL,
        "isActive" BOOLEAN DEFAULT true NOT NULL,
        "schedule" TEXT NOT NULL,
        "recipients" TEXT NOT NULL,
        "lastRunAt" TIMESTAMP,
        "nextRunAt" TIMESTAMP,
        "settings" TEXT DEFAULT '{}' NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "ScheduledReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE
      );
    `);
    console.log('✓ ScheduledReport table created');

    // Create index for ScheduledReport
    await client.query(`
      CREATE INDEX IF NOT EXISTS "ScheduledReport_organizationId_isActive_nextRunAt_idx"
      ON "ScheduledReport"("organizationId", "isActive", "nextRunAt");
    `);
    console.log('✓ ScheduledReport indexes created');

    console.log('\n✅ Database setup completed successfully!');
    console.log('🎉 All tables and indexes created in Neon PostgreSQL\n');

    // Test query
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('📊 Created tables:');
    result.rows.forEach(row => console.log(`   - ${row.table_name}`));
    console.log('');

  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
    console.log('👋 Connection closed');
  }
}

setupDatabase();
