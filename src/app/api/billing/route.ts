// src/app/api/billing/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's organization billing information
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['owner', 'admin'] } // Only owners/admins can view billing
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            subscriptionTier: true,
            subscriptionStatus: true,
            subscriptionEndsAt: true,
            trialEndsAt: true,
            billingEmail: true,
            billingAddress: true,
            settings: true
          }
        }
      }
    })

    if (!membership?.organization) {
      return NextResponse.json({ 
        error: 'Organization not found or insufficient permissions' 
      }, { status: 403 })
    }

    const org = membership.organization
    
    // Parse settings JSON string
    let parsedSettings: Record<string, any> = {}
    try {
      if (org.settings && typeof org.settings === 'string') {
        parsedSettings = JSON.parse(org.settings)
      }
    } catch (error) {
      console.warn('Failed to parse organization settings:', error)
    }

    // Get usage statistics
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const [integrationCount, dataPointCount, apiCallCount] = await Promise.all([
      prisma.integration.count({
        where: { organizationId: org.id }
      }),
      prisma.dataPoint.count({
        where: {
          integration: {
            organizationId: org.id
          },
          dateRecorded: {
            gte: currentMonth
          }
        }
      }),
      // For API calls, we'll use a mock count for now
      Promise.resolve(3420)
    ])

    // Plan limits based on subscription tier
    const planLimits = {
      free: {
        integrations: 2,
        dataPoints: 10000,
        apiCalls: 50000,
        price: 0,
        features: [
          'Up to 2 integrations',
          'Basic analytics',
          'Email support',
          '10K data points/month',
          '50K API calls/month'
        ],
        restrictions: [
          'Advanced AI insights',
          'Custom reports',
          'Priority support',
          'Advanced integrations'
        ]
      },
      pro: {
        integrations: 10,
        dataPoints: 100000,
        apiCalls: 500000,
        price: 49,
        features: [
          'Up to 10 integrations',
          'Advanced AI insights',
          'Custom reports',
          'Priority support',
          '100K data points/month',
          '500K API calls/month'
        ],
        restrictions: []
      },
      enterprise: {
        integrations: -1, // unlimited
        dataPoints: -1,
        apiCalls: -1,
        price: 199,
        features: [
          'Unlimited integrations',
          'Advanced AI insights',
          'Custom reports',
          'Priority support',
          'White-label options',
          'Custom integrations',
          'Dedicated account manager'
        ],
        restrictions: []
      }
    }

    const currentPlan = planLimits[org.subscriptionTier as keyof typeof planLimits] || planLimits.free

    const billingInfo = {
      currentPlan: {
        name: org.subscriptionTier?.charAt(0).toUpperCase() + org.subscriptionTier?.slice(1) || 'Free',
        tier: org.subscriptionTier || 'free',
        price: currentPlan.price,
        features: currentPlan.features,
        restrictions: currentPlan.restrictions
      },
      subscription: {
        status: org.subscriptionStatus || 'active',
        endsAt: org.subscriptionEndsAt,
        trialEndsAt: org.trialEndsAt,
        isTrialActive: org.trialEndsAt ? org.trialEndsAt > new Date() : false
      },
      billing: {
        email: org.billingEmail || parsedSettings.billingEmail,
        address: org.billingAddress || parsedSettings.billingAddress,
        paymentMethod: parsedSettings.paymentMethod || '**** **** **** 1234',
        billingCycle: parsedSettings.billingCycle || 'monthly'
      },
      usage: {
        integrations: {
          current: integrationCount,
          limit: currentPlan.integrations,
          percentage: currentPlan.integrations === -1 ? 0 : Math.round((integrationCount / currentPlan.integrations) * 100)
        },
        dataPoints: {
          current: dataPointCount,
          limit: currentPlan.dataPoints,
          percentage: currentPlan.dataPoints === -1 ? 0 : Math.round((dataPointCount / currentPlan.dataPoints) * 100)
        },
        apiCalls: {
          current: apiCallCount,
          limit: currentPlan.apiCalls,
          percentage: currentPlan.apiCalls === -1 ? 0 : Math.round((apiCallCount / currentPlan.apiCalls) * 100)
        }
      },
      history: [
        // Mock billing history - in real app, this would come from payment processor
        {
          id: '1',
          date: '2024-01-15',
          description: 'Free Plan',
          amount: 0,
          status: 'paid',
          invoice: null
        }
      ]
    }

    return NextResponse.json({ billing: billingInfo })

  } catch (error) {
    console.error('Billing GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, billingCycle, billingEmail, billingAddress } = body

    // Check if user has admin access to organization
    const membership = await prisma.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        role: { in: ['owner', 'admin'] }
      }
    })

    if (!membership) {
      return NextResponse.json({ 
        error: 'Organization not found or insufficient permissions' 
      }, { status: 403 })
    }

    switch (action) {
      case 'update_billing_info':
        // Update billing information
        const updateData: Record<string, string | Record<string, unknown>> = {}
        
        if (billingCycle) updateData.billingCycle = billingCycle
        if (billingEmail) updateData.billingEmail = billingEmail
        if (billingAddress) updateData.billingAddress = billingAddress

        await prisma.organization.update({
          where: { id: membership.organizationId },
          data: {
            settings: {
              ...updateData
            },
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Billing information updated successfully'
        })

      case 'upgrade_plan':
        // In a real implementation, this would integrate with a payment processor
        return NextResponse.json({
          success: true,
          message: 'Redirecting to payment processor...',
          redirectUrl: '/billing/upgrade'
        })

      case 'cancel_subscription':
        // Cancel subscription
        await prisma.organization.update({
          where: { id: membership.organizationId },
          data: {
            subscriptionStatus: 'cancelled',
            subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            updatedAt: new Date()
          }
        })

        return NextResponse.json({
          success: true,
          message: 'Subscription cancelled. You will retain access until the end of your billing period.'
        })

      case 'delete_account':
        // In a real implementation, this would be a complex process
        // involving data deletion, cancelling subscriptions, etc.
        return NextResponse.json({
          success: true,
          message: 'Account deletion process initiated. You will receive an email with further instructions.'
        })

      default:
        return NextResponse.json({ 
          error: 'Invalid action' 
        }, { status: 400 })
    }

  } catch (error) {
    console.error('Billing PATCH error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}