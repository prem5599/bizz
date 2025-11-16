'use client'

import Link from 'next/link'
import { FileQuestion, Home, Building2 } from 'lucide-react'
import { useParams } from 'next/navigation'

export default function NotFound() {
  const params = useParams()
  const orgSlug = params?.orgSlug as string

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center">
              <Building2 className="w-12 h-12 text-blue-600" />
            </div>
          </div>
          
          <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Organization Not Found</h2>
          <p className="text-gray-600">
            {orgSlug ? (
              <>The organization "<span className="font-medium">{orgSlug}</span>" doesn't exist or you don't have access to it.</>
            ) : (
              "The organization you're looking for doesn't exist."
            )}
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Home className="w-4 h-4 mr-2" />
            Go to Dashboard
          </Link>
          
          <div>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}