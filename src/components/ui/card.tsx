// src/components/ui/card.tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Card component variants using class-variance-authority
 * Provides consistent styling across different card types and sizes
 */
const cardVariants = cva(
  "rounded-lg border bg-card text-card-foreground shadow-sm",
  {
    variants: {
      variant: {
        default: "border-border bg-white",
        outlined: "border-2 border-slate-200 bg-white",
        elevated: "border-border bg-white shadow-lg",
        ghost: "border-transparent bg-transparent shadow-none",
        gradient: "border-border bg-gradient-to-br from-white to-slate-50",
      },
      size: {
        default: "",
        sm: "text-sm",
        lg: "text-lg",
        xl: "text-xl",
      },
      padding: {
        none: "p-0",
        sm: "p-4",
        default: "p-6",
        lg: "p-8",
        xl: "p-10",
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      padding: "default",
    },
  }
)

/**
 * Base Card Component Props
 */
export interface CardProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {
  asChild?: boolean
  hoverable?: boolean
  clickable?: boolean
}

/**
 * Base Card Component
 * 
 * The foundation component for creating card-based layouts.
 * Provides consistent styling and behavior across the application.
 * 
 * @example
 * ```tsx
 * <Card>
 *   <CardHeader>
 *     <CardTitle>Card Title</CardTitle>
 *     <CardDescription>Card description</CardDescription>
 *   </CardHeader>
 *   <CardContent>
 *     Card content goes here
 *   </CardContent>
 * </Card>
 * ```
 */
const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ 
    className, 
    variant, 
    size, 
    padding,
    hoverable = false,
    clickable = false,
    ...props 
  }, ref) => (
    <div
      ref={ref}
      className={cn(
        cardVariants({ variant, size, padding }),
        hoverable && "transition-all duration-200 hover:shadow-md hover:-translate-y-0.5",
        clickable && "cursor-pointer transition-all duration-200 hover:shadow-md active:scale-[0.98]",
        className
      )}
      {...props}
    />
  )
)
Card.displayName = "Card"

/**
 * Card Header Component Props
 */
export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  divider?: boolean
}

/**
 * Card Header Component
 * 
 * Container for card title, description, and header actions.
 * Typically used at the top of a card.
 */
const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className, divider = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col space-y-1.5 p-6",
        divider && "border-b border-slate-200 pb-4",
        className
      )}
      {...props}
    />
  )
)
CardHeader.displayName = "CardHeader"

/**
 * Card Title Component
 * 
 * Primary heading for the card content.
 */
const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn(
      "text-2xl font-semibold leading-none tracking-tight text-slate-900",
      className
    )}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

/**
 * Card Description Component
 * 
 * Secondary text that provides additional context for the card.
 */
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-sm text-slate-600 leading-relaxed", className)}
    {...props}
  />
))
CardDescription.displayName = "CardDescription"

/**
 * Card Content Component Props
 */
export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  noPadding?: boolean
}

/**
 * Card Content Component
 * 
 * Main content area of the card.
 */
const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(
  ({ className, noPadding = false, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        noPadding ? "p-0" : "p-6 pt-0",
        className
      )}
      {...props}
    />
  )
)
CardContent.displayName = "CardContent"

/**
 * Card Footer Component Props
 */
export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  divider?: boolean
  justify?: 'start' | 'center' | 'end' | 'between' | 'around'
}

/**
 * Card Footer Component
 * 
 * Footer area for actions, additional information, or navigation.
 */
const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className, divider = false, justify = 'start', ...props }, ref) => {
    const justifyClasses = {
      start: 'justify-start',
      center: 'justify-center', 
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around'
    }

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center p-6 pt-0",
          justifyClasses[justify],
          divider && "border-t border-slate-200 pt-4",
          className
        )}
        {...props}
      />
    )
  }
)
CardFooter.displayName = "CardFooter"

/**
 * Metric Card Component
 * 
 * Specialized card for displaying key metrics and KPIs.
 */
export interface MetricCardProps extends Omit<CardProps, 'children'> {
  title: string
  value: string | number
  change?: {
    value: number
    type: 'positive' | 'negative' | 'neutral'
  }
  icon?: React.ReactNode
  description?: string
  trend?: React.ReactNode
}

