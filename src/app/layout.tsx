// src/app/layout.tsx
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { CurrencyProvider } from '@/contexts/CurrencyContext'
import { SearchProvider } from '@/contexts/SearchContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BizInsights - Business Analytics Dashboard',
  description: 'Powerful analytics and insights for your business. Connect your integrations and get real-time data.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          <CurrencyProvider>
            <SearchProvider>
              {children}
            </SearchProvider>
          </CurrencyProvider>
        </SessionProvider>
      </body>
    </html>
  )
}