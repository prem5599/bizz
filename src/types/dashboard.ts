// Dashboard specific types
export interface DashboardMetricData {
  current: number
  previous: number
  change: number
  changePercent: number
  trend: 'up' | 'down' | 'neutral'
}

export interface DashboardMetrics {
  revenue: DashboardMetricData
  orders: DashboardMetricData
  sessions: DashboardMetricData
  customers: DashboardMetricData
  conversion: DashboardMetricData
  aov: DashboardMetricData
  [key: string]: DashboardMetricData
}

export interface DashboardIntegration {
  id: string
  platform: string
  status: string
  lastSyncAt: string | null
  platformAccountId?: string
  dataPointsCount?: number
  [key: string]: any
}

export interface DashboardInsight {
  id: string
  type: string
  title: string
  description: string
  impactScore: number
  isRead: boolean
  createdAt: string
  metadata?: Record<string, any>
  [key: string]: any
}

export interface DashboardData {
  metrics: DashboardMetrics
  integrations?: DashboardIntegration[]
  insights?: DashboardInsight[]
  hasRealData?: boolean
  message?: string
  [key: string]: any
}