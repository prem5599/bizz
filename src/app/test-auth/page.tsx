// src/app/test-auth/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'

export default function TestAuthPage() {
  const { data: session, status } = useSession()
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [testResults, setTestResults] = useState<any>(null)

  // Only show this page in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') {
      window.location.href = '/dashboard'
    }
  }, [])

  const runDebugCheck = async () => {
    setLoading(true)
    setDebugInfo(null) // Clear previous results
    
    try {
      console.log('🔄 Starting debug check...')
      
      const response = await fetch('/api/debug-auth', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      })
      
      console.log('📊 Response status:', response.status)
      console.log('📊 Response statusText:', response.statusText)
      console.log('📊 Response headers:', Object.fromEntries(response.headers.entries()))
      
      const responseText = await response.text()
      console.log('📄 Raw response length:', responseText.length)
      console.log('📄 Raw response preview:', responseText.substring(0, 500))
      
      if (!response.ok) {
        setDebugInfo({
          error: `HTTP ${response.status}: ${response.statusText}`,
          rawResponse: responseText,
          responseHeaders: Object.fromEntries(response.headers.entries())
        })
        return
      }
      
      // Try to parse JSON
      let data
      try {
        data = JSON.parse(responseText)
      } catch (parseError) {
        console.error('❌ JSON parse error:', parseError)
        setDebugInfo({ 
          error: 'JSON parse failed', 
          rawResponse: responseText,
          parseError: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        })
        return
      }
      
      setDebugInfo(data)
      console.log('✅ Debug check completed successfully')
      
    } catch (networkError) {
      console.error('❌ Network error:', networkError)
      setDebugInfo({ 
        error: 'Network request failed',
        details: networkError instanceof Error ? networkError.message : 'Unknown network error'
      })
    } finally {
      setLoading(false)
    }
  }

  // Test basic JSON endpoint
  const testBasicJson = async () => {
    setLoading(true)
    try {
      console.log('🧪 Testing basic JSON endpoint...')
      const response = await fetch('/api/test-json')
      const data = await response.json()
      setTestResults({
        success: true,
        message: 'Basic JSON test successful',
        data: data
      })
    } catch (error) {
      console.error('❌ Basic JSON test failed:', error)
      setTestResults({
        success: false,
        message: 'Basic JSON test failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    } finally {
      setLoading(false)
    }
  }

  const testCredentials = async (email: string, password: string) => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-credentials',
          email,
          password
        })
      })
      const data = await response.json()
      setTestResults(data)
    } catch (error) {
      console.error('Credentials test failed:', error)
      setTestResults({ error: 'Failed to test credentials' })
    } finally {
      setLoading(false)
    }
  }

  const createTestUser = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create-test-user'
        })
      })
      const data = await response.json()
      setTestResults(data)
    } catch (error) {
      console.error('Test user creation failed:', error)
      setTestResults({ error: 'Failed to create test user' })
    } finally {
      setLoading(false)
    }
  }

  const cleanupTestUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/debug-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cleanup-test-users'
        })
      })
      const data = await response.json()
      setTestResults(data)
    } catch (error) {
      console.error('Cleanup failed:', error)
      setTestResults({ error: 'Failed to cleanup test users' })
    } finally {
      setLoading(false)
    }
  }

  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Not Available</h1>
          <p className="text-gray-600 mt-2">This page is only available in development mode.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">🔧 Authentication Debug Panel</h1>
            <p className="text-sm text-gray-600 mt-1">
              Development-only tool to diagnose authentication issues
            </p>
          </div>

          <div className="p-6 space-y-6">
            {/* Current Session Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h2 className="text-lg font-semibold text-blue-900 mb-3">Current Session</h2>
              <div className="space-y-2">
                <p><strong>Status:</strong> <span className={`px-2 py-1 rounded text-xs ${
                  status === 'authenticated' ? 'bg-green-100 text-green-800' :
                  status === 'loading' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-red-100 text-red-800'
                }`}>{status}</span></p>
                {session && (
                  <>
                    <p><strong>User:</strong> {session.user?.email} ({session.user?.name})</p>
                    <p><strong>User ID:</strong> {session.user?.id}</p>
                    <p><strong>Organizations:</strong> {session.user?.organizations?.length || 0}</p>
                  </>
                )}
              </div>
            </div>

            {/* Debug Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <button
                onClick={testBasicJson}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test Basic JSON'}
              </button>

              <button
                onClick={runDebugCheck}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Running...' : 'Run Debug Check'}
              </button>

              <button
                onClick={createTestUser}
                disabled={loading}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                Create Test User
              </button>

              <button
                onClick={() => testCredentials('test@example.com', 'TestPassword123!')}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50"
              >
                Test Credentials
              </button>

              <button
                onClick={cleanupTestUsers}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                Cleanup Test Data
              </button>
            </div>

            {/* Test Results */}
            {testResults && (
              <div className={`border rounded-lg p-4 ${
                testResults.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
                <h3 className="font-semibold mb-2">Test Results</h3>
                <pre className="text-sm overflow-auto">
                  {JSON.stringify(testResults, null, 2)}
                </pre>
              </div>
            )}

            {/* Debug Information */}
            {debugInfo && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Debug Information</h2>

                {/* Summary */}
                {debugInfo.summary && (
                  <div className={`border rounded-lg p-4 ${
                    debugInfo.summary.overallStatus === 'healthy' 
                      ? 'bg-green-50 border-green-200' 
                      : 'bg-yellow-50 border-yellow-200'
                  }`}>
                    <h3 className="font-semibold mb-2">Summary</h3>
                    <p><strong>Status:</strong> {debugInfo.summary.overallStatus}</p>
                    <p><strong>Errors:</strong> {debugInfo.summary.errorCount}</p>
                    <p><strong>Warnings:</strong> {debugInfo.summary.warningCount}</p>
                    
                    {debugInfo.summary.recommendations && debugInfo.summary.recommendations.length > 0 && (
                      <div className="mt-3">
                        <strong>Recommendations:</strong>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          {debugInfo.summary.recommendations.map((rec: string, idx: number) => (
                            <li key={idx} className="text-sm">{rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Errors */}
                {debugInfo.errors && debugInfo.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold text-red-900 mb-2">Errors</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {debugInfo.errors.map((error: string, idx: number) => (
                        <li key={idx} className="text-sm text-red-800">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Warnings */}
                {debugInfo.warnings && debugInfo.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h3 className="font-semibold text-yellow-900 mb-2">Warnings</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {debugInfo.warnings.map((warning: string, idx: number) => (
                        <li key={idx} className="text-sm text-yellow-800">{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Quick Fixes */}
                {debugInfo.quickFixes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold text-blue-900 mb-2">Quick Fixes</h3>
                    <div className="space-y-3">
                      {debugInfo.quickFixes.map((fix: any, idx: number) => (
                        <div key={idx} className="bg-white rounded p-3 border">
                          <p className="font-medium text-sm">{fix.issue}</p>
                          <code className="block bg-gray-100 p-2 rounded text-xs mt-1 font-mono">
                            {fix.command}
                          </code>
                          <p className="text-xs text-gray-600 mt-1">{fix.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Detailed Checks */}
                <details className="border rounded-lg">
                  <summary className="px-4 py-2 bg-gray-50 cursor-pointer font-medium">
                    Detailed Check Results
                  </summary>
                  <div className="p-4">
                    <pre className="text-xs overflow-auto bg-gray-100 p-3 rounded">
                      {JSON.stringify(debugInfo.checks, null, 2)}
                    </pre>
                  </div>
                </details>
              </div>
            )}

            {/* Quick Actions */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium mb-1">Generate NextAuth Secret:</p>
                  <code className="block bg-white p-2 rounded border font-mono text-xs">
                    openssl rand -base64 32
                  </code>
                </div>
                <div>
                  <p className="font-medium mb-1">Reset Database:</p>
                  <code className="block bg-white p-2 rounded border font-mono text-xs">
                    npm run db:push
                  </code>
                </div>
                <div>
                  <p className="font-medium mb-1">Test Database Connection:</p>
                  <code className="block bg-white p-2 rounded border font-mono text-xs">
                    npm run test:db
                  </code>
                </div>
                <div>
                  <p className="font-medium mb-1">Regenerate Prisma Client:</p>
                  <code className="block bg-white p-2 rounded border font-mono text-xs">
                    npx prisma generate
                  </code>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between items-center pt-4 border-t">
              <a
                href="/auth/signin"
                className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
              >
                Go to Sign In
              </a>
              <a
                href="/dashboard"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}