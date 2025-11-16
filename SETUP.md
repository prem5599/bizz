# BizInsights Setup Guide

This guide will help you set up and run the BizInsights project with a PostgreSQL database.

## Prerequisites

- Node.js 18.0.0 or later
- npm 9.0.0 or later
- A Neon PostgreSQL database (or any PostgreSQL database)

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment Variables

1. Copy the `.env.example` file to create a `.env` file:

```bash
cp .env.example .env
```

2. Update the `.env` file with your actual values:

#### Required Variables:

**DATABASE_URL**: Your PostgreSQL connection string from Neon or another PostgreSQL provider.

- For Neon: Go to https://neon.tech, create a project, and copy the connection string
- Format: `postgresql://user:password@host:5432/database?sslmode=require`

**NEXTAUTH_SECRET**: A random secret key for NextAuth.js

Generate one using:
```bash
openssl rand -base64 32
```

Or on Windows PowerShell:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**NEXTAUTH_URL**: Your application URL

- For local development: `http://localhost:3000`
- For production: Your actual domain (e.g., `https://yourdomain.com`)

#### Example .env file:

```env
DATABASE_URL="postgresql://username:password@ep-cool-name-123456.us-east-2.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-generated-secret-here"
```

### 3. Generate Prisma Client

Generate the Prisma Client to interact with your database:

```bash
npx prisma generate
```

If you encounter errors downloading Prisma binaries, try:

```bash
# Clear npm cache
npm cache clean --force

# Reinstall Prisma
npm install @prisma/client prisma --force

# Try generating again
npx prisma generate
```

### 4. Set Up the Database

Push your Prisma schema to create the database tables:

```bash
npm run db:push
```

Or use Prisma migrations for version control:

```bash
npm run db:migrate
```

### 5. Run the Development Server

Start the Next.js development server:

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Common Issues and Solutions

### Issue: Prisma Client Not Initialized

**Error**: `@prisma/client did not initialize yet. Please run "prisma generate"`

**Solution**:
```bash
npx prisma generate
```

### Issue: Database Connection Failed

**Error**: `Can't reach database server`

**Solutions**:
1. Verify your `DATABASE_URL` is correct in `.env`
2. Check if your database server is running
3. For Neon, ensure your IP is not restricted in the project settings
4. Test the connection:
```bash
npx prisma db pull
```

### Issue: Prisma Binary Download Fails (403 Forbidden)

**Solution**:
1. Update to a stable Prisma version:
```bash
npm install @prisma/client@latest prisma@latest
```

2. Clear caches and reinstall:
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

3. If behind a proxy, configure npm proxy settings:
```bash
npm config set proxy http://proxy-server:port
npm config set https-proxy http://proxy-server:port
```

### Issue: Module Not Found Errors

**Solution**:
```bash
# Reinstall all dependencies
rm -rf node_modules package-lock.json
npm install
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run tests
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Create and run migrations
- `npm run db:studio` - Open Prisma Studio (database GUI)

## Database Management

### View Your Database

Open Prisma Studio to visually browse and edit your database:

```bash
npm run db:studio
```

### Reset Database

To reset your database (⚠️ This will delete all data):

```bash
npm run db:reset
```

### Create a Migration

When you change the Prisma schema:

```bash
npm run db:migrate
```

## Next Steps

1. Create your first user account
2. Set up your organization
3. Connect integrations (Shopify, Stripe, Google Analytics)
4. Start viewing your business insights!

## Getting Help

If you encounter any issues not covered here, please:

1. Check the [Next.js documentation](https://nextjs.org/docs)
2. Check the [Prisma documentation](https://www.prisma.io/docs)
3. Check the [Neon documentation](https://neon.tech/docs)
4. Open an issue in the project repository
