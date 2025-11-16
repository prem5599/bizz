// src/app/api/cron/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { 
  generateInsightsJob,
  sendWeeklyDigestJob,
  checkIntegrationHealthJob,
  cleanupOldDataJob
} from '@/lib/cron/scheduler'

export async function POST(req: NextRequest) {
  try {
    // Verify cron API key
    const apiKey = req.headers.get('x-api-key')
    if (!apiKey || apiKey !== process.env.CRON_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const jobType = searchParams.get('job')

    if (!jobType) {
      return NextResponse.json({ error: 'Job type required' }, { status: 400 })
    }

    console.log(`🕐 Running cron job: ${jobType}`)
    const startTime = Date.now()

    switch (jobType) {
      case 'generateInsights':
        await generateInsightsJob()
        break
        
      case 'weeklyDigest':
        await sendWeeklyDigestJob()
        break
        
      case 'integrationHealth':
        await checkIntegrationHealthJob()
        break
        
      case 'dataCleanup':
        await cleanupOldDataJob()
        break
        
      default:
        return NextResponse.json({ error: 'Invalid job type' }, { status: 400 })
    }

    const duration = Date.now() - startTime
    
    return NextResponse.json({
      success: true,
      job: jobType,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Cron job failed:', error)
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

