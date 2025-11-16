// src/app/api/integrations/[integrationId]/scopes/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ShopifyScopeManager } from '@/lib/integrations/shopify-scopes'

export const dynamic = 'force-dynamic'

/**
 * GET /api/integrations/[integrationId]/scopes
 * Get current scope configuration for an integration
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { integrationId } = await params
    console.log('📋 Fetching scopes for integration:', integrationId)

    // Get integration and verify ownership
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          memberships: {
            some: {
              userId: session.user.id
            }
          }
        }
      },
      include: {
        organization: true
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found' },
        { status: 404 }
      )
    }

    // Only support Shopify integrations for now
    if (integration.platform !== 'shopify') {
      return NextResponse.json(
        { error: 'Scope management only supported for Shopify integrations' },
        { status: 400 }
      )
    }

    console.log('✅ Integration found:', integration.platform, integration.platformAccountId)

    // Get current scopes from metadata
    const currentScopes = integration.metadata?.grantedScopes as string[] || []
    
    // Validate current scopes
    const validation = ShopifyScopeManager.validateScopes(currentScopes)
    const dataUsage = ShopifyScopeManager.estimateDataUsage(currentScopes)

    // Get scope details
    const scopeDetails = currentScopes.map(scopeId => {
      const scope = ShopifyScopeManager.getScopeById(scopeId)
      return scope ? {
        id: scope.id,
        name: scope.name,
        description: scope.description,
        category: scope.category,
        required: scope.required,
        riskLevel: scope.riskLevel,
        dataAccess: scope.dataAccess
      } : null
    }).filter(Boolean)

    // Get integration method
    const integrationMethod = integration.metadata?.integrationMethod || 'unknown'

    const response = {
      integration: {
        id: integration.id,
        platform: integration.platform,
        platformAccountId: integration.platformAccountId,
        method: integrationMethod
      },
      scopes: {
        current: currentScopes,
        details: scopeDetails,
        count: currentScopes.length
      },
      validation: {
        valid: validation.valid,
        missing: validation.missing,
        invalid: validation.invalid
      },
      dataUsage: {
        level: dataUsage.level,
        typesCount: dataUsage.details.length,
        types: dataUsage.details
      },
      lastUpdated: integration.updatedAt
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error fetching integration scopes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scopes' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/integrations/[integrationId]/scopes
 * Update scope configuration for an integration (requires reconnection)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { integrationId } = await params
    const body = await request.json()
    const { scopes, forceUpdate = false } = body

    console.log('🔄 Updating scopes for integration:', integrationId, {
      newScopeCount: scopes?.length || 0,
      forceUpdate
    })

    // Validate input
    if (!scopes || !Array.isArray(scopes)) {
      return NextResponse.json(
        { error: 'Scopes array is required' },
        { status: 400 }
      )
    }

    // Get integration and verify ownership
    const integration = await prisma.integration.findFirst({
      where: {
        id: integrationId,
        organization: {
          memberships: {
            some: {
              userId: session.user.id,
              role: { in: ['owner', 'admin'] } // Only admins can modify scopes
            }
          }
        }
      },
      include: {
        organization: true
      }
    })

    if (!integration) {
      return NextResponse.json(
        { error: 'Integration not found or insufficient permissions' },
        { status: 404 }
      )
    }

    // Only support Shopify integrations
    if (integration.platform !== 'shopify') {
      return NextResponse.json(
        { error: 'Scope management only supported for Shopify integrations' },
        { status: 400 }
      )
    }

    // Validate the new scopes
    const validation = ShopifyScopeManager.validateScopes(scopes)
    if (!validation.valid) {
      return NextResponse.json(
        { 
          error: 'Invalid scope configuration',
          details: {
            missing: validation.missing,
            invalid: validation.invalid
          }
        },
        { status: 400 }
      )
    }

    // Resolve dependencies
    const resolvedScopes = ShopifyScopeManager.getResolveDependencies(scopes)
    
    // Get current scopes for comparison
    const currentScopes = integration.metadata?.grantedScopes as string[] || []
    const scopesChanged = !arraysEqual(currentScopes.sort(), resolvedScopes.sort())

    console.log('📊 Scope comparison:', {
      current: currentScopes.length,
      new: resolvedScopes.length,
      changed: scopesChanged
    })

    if (!scopesChanged && !forceUpdate) {
      return NextResponse.json(
        { 
          message: 'No scope changes detected',
          scopes: {
            current: currentScopes,
            requested: resolvedScopes,
            changed: false
          }
        }
      )
    }

    // Calculate what changed
    const addedScopes = resolvedScopes.filter(scope => !currentScopes.includes(scope))
    const removedScopes = currentScopes.filter(scope => !resolvedScopes.includes(scope))
    const dataUsage = ShopifyScopeManager.estimateDataUsage(resolvedScopes)

    // For scope changes, we need to mark integration for reconnection
    // The actual scope update will happen during reconnection process
    const updateData = {
      metadata: {
        ...integration.metadata,
        grantedScopes: resolvedScopes,
        scopeUpdatePending: scopesChanged,
        scopeChangeRequest: scopesChanged ? {
          requestedAt: new Date().toISOString(),
          requestedBy: session.user.id,
          changes: {
            added: addedScopes,
            removed: removedScopes
          }
        } : undefined
      },
      updatedAt: new Date()
    }

    // If scopes changed significantly, mark integration as needing reconnection
    if (scopesChanged && (addedScopes.length > 0 || removedScopes.some(scope => {
      const scopeObj = ShopifyScopeManager.getScopeById(scope)
      return scopeObj?.riskLevel === 'high'
    }))) {
      updateData.metadata.requiresReconnection = true
      updateData.metadata.reconnectionReason = 'scope_update'
    }

    // Update the integration
    const updatedIntegration = await prisma.integration.update({
      where: { id: integrationId },
      data: updateData
    })

    console.log('✅ Scopes updated successfully')

    // Log the scope change for audit trail
    await logScopeChange(integrationId, session.user.id, {
      action: 'update_scopes',
      previousScopes: currentScopes,
      newScopes: resolvedScopes,
      changes: { added: addedScopes, removed: removedScopes }
    })

    const response = {
      success: true,
      message: scopesChanged 
        ? 'Scopes updated successfully. Reconnection may be required for changes to take effect.'
        : 'Scope configuration confirmed.',
      integration: {
        id: updatedIntegration.id,
        platform: updatedIntegration.platform,
        requiresReconnection: updateData.metadata.requiresReconnection || false
      },
      scopes: {
        previous: currentScopes,
        current: resolvedScopes,
        added: addedScopes,
        removed: removedScopes,
        changed: scopesChanged
      },
      dataUsage: {
        level: dataUsage.level,
        typesCount: dataUsage.details.length,
        impact: getScopeChangeImpact(addedScopes, removedScopes)
      },
      nextSteps: getNextSteps(scopesChanged, updateData.metadata.requiresReconnection)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error updating integration scopes:', error)
    return NextResponse.json(
      { error: 'Failed to update scopes' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/integrations/[integrationId]/scopes/validate
 * Validate a scope configuration without updating
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ integrationId: string }> }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { scopes } = body

    console.log('🔍 Validating scopes:', scopes?.length || 0)

    // Validate input
    if (!scopes || !Array.isArray(scopes)) {
      return NextResponse.json(
        { error: 'Scopes array is required' },
        { status: 400 }
      )
    }

    // Validate the scopes
    const validation = ShopifyScopeManager.validateScopes(scopes)
    const resolvedScopes = ShopifyScopeManager.getResolveDependencies(scopes)
    const dataUsage = ShopifyScopeManager.estimateDataUsage(resolvedScopes)

    // Get scope details
    const scopeDetails = resolvedScopes.map(scopeId => {
      const scope = ShopifyScopeManager.getScopeById(scopeId)
      return scope ? {
        id: scope.id,
        name: scope.name,
        category: scope.category,
        riskLevel: scope.riskLevel,
        required: scope.required
      } : null
    }).filter(Boolean)

    const response = {
      valid: validation.valid,
      scopes: {
        requested: scopes,
        resolved: resolvedScopes,
        details: scopeDetails,
        dependenciesAdded: resolvedScopes.filter(scope => !scopes.includes(scope))
      },
      validation: {
        missing: validation.missing,
        invalid: validation.invalid
      },
      dataUsage: {
        level: dataUsage.level,
        typesCount: dataUsage.details.length,
        riskAssessment: assessScopeRisk(resolvedScopes)
      },
      recommendations: getScopeRecommendations(resolvedScopes)
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error validating scopes:', error)
    return NextResponse.json(
      { error: 'Failed to validate scopes' },
      { status: 500 }
    )
  }
}

// Helper functions

/**
 * Check if two arrays are equal
 */
