// app/api/organizations/[orgId]/dashboard/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DashboardSettings } from '@/lib/dashboard/settings'
import { TeamManager } from '@/lib/team/manager'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    // Check if user has access to organization
    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canRead'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const action = searchParams.get('action')

    switch (action) {
      case 'layout':
        const layout = await DashboardSettings.getUserDashboard(
          orgId,
          session.user.id
        )
        return NextResponse.json({ layout })

      case 'preferences':
        const preferences = await DashboardSettings.getDashboardPreferences(
          orgId,
          session.user.id
        )
        return NextResponse.json({ preferences })

      case 'widgets':
        const availableWidgets = DashboardSettings.getAvailableWidgets()
        return NextResponse.json({ widgets: availableWidgets })

      default:
        // Return both layout and preferences
        const [dashboardLayout, dashboardPreferences] = await Promise.all([
          DashboardSettings.getUserDashboard(orgId, session.user.id),
          DashboardSettings.getDashboardPreferences(orgId, session.user.id)
        ])

        return NextResponse.json({
          layout: dashboardLayout,
          preferences: dashboardPreferences,
          availableWidgets: DashboardSettings.getAvailableWidgets()
        })
    }

  } catch (error) {
    console.error('Get dashboard settings error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { orgId } = await params

    // Check if user has write permission
    const hasPermission = await TeamManager.hasPermission(
      orgId,
      session.user.id,
      'canWrite'
    )

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { action, ...data } = await req.json()

    switch (action) {
      case 'update_layout':
        const { layoutId, updates } = data
        if (!layoutId) {
          return NextResponse.json({ error: 'Layout ID is required' }, { status: 400 })
        }

        const updateResult = await DashboardSettings.updateDashboardLayout(layoutId, updates)
        if (!updateResult.success) {
          return NextResponse.json({ error: updateResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Dashboard layout updated successfully'
        })

      case 'add_widget':
        const { layoutId: addLayoutId, widget } = data
        if (!addLayoutId || !widget) {
          return NextResponse.json({ error: 'Layout ID and widget data are required' }, { status: 400 })
        }

        const addResult = await DashboardSettings.addWidget(addLayoutId, widget)
        if (!addResult.success) {
          return NextResponse.json({ error: addResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Widget added successfully',
          widget: addResult.widget
        })

      case 'remove_widget':
        const { layoutId: removeLayoutId, widgetId } = data
        if (!removeLayoutId || !widgetId) {
          return NextResponse.json({ error: 'Layout ID and widget ID are required' }, { status: 400 })
        }

        const removeResult = await DashboardSettings.removeWidget(removeLayoutId, widgetId)
        if (!removeResult.success) {
          return NextResponse.json({ error: removeResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Widget removed successfully'
        })

      case 'update_widget':
        const { layoutId: updateLayoutId, widgetId: updateWidgetId, updates: widgetUpdates } = data
        if (!updateLayoutId || !updateWidgetId) {
          return NextResponse.json({ error: 'Layout ID and widget ID are required' }, { status: 400 })
        }

        const widgetUpdateResult = await DashboardSettings.updateWidget(
          updateLayoutId,
          updateWidgetId,
          widgetUpdates
        )
        if (!widgetUpdateResult.success) {
          return NextResponse.json({ error: widgetUpdateResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Widget updated successfully'
        })

      case 'update_preferences':
        const { preferences } = data
        if (!preferences) {
          return NextResponse.json({ error: 'Preferences data is required' }, { status: 400 })
        }

        const preferencesResult = await DashboardSettings.updateDashboardPreferences(
          orgId,
          session.user.id,
          preferences
        )
        if (!preferencesResult.success) {
          return NextResponse.json({ error: preferencesResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Preferences updated successfully'
        })

      case 'export_dashboard':
        const { layoutId: exportLayoutId } = data
        if (!exportLayoutId) {
          return NextResponse.json({ error: 'Layout ID is required' }, { status: 400 })
        }

        try {
          const exportData = await DashboardSettings.exportDashboard(exportLayoutId)
          return NextResponse.json({
            success: true,
            data: exportData,
            filename: `dashboard-export-${new Date().toISOString().split('T')[0]}.json`
          })
        } catch (error) {
          return NextResponse.json({ error: 'Failed to export dashboard' }, { status: 500 })
        }

      case 'import_dashboard':
        const { configJson } = data
        if (!configJson) {
          return NextResponse.json({ error: 'Configuration JSON is required' }, { status: 400 })
        }

        const importResult = await DashboardSettings.importDashboard(
          orgId,
          session.user.id,
          configJson
        )
        if (!importResult.success) {
          return NextResponse.json({ error: importResult.error }, { status: 400 })
        }

        return NextResponse.json({
          success: true,
          message: 'Dashboard imported successfully',
          layout: importResult.layout
        })

      case 'reset_to_default':
        const defaultLayout = await DashboardSettings.createDefaultDashboard(
          orgId,
          session.user.id
        )

        return NextResponse.json({
          success: true,
          message: 'Dashboard reset to default layout',
          layout: defaultLayout
        })

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

  } catch (error) {
    console.error('Dashboard settings action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}