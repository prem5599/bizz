// src/app/api/test-json/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const response = {
      message: 'JSON test successful',
      timestamp: new Date().toISOString(),
      status: 'ok',
      test: true
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      { error: 'JSON test failed' },
      { status: 500 }
    )
  }
}