const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(
  ({ 
    title, 
    value, 
    change, 
    icon, 
    description, 
    trend,
    className,
    ...props 
  }, ref) => {
    const changeColors = {
      positive: 'text-green-600 bg-green-50',
      negative: 'text-red-600 bg-red-50',
      neutral: 'text-slate-600 bg-slate-50'
    }

    return (
      <Card
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        hoverable
        {...props}
      >
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                {icon && (
                  <div className="text-slate-500">
                    {icon}
                  </div>
                )}
                <p className="text-sm font-medium text-slate-600">{title}</p>
              </div>
              
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-bold text-slate-900">
                  {typeof value === 'number' ? value.toLocaleString() : value}
                </p>
                
                {change && (
                  <span className={cn(
                    "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                    changeColors[change.type]
                  )}>
                    {change.type === 'positive' && '+'}
                    {change.value}%
                  </span>
                )}
              </div>
              
              {description && (
                <p className="text-sm text-slate-500 mt-1">{description}</p>
              )}
            </div>
            
            {trend && (
              <div className="ml-4 flex-shrink-0">
                {trend}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
)
MetricCard.displayName = "MetricCard"

/**
 * Dashboard Card Component
 * 
 * Pre-configured card for dashboard layouts with common patterns.
 */
export interface DashboardCardProps extends CardProps {
  title?: string
  description?: string
  action?: React.ReactNode
  loading?: boolean
  error?: string
  empty?: boolean
  emptyMessage?: string
}

const DashboardCard = React.forwardRef<HTMLDivElement, DashboardCardProps>(
  ({ 
    title,
    description,
    action,
    loading = false,
    error,
    empty = false,
    emptyMessage = "No data available",
    children,
    className,
    ...props 
  }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn("relative", className)}
        {...props}
      >
        {(title || description || action) && (
          <CardHeader divider={!!children}>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                {title && <CardTitle className="text-lg">{title}</CardTitle>}
                {description && <CardDescription>{description}</CardDescription>}
              </div>
              {action && (
                <div className="flex-shrink-0">
                  {action}
                </div>
              )}
            </div>
          </CardHeader>
        )}

        <CardContent noPadding={!title && !description && !action}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                <span className="text-sm text-slate-500">Loading...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-red-500 mb-2">
                  <svg className="h-8 w-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-sm text-slate-600">{error}</p>
              </div>
            </div>
          ) : empty ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <div className="text-slate-400 mb-2">
                  <svg className="h-8 w-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m13-8l-7 7-7-7" />
                  </svg>
                </div>
                <p className="text-sm text-slate-500">{emptyMessage}</p>
              </div>
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
    )
  }
)
DashboardCard.displayName = "DashboardCard"

/**
 * Stats Card Component
 * 
 * Specialized card for displaying statistics with optional charts.
 */
export interface StatsCardProps extends Omit<CardProps, 'children'> {
  label: string
  value: string | number
  previousValue?: string | number
  format?: (value: string | number) => string
  chart?: React.ReactNode
  status?: 'positive' | 'negative' | 'neutral'
  subtitle?: string
}

const StatsCard = React.forwardRef<HTMLDivElement, StatsCardProps>(
  ({ 
    label,
    value,
    previousValue,
    format,
    chart,
    status = 'neutral',
    subtitle,
    className,
    ...props 
  }, ref) => {
    const formattedValue = format ? format(value) : value
    const formattedPreviousValue = format && previousValue ? format(previousValue) : previousValue

    const calculateChange = () => {
      if (!previousValue || previousValue === 0) return null
      const current = typeof value === 'string' ? parseFloat(value) : value
      const previous = typeof previousValue === 'string' ? parseFloat(previousValue) : previousValue
      return ((current - previous) / previous * 100).toFixed(1)
    }

    const change = calculateChange()

    return (
      <Card
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        hoverable
        {...props}
      >
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-600 uppercase tracking-wide">
                {label}
              </p>
              {status !== 'neutral' && (
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  status === 'positive' ? 'bg-green-500' : 'bg-red-500'
                )} />
              )}
            </div>

            <div className="space-y-1">
              <p className="text-3xl font-bold text-slate-900">
                {formattedValue}
              </p>
              
              {subtitle && (
                <p className="text-sm text-slate-500">{subtitle}</p>
              )}

              {change && (
                <p className="text-sm">
                  <span className={cn(
                    "font-medium",
                    parseFloat(change) >= 0 ? 'text-green-600' : 'text-red-600'
                  )}>
                    {parseFloat(change) >= 0 ? '+' : ''}{change}%
                  </span>
                  <span className="text-slate-500 ml-1">
                    vs {formattedPreviousValue}
                  </span>
                </p>
              )}
            </div>

            {chart && (
              <div className="mt-4">
                {chart}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }
)
StatsCard.displayName = "StatsCard"

// Export all components
export { 
  Card, 
  CardHeader, 
  CardFooter, 
  CardTitle, 
  CardDescription, 
  CardContent,
  MetricCard,
  DashboardCard,
  StatsCard,
  cardVariants
}

// Export types
export type { VariantProps }