function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((val, i) => val === b[i])
}

/**
 * Log scope changes for audit trail
 */
async function logScopeChange(
  integrationId: string, 
  userId: string, 
  changeData: any
) {
  try {
    // In a full implementation, you might want a separate audit log table
    console.log('📝 Logging scope change:', {
      integrationId,
      userId,
      ...changeData,
      timestamp: new Date().toISOString()
    })
    
    // Could store in database:
    // await prisma.auditLog.create({
    //   data: {
    //     integrationId,
    //     userId,
    //     action: changeData.action,
    //     details: changeData,
    //     createdAt: new Date()
    //   }
    // })
  } catch (error) {
    console.error('Failed to log scope change:', error)
  }
}

/**
 * Assess the impact of scope changes
 */
function getScopeChangeImpact(added: string[], removed: string[]): string {
  const addedHighRisk = added.filter(scopeId => {
    const scope = ShopifyScopeManager.getScopeById(scopeId)
    return scope?.riskLevel === 'high'
  }).length

  const removedHighRisk = removed.filter(scopeId => {
    const scope = ShopifyScopeManager.getScopeById(scopeId)
    return scope?.riskLevel === 'high'
  }).length

  if (addedHighRisk > 0) return 'high'
  if (removedHighRisk > 0) return 'medium'
  if (added.length > removed.length) return 'expanding'
  if (removed.length > added.length) return 'reducing'
  return 'minimal'
}

