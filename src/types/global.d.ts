// src/types/global.d.ts

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // Database
      DATABASE_URL: string
      
      // NextAuth
      NEXTAUTH_SECRET: string
      NEXTAUTH_URL: string
      
      // OAuth Providers
      GOOGLE_CLIENT_ID: string
      GOOGLE_CLIENT_SECRET: string
      
      // App Configuration
      APP_URL: string
      NODE_ENV: 'development' | 'production' | 'test'
      
      // Optional Services
      SHOPIFY_CLIENT_ID?: string
      SHOPIFY_CLIENT_SECRET?: string
      SHOPIFY_WEBHOOK_SECRET?: string
      STRIPE_WEBHOOK_SECRET?: string
      GOOGLE_ANALYTICS_ID?: string
      RESEND_API_KEY?: string
      SENTRY_DSN?: string
    }
  }
}

// Extend NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      organizations?: {
        id: string
        name: string
        slug: string
        role: string
        subscriptionTier: string
        joinedAt: Date
      }[]
      currentOrganization?: {
        id: string
        name: string
        slug: string
        role: string
        subscriptionTier: string
        joinedAt: Date
      } | null
    }
  }

  interface User {
    id: string
    email: string
    name?: string | null
    image?: string | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}

// React types
declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number
  }
}

export {}