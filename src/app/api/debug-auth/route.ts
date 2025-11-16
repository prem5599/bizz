// src/app/api/debug-auth/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

/**
 * Debug authentication API (moved from /api/auth/debug to avoid NextAuth conflicts)
 */
export async function GET() {
  // Security check - only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Debug endpoint only available in development mode' },
      { status: 403 }
    )
  }

  try {
    console.log('🔧 Starting authentication debug check...')

    const debugInfo: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      checks: {},
      warnings: [],
      errors: []
    }

    // 1. Environment Variables Check
    console.log('1️⃣ Checking environment variables...')
    debugInfo.checks.environmentVariables = {
      DATABASE_URL: !!process.env.DATABASE_URL,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      NEXTAUTH_URL: !!process.env.NEXTAUTH_URL,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      databaseUrlFormat: process.env.DATABASE_URL?.startsWith('postgresql://') || false,
      nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length || 0
    }

    if (!process.env.DATABASE_URL) {
      debugInfo.errors.push('DATABASE_URL environment variable is missing')
    }
    if (!process.env.NEXTAUTH_SECRET) {
      debugInfo.errors.push('NEXTAUTH_SECRET environment variable is missing')
    }
    if ((process.env.NEXTAUTH_SECRET?.length || 0) < 32) {
      debugInfo.warnings.push('NEXTAUTH_SECRET should be at least 32 characters long')
    }

    // 2. Database Connectivity Check
    console.log('2️⃣ Testing database connectivity...')
    try {
      await prisma.$queryRaw`SELECT 1 as test`
      const userCount = await prisma.user.count()
      
      debugInfo.checks.database = {
        connected: true,
        canQuery: true,
        userTableExists: true,
        userCount: userCount
      }
      console.log('✅ Database connection successful')

    } catch (dbError) {
      debugInfo.checks.database = {
        connected: false,
        error: dbError instanceof Error ? dbError.message : 'Unknown database error'
      }
      debugInfo.errors.push(`Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`)
      console.error('❌ Database connection failed:', dbError)
    }

    // 3. Session Check
    console.log('3️⃣ Checking current session...')
    try {
      const session = await getServerSession(authOptions)
      debugInfo.checks.session = {
        hasSession: !!session,
        user: session?.user ? {
          id: session.user.id,
          email: session.user.email,
          name: session.user.name,
          hasOrganizations: session.user.organizations?.length || 0
        } : null
      }
      console.log('Session check:', !!session ? '✅ Active session found' : '⚠️ No active session')
    } catch (sessionError) {
      debugInfo.checks.session = {
        hasSession: false,
        error: sessionError instanceof Error ? sessionError.message : 'Unknown session error'
      }
      debugInfo.errors.push(`Session check failed: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`)
      console.error('❌ Session check failed:', sessionError)
    }

    // 4. Test Password Hashing
    console.log('4️⃣ Testing password hashing...')
    try {
      const testPassword = 'TestPassword123!'
      const hashedPassword = await bcrypt.hash(testPassword, 12)
      const passwordMatch = await bcrypt.compare(testPassword, hashedPassword)
      
      debugInfo.checks.passwordHashing = {
        canHash: true,
        hashLength: hashedPassword.length,
        startsWithCorrectPrefix: hashedPassword.startsWith('$2'),
        canCompare: true,
        correctPassword: passwordMatch,
        incorrectPassword: !(await bcrypt.compare('wrongpassword', hashedPassword))
      }
      console.log('✅ Password hashing test completed successfully')

    } catch (hashError) {
      debugInfo.checks.passwordHashing = {
        failed: true,
        error: hashError instanceof Error ? hashError.message : 'Unknown hash error'
      }
      debugInfo.errors.push(`Password hashing test failed: ${hashError instanceof Error ? hashError.message : 'Unknown error'}`)
      console.error('❌ Password hashing test failed:', hashError)
    }

    // 5. NextAuth Configuration Check
    console.log('5️⃣ Checking NextAuth configuration...')
    debugInfo.checks.nextAuthConfig = {
      hasCredentialsProvider: authOptions.providers.some(p => p.id === 'credentials'),
      hasGoogleProvider: authOptions.providers.some(p => p.id === 'google'),
      providersCount: authOptions.providers.length,
      hasSignInPage: !!authOptions.pages?.signIn,
      sessionStrategy: authOptions.session?.strategy || 'database',
      hasJwtCallback: !!authOptions.callbacks?.jwt,
      hasSessionCallback: !!authOptions.callbacks?.session
    }

    // 6. Database Schema Check
    console.log('6️⃣ Checking database schema...')
    try {
      const accountCount = await prisma.account.count()
      const sessionCount = await prisma.session.count()
      const organizationCount = await prisma.organization.count()

      debugInfo.checks.databaseSchema = {
        hasUserTable: true,
        hasAccountTable: true,
        hasSessionTable: true,
        hasOrganizationTable: true,
        counts: {
          users: debugInfo.checks.database.userCount || 0,
          accounts: accountCount,
          sessions: sessionCount,
          organizations: organizationCount
        }
      }
      console.log('✅ Database schema check completed')

    } catch (schemaError) {
      debugInfo.checks.databaseSchema = {
        error: schemaError instanceof Error ? schemaError.message : 'Unknown schema error'
      }
      debugInfo.errors.push(`Database schema check failed: ${schemaError instanceof Error ? schemaError.message : 'Unknown error'}`)
      console.error('❌ Database schema check failed:', schemaError)
    }

    // 7. Summary and Recommendations
    debugInfo.summary = {
      overallStatus: debugInfo.errors.length === 0 ? 'healthy' : 'issues_detected',
      errorCount: debugInfo.errors.length,
      warningCount: debugInfo.warnings.length,
      recommendations: []
    }

    if (debugInfo.errors.length === 0) {
      debugInfo.summary.recommendations.push('Authentication system appears to be configured correctly')
    } else {
      debugInfo.summary.recommendations.push('Fix the identified errors to resolve authentication issues')
      
      if (debugInfo.errors.some(e => e.includes('DATABASE_URL'))) {
        debugInfo.summary.recommendations.push('Set up DATABASE_URL environment variable with valid PostgreSQL connection string')
      }
      if (debugInfo.errors.some(e => e.includes('NEXTAUTH_SECRET'))) {
        debugInfo.summary.recommendations.push('Set NEXTAUTH_SECRET to a random string of at least 32 characters')
      }
      if (debugInfo.errors.some(e => e.includes('Database connection'))) {
        debugInfo.summary.recommendations.push('Ensure PostgreSQL database is running and accessible')
      }
    }

    if (debugInfo.warnings.length > 0) {
      debugInfo.summary.recommendations.push('Address warnings to improve security and performance')
    }

    // 8. Quick Fix Commands
    debugInfo.quickFixes = [
      {
        issue: 'Missing NEXTAUTH_SECRET',
        command: 'openssl rand -base64 32',
        description: 'Generate a secure random secret for NextAuth'
      },
      {
        issue: 'Database connection issues',
        command: 'npm run db:push',
        description: 'Push Prisma schema to database'
      },
      {
        issue: 'Missing database tables',
        command: 'npx prisma migrate dev',
        description: 'Run database migrations'
      },
      {
        issue: 'Prisma client out of sync',
        command: 'npx prisma generate',
        description: 'Regenerate Prisma client'
      }
    ]

    console.log('🔧 Authentication debug check completed')
    console.log(`📊 Summary: ${debugInfo.summary.errorCount} errors, ${debugInfo.summary.warningCount} warnings`)

    return NextResponse.json(debugInfo, { 
      status: debugInfo.errors.length === 0 ? 200 : 207,
      headers: {
        'Content-Type': 'application/json'
      }
    })

  } catch (error) {
    console.error('❌ Debug endpoint error:', error)
    return NextResponse.json({
      error: 'Debug check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { 
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
}

/**
 * POST method for testing specific scenarios
 */
export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Debug endpoint only available in development mode' },
      { status: 403 }
    )
  }

  try {
    const body = await req.json()
    const { action, email, password } = body

    switch (action) {
      case 'test-credentials':
        if (!email || !password) {
          return NextResponse.json(
            { error: 'Email and password required for credentials test' },
            { status: 400 }
          )
        }

        console.log('🧪 Testing credentials authentication for:', email)

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
          select: {
            id: true,
            email: true,
            name: true,
            password: true,
            createdAt: true
          }
        })

        if (!user) {
          return NextResponse.json({
            success: false,
            message: 'User not found',
            details: { userExists: false }
          })
        }

        if (!user.password) {
          return NextResponse.json({
            success: false,
            message: 'User has no password set (OAuth only account)',
            details: { 
              userExists: true, 
              hasPassword: false,
              suggestion: 'User may need to sign in with Google or set up a password'
            }
          })
        }

        const isPasswordValid = await bcrypt.compare(password, user.password)

        return NextResponse.json({
          success: isPasswordValid,
          message: isPasswordValid ? 'Credentials are valid' : 'Invalid password',
          details: {
            userExists: true,
            hasPassword: true,
            passwordMatch: isPasswordValid,
            userId: user.id,
            userCreatedAt: user.createdAt
          }
        })

      case 'create-test-user':
        const testEmail = body.email || `test-${Date.now()}@example.com`
        const testPassword = body.password || 'TestPassword123!'
        const testName = body.name || 'Test User'

        console.log('👤 Creating test user:', testEmail)

        const existingUser = await prisma.user.findUnique({
          where: { email: testEmail }
        })

        if (existingUser) {
          return NextResponse.json({
            success: false,
            message: 'User already exists',
            user: {
              id: existingUser.id,
              email: existingUser.email,
              name: existingUser.name
            }
          })
        }

        const hashedPassword = await bcrypt.hash(testPassword, 12)
        const newUser = await prisma.user.create({
          data: {
            email: testEmail,
            name: testName,
            password: hashedPassword
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Test user created successfully',
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            createdAt: newUser.createdAt
          },
          credentials: {
            email: testEmail,
            password: testPassword
          }
        })

      case 'cleanup-test-users':
        console.log('🧹 Cleaning up test users...')

        const deletedUsers = await prisma.user.deleteMany({
          where: {
            email: {
              contains: 'test-'
            }
          }
        })

        return NextResponse.json({
          success: true,
          message: `Cleaned up ${deletedUsers.count} test users`,
          deletedCount: deletedUsers.count
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: test-credentials, create-test-user, cleanup-test-users' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('❌ Debug POST error:', error)
    return NextResponse.json({
      error: 'Debug action failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}