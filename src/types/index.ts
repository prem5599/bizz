// types/index.ts
export interface User {
  id: string
  email: string
  name?: string
  image?: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  subscriptionTier: 'free' | 'pro' | 'business' | 'enterprise'
  members: OrganizationMember[]
  integrations: Integration[]
}

export interface OrganizationMember {
  id: string
  userId: string
  organizationId: string
  role: 'owner' | 'admin' | 'member' | 'viewer'
  user: User
}

export interface Integration {
  id: string
  organizationId: string
  platform: string
  status: 'active' | 'error' | 'pending'
  lastSyncAt?: Date
  createdAt: Date
}

export interface MetricData {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
}

export interface ChartDataPoint {
  date: string
  value: number
  label?: string
}

export interface Insight {
  id: string
  type: 'trend' | 'anomaly' | 'recommendation'
  title: string
  description: string
  impactScore: number
  isRead: boolean
  createdAt: string
  metadata?: Record<string, any>
}

export interface DashboardIntegration {
  id: string
  platform: string
  status: string
  lastSyncAt: string | null
  platformAccountId?: string
  dataPointsCount?: number
}

export interface DashboardInsight {
  id: string
  type: string
  title: string
  description: string
  impactScore: number
  isRead: boolean
  createdAt: string
  metadata: Record<string, any>
}

export interface MetricsData {
  revenue: MetricData
  orders: MetricData
  sessions: MetricData
  customers: MetricData
  conversion: MetricData
  conversionRate: MetricData
  aov: MetricData
  averageOrderValue: MetricData
}

export interface DashboardData {
  metrics: MetricsData
  charts: {
    revenue_trend: ChartDataPoint[]
    traffic_sources: { source: string; sessions: number }[]
  }
  insights: DashboardInsight[]
  integrations: DashboardIntegration[]
  hasRealData: boolean
  message: string
}