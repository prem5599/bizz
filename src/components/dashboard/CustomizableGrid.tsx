// components/dashboard/CustomizableGrid.tsx
'use client'

import { useState, useRef, useEffect } from 'react'
import { 
  Settings, 
  Plus, 
  X, 
  Move, 
  Resize, 
  Download, 
  Upload,
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { MetricCard } from './MetricCard'
import { InsightsList } from './InsightsList'

interface Widget {
  id: string
  type: 'metric' | 'chart' | 'insight' | 'custom'
  title: string
  size: 'small' | 'medium' | 'large' | 'full'
  position: { x: number; y: number; w: number; h: number }
  config: Record<string, any>
  visible: boolean
}

interface CustomizableGridProps {
  widgets: Widget[]
  isEditMode?: boolean
  onWidgetUpdate?: (widgetId: string, updates: Partial<Widget>) => void
  onWidgetAdd?: (widget: Omit<Widget, 'id'>) => void
  onWidgetRemove?: (widgetId: string) => void
  onLayoutChange?: (widgets: Widget[]) => void
  data?: any
}

export function CustomizableGrid({
  widgets,
  isEditMode = false,
  onWidgetUpdate,
  onWidgetAdd,
  onWidgetRemove,
  onLayoutChange,
  data
}: CustomizableGridProps) {
  const [editMode, setEditMode] = useState(isEditMode)
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null)
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null)
  const [showAddWidget, setShowAddWidget] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)

  // Grid configuration
  const GRID_COLS = 12
  const GRID_ROW_HEIGHT = 80
  const GRID_GAP = 16

  const getGridStyles = (widget: Widget) => {
    const { x, y, w, h } = widget.position
    return {
      gridColumn: `span ${w}`,
      gridRow: `span ${h}`,
      order: y * GRID_COLS + x
    }
  }

  const handleWidgetClick = (widgetId: string) => {
    if (editMode) {
      setSelectedWidget(selectedWidget === widgetId ? null : widgetId)
    }
  }

  const handleWidgetVisibilityToggle = (widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId)
    if (widget && onWidgetUpdate) {
      onWidgetUpdate(widgetId, { visible: !widget.visible })
    }
  }

  const handleWidgetRemove = (widgetId: string) => {
    if (onWidgetRemove) {
      onWidgetRemove(widgetId)
    }
    setSelectedWidget(null)
  }

  const renderWidget = (widget: Widget) => {
    if (!widget.visible && !editMode) return null

    const isSelected = selectedWidget === widget.id
    const isDragged = draggedWidget === widget.id

    return (
      <div
        key={widget.id}
        className={cn(
          "relative group transition-all duration-200",
          editMode && "cursor-move hover:shadow-lg",
          isSelected && "ring-2 ring-blue-500 ring-offset-2",
          isDragged && "opacity-50 z-50",
          !widget.visible && editMode && "opacity-50"
        )}
        style={getGridStyles(widget)}
        onClick={() => handleWidgetClick(widget.id)}
      >
        {/* Widget content */}
        <div className="h-full w-full">
          {renderWidgetContent(widget)}
        </div>

        {/* Edit mode overlay */}
        {editMode && (
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-5 transition-all duration-200">
            {/* Widget controls */}
            <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleWidgetVisibilityToggle(widget.id)
                }}
                className="p-1 rounded bg-white shadow-sm hover:bg-gray-50"
                title={widget.visible ? 'Hide widget' : 'Show widget'}
              >
                {widget.visible ? (
                  <Eye className="h-3 w-3 text-gray-600" />
                ) : (
                  <EyeOff className="h-3 w-3 text-gray-600" />
                )}
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  // Open widget settings
                }}
                className="p-1 rounded bg-white shadow-sm hover:bg-gray-50"
                title="Widget settings"
              >
                <Settings className="h-3 w-3 text-gray-600" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleWidgetRemove(widget.id)
                }}
                className="p-1 rounded bg-white shadow-sm hover:bg-red-50"
                title="Remove widget"
              >
                <X className="h-3 w-3 text-red-600" />
              </button>
            </div>

            {/* Resize handle */}
            <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <Resize className="h-3 w-3 text-gray-400" />
            </div>

            {/* Selection indicator */}
            {isSelected && (
              <div className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none" />
            )}
          </div>
        )}
      </div>
    )
  }

  const renderWidgetContent = (widget: Widget) => {
    switch (widget.type) {
      case 'metric':
        const metricType = widget.config.metricType
        const metricData = data?.metrics?.[metricType]
        
        return (
          <MetricCard
            title={widget.title}
            value={metricData?.current || 0}
            change={metricData?.change}
            trend={metricData?.trend}
            format={widget.config.format}
            period="vs last 30 days"
            isLoading={!data}
            description={`${widget.title} metric`}
          />
        )

      case 'insight':
        return (
          <div className="h-full bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {widget.title}
            </h3>
            <InsightsList
              insights={data?.insights || []}
              limit={widget.config.maxInsights || 3}
              showActions={false}
            />
          </div>
        )

      case 'chart':
        return (
          <div className="h-full bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {widget.title}
            </h3>
            <div className="flex items-center justify-center h-32 bg-slate-50 rounded">
              <p className="text-slate-500">Chart placeholder</p>
            </div>
          </div>
        )

      case 'custom':
        return (
          <div className="h-full bg-white rounded-lg border border-slate-200 p-4">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {widget.title}
            </h3>
            <div className="h-full">
              <p className="text-slate-600">Custom widget content</p>
            </div>
          </div>
        )

      default:
        return (
          <div className="h-full bg-white rounded-lg border border-slate-200 p-4">
            <p>Unknown widget type: {widget.type}</p>
          </div>
        )
    }
  }

  const addNewWidget = (type: string) => {
    if (!onWidgetAdd) return

    const newWidget = {
      type: type as 'metric' | 'chart' | 'insight' | 'custom',
      title: `New ${type} Widget`,
      size: 'medium' as const,
      position: { x: 0, y: 0, w: 3, h: 2 },
      config: getDefaultConfig(type),
      visible: true
    }

    onWidgetAdd(newWidget)
    setShowAddWidget(false)
  }

  const getDefaultConfig = (type: string) => {
    switch (type) {
      case 'metric':
        return { metricType: 'revenue', format: 'currency' }
      case 'chart':
        return { chartType: 'line', metricType: 'revenue', period: '30d' }
      case 'insight':
        return { maxInsights: 5, showUnreadOnly: false }
      case 'custom':
        return { content: '<p>Custom content</p>' }
      default:
        return {}
    }
  }

  const exportLayout = () => {
    const layoutData = {
      widgets,
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }
    
    const blob = new Blob([JSON.stringify(layoutData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-layout-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const resetToDefault = () => {
    if (confirm('Are you sure you want to reset to the default layout? This cannot be undone.')) {
      // Trigger reset via parent component
      if (onLayoutChange) {
        onLayoutChange([])
      }
    }
  }

  return (
    <div className="space-y-4">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold text-slate-900">
            Dashboard
          </h2>
          {editMode && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              Edit Mode
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={exportLayout}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            title="Export layout"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>

          <button
            onClick={resetToDefault}
            className="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            title="Reset to default"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </button>

          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              "inline-flex items-center px-3 py-2 text-sm font-medium rounded-md",
              editMode
                ? "text-white bg-blue-600 hover:bg-blue-700"
                : "text-slate-600 bg-white border border-slate-300 hover:bg-slate-50"
            )}
          >
            <Settings className="h-4 w-4 mr-2" />
            {editMode ? 'Done' : 'Customize'}
          </button>
        </div>
      </div>

      {/* Add Widget Panel */}
      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-blue-900">
              Add Widget
            </h3>
            <button
              onClick={() => setShowAddWidget(!showAddWidget)}
              className="text-blue-600 hover:text-blue-800"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {showAddWidget && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <button
                onClick={() => addNewWidget('metric')}
                className="p-3 text-left border border-blue-300 rounded-md hover:bg-blue-100 transition-colors"
              >
                <div className="text-sm font-medium text-blue-900">Metric Card</div>
                <div className="text-xs text-blue-600">Key performance indicator</div>
              </button>

              <button
                onClick={() => addNewWidget('chart')}
                className="p-3 text-left border border-blue-300 rounded-md hover:bg-blue-100 transition-colors"
              >
                <div className="text-sm font-medium text-blue-900">Chart</div>
                <div className="text-xs text-blue-600">Data visualization</div>
              </button>

              <button
                onClick={() => addNewWidget('insight')}
                className="p-3 text-left border border-blue-300 rounded-md hover:bg-blue-100 transition-colors"
              >
                <div className="text-sm font-medium text-blue-900">AI Insights</div>
                <div className="text-xs text-blue-600">Smart recommendations</div>
              </button>

              <button
                onClick={() => addNewWidget('custom')}
                className="p-3 text-left border border-blue-300 rounded-md hover:bg-blue-100 transition-colors"
              >
                <div className="text-sm font-medium text-blue-900">Custom</div>
                <div className="text-xs text-blue-600">Your own content</div>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dashboard Grid */}
      <div
        ref={gridRef}
        className={cn(
          "grid gap-4 auto-rows-fr",
          "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
        )}
        style={{
          gridTemplateColumns: `repeat(${GRID_COLS}, minmax(0, 1fr))`,
          gridAutoRows: `${GRID_ROW_HEIGHT}px`
        }}
      >
        {widgets.map(renderWidget)}
      </div>

      {/* Empty State */}
      {widgets.filter(w => w.visible).length === 0 && (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">
            No widgets visible
          </h3>
          <p className="text-slate-600 mb-4">
            {editMode 
              ? 'Add your first widget to get started.' 
              : 'Enable edit mode to customize your dashboard.'}
          </p>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
            >
              <Settings className="h-4 w-4 mr-2" />
              Customize Dashboard
            </button>
          )}
        </div>
      )}

      {/* Edit Mode Instructions */}
      {editMode && (
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-slate-900 mb-2">
            Edit Mode Instructions
          </h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>• Click widgets to select and configure them</li>
            <li>• Use the controls to hide, configure, or remove widgets</li>
            <li>• Add new widgets using the panel above</li>
            <li>• Export your layout to save or share it</li>
            <li>• Click "Done" when you're finished customizing</li>
          </ul>
        </div>
      )}
    </div>
  )
}