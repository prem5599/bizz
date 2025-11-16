// src/app/api/health/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const startTime = Date.now()
  
  try {
    // Check database connectivity
    await prisma.$queryRaw`SELECT 1`
    
    // Check environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'NEXTAUTH_SECRET',
      'NEXTAUTH_URL'
    ]
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName])
    
    // Get system info
    const uptime = process.uptime()
    const responseTime = Date.now() - startTime
    
    // Basic health status
    const status = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      responseTime: `${responseTime}ms`,
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      database: 'connected',
      services: {
        database: true,
        auth: !!process.env.NEXTAUTH_SECRET,
        integrations: {
          shopify: !!(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET),
          stripe: !!process.env.STRIPE_WEBHOOK_SECRET,
          googleAnalytics: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
        }
      },
      warnings: missingEnvVars.length > 0 ? [`Missing env vars: ${missingEnvVars.join(', ')}`] : []
    }
    
    const httpStatus = missingEnvVars.length > 0 ? 207 : 200 // 207 Multi-Status for warnings
    
    return NextResponse.json(status, { status: httpStatus })
    
  } catch (error) {
    console.error('Health check failed:', error)
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
      uptime: `${Math.floor(process.uptime() / 3600)}h ${Math.floor((process.uptime() % 3600) / 60)}m`,
      responseTime: `${Date.now() - startTime}ms`
    }, { status: 503 })
  }
}

