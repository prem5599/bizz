# 🗄️ Database Setup Guide

## ✅ What's Already Done

- Neon PostgreSQL database created
- `.env` file configured with connection string
- Prisma schema updated from SQLite to PostgreSQL
- All dependencies installed
- Database setup script created

## 🚀 Quick Setup (2 Steps)

### Step 1: Clone the Repository (if not already on your local machine)

```bash
git clone <your-repo-url>
cd bizz
git checkout claude/check-pushed-changes-01XcNt48iHyH4zah9bDQpYmJ
```

### Step 2: Run the Setup Script

```bash
# Install dependencies (if not already installed)
npm install

# Run the database setup script
node setup-db-pg.js
```

That's it! The script will:
- Connect to your Neon database
- Create all 14 tables (User, Organization, Integration, etc.)
- Create all indexes
- Show you a list of created tables

### Expected Output:

```
🚀 Connecting to Neon database...

✅ Connected to database successfully!

Creating tables...

✓ User table created
✓ Account table created
✓ Session table created
✓ VerificationToken table created
✓ Organization table created
✓ OrganizationMember table created
✓ OrganizationInvitation table created
✓ Integration table created
✓ DataPoint table created
✓ DataPoint indexes created
✓ WebhookEvent table created
✓ WebhookEvent indexes created
✓ Insight table created
✓ Insight indexes created
✓ Report table created
✓ Report indexes created
✓ ScheduledReport table created
✓ ScheduledReport indexes created

✅ Database setup completed successfully!
🎉 All tables and indexes created in Neon PostgreSQL

📊 Created tables:
   - Account
   - DataPoint
   - Insight
   - Integration
   - Organization
   - OrganizationInvitation
   - OrganizationMember
   - Report
   - ScheduledReport
   - Session
   - User
   - VerificationToken
   - WebhookEvent

👋 Connection closed
```

## 🎯 After Setup

Once the tables are created, you can:

### Start Your Development Server:
```bash
npm run dev
```

### Open Your App:
```
http://localhost:3000
```

### View Your Database (Optional):
```bash
# Open Prisma Studio to see your data
npm run db:studio
```

Or login to your Neon dashboard at: https://console.neon.tech

## 📋 Database Tables Created

Your database will have these tables:

1. **User** - User accounts and authentication
2. **Account** - OAuth provider accounts
3. **Session** - User sessions
4. **VerificationToken** - Email verification tokens
5. **Organization** - Organizations/companies
6. **OrganizationMember** - Organization team members
7. **OrganizationInvitation** - Team invitations
8. **Integration** - Connected platforms (Shopify, Stripe, etc.)
9. **DataPoint** - Metrics and analytics data
10. **WebhookEvent** - Webhook events from integrations
11. **Insight** - AI-generated insights
12. **Report** - Generated reports
13. **ScheduledReport** - Scheduled report configurations

## ❓ Troubleshooting

### If you get "connection refused":
- Check your `.env` file has the correct DATABASE_URL
- Make sure you're connected to the internet

### If you get "table already exists":
- That's fine! The script uses `CREATE TABLE IF NOT EXISTS`
- Your tables are already set up

### If you want to start fresh:
```bash
# This will drop all tables and recreate them
# WARNING: This deletes all data!
# Only do this in development
```
Then visit your Neon dashboard and manually drop the tables, or run the setup script again.

## 🎉 Next Steps

After setup is complete:

1. Run your app: `npm run dev`
2. Visit: `http://localhost:3000`
3. Create your first user account
4. Connect your integrations (Shopify, Stripe, Google Analytics)
5. Start tracking your business metrics!

## 💡 Tips

- **Neon Dashboard**: Visit https://console.neon.tech to see your database
- **Connection String**: Already in your `.env` file
- **Free Tier**: 3GB storage, unlimited queries
- **Backups**: Neon automatically backs up your data

---

Need help? Check the README.md or create an issue on GitHub.