/**
 * Get next steps based on scope changes
 */
function getNextSteps(scopesChanged: boolean, requiresReconnection?: boolean): string[] {
  const steps: string[] = []
  
  if (!scopesChanged) {
    steps.push('No action required - scope configuration is unchanged')
    return steps
  }

  steps.push('Scope configuration has been updated')
  
  if (requiresReconnection) {
    steps.push('Reconnection required - please reconnect your Shopify store')
    steps.push('Go to integration settings and click "Reconnect"')
  } else {
    steps.push('Changes will take effect on next data sync')
    steps.push('You may trigger a manual sync to apply changes immediately')
  }
  
  return steps
}

/**
 * Assess overall risk of scope configuration
 */
function assessScopeRisk(scopes: string[]): {
  level: 'low' | 'medium' | 'high';
  factors: string[];
} {
  const scopeObjects = scopes.map(id => ShopifyScopeManager.getScopeById(id)).filter(Boolean)
  
  const highRiskCount = scopeObjects.filter(scope => scope?.riskLevel === 'high').length
  const mediumRiskCount = scopeObjects.filter(scope => scope?.riskLevel === 'medium').length
  
  const factors: string[] = []
  
  if (highRiskCount > 0) {
    factors.push(`${highRiskCount} high-risk permissions`)
  }
  if (mediumRiskCount > 3) {
    factors.push(`${mediumRiskCount} medium-risk permissions`)
  }
  if (scopes.length > 15) {
    factors.push(`Large scope count (${scopes.length} permissions)`)
  }

  let level: 'low' | 'medium' | 'high' = 'low'
  if (highRiskCount > 2) level = 'high'
  else if (highRiskCount > 0 || mediumRiskCount > 5) level = 'medium'
  
  return { level, factors }
}

/**
 * Get scope recommendations
 */
function getScopeRecommendations(scopes: string[]): string[] {
  const recommendations: string[] = []
  const scopeObjects = scopes.map(id => ShopifyScopeManager.getScopeById(id)).filter(Boolean)
  
  const categories = new Set(scopeObjects.map(scope => scope?.category))
  const highRiskCount = scopeObjects.filter(scope => scope?.riskLevel === 'high').length
  
  if (highRiskCount === 0) {
    recommendations.push('✅ Good security posture - no high-risk permissions')
  }
  
  if (categories.has('financial') && !scopes.includes('read_orders')) {
    recommendations.push('💡 Consider adding read_orders for better financial analytics')
  }
  
  if (scopes.length > 20) {
    recommendations.push('⚠️ Consider using a smaller, more focused set of permissions')
  }
  
  if (categories.size < 3) {
    recommendations.push('📊 You might be missing key data categories for comprehensive analytics')
  }
  
  return recommendations
}