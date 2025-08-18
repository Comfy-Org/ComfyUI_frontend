/**
 * Node Widget Management
 *
 * Handles widget state synchronization between LiteGraph and Vue.
 * Provides wrapped callbacks to maintain consistency.
 */
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { WidgetValue } from '@/types/simplifiedWidget'

export type { WidgetValue }

export interface SafeWidgetData {
  name: string
  type: string
  value: WidgetValue
  options?: Record<string, unknown>
  callback?: ((value: unknown) => void) | undefined
}

export interface VueNodeData {
  id: string
  title: string
  type: string
  mode: number
  selected: boolean
  executing: boolean
  widgets?: SafeWidgetData[]
  inputs?: unknown[]
  outputs?: unknown[]
  flags?: {
    collapsed?: boolean
  }
}

/**
 * Validates that a value is a valid WidgetValue type
 */
export function validateWidgetValue(value: unknown): WidgetValue {
  if (value === null || value === undefined || value === void 0) {
    return undefined
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value
  }
  if (typeof value === 'object') {
    // Check if it's a File array
    if (Array.isArray(value) && value.every((item) => item instanceof File)) {
      return value as File[]
    }
    // Otherwise it's a generic object
    return value as object
  }
  // If none of the above, return undefined
  console.warn(`Invalid widget value type: ${typeof value}`, value)
  return undefined
}

/**
 * Extract safe widget data from LiteGraph widgets
 */
export function extractWidgetData(
  widgets?: any[]
): SafeWidgetData[] | undefined {
  if (!widgets) return undefined

  return widgets.map((widget) => {
    try {
      let value = widget.value

      // For combo widgets, if value is undefined, use the first option as default
      if (
        value === undefined &&
        widget.type === 'combo' &&
        widget.options?.values &&
        Array.isArray(widget.options.values) &&
        widget.options.values.length > 0
      ) {
        value = widget.options.values[0]
      }

      return {
        name: widget.name,
        type: widget.type,
        value: validateWidgetValue(value),
        options: widget.options ? { ...widget.options } : undefined,
        callback: widget.callback
      }
    } catch (error) {
      return {
        name: widget.name || 'unknown',
        type: widget.type || 'text',
        value: undefined,
        options: undefined,
        callback: undefined
      }
    }
  })
}

/**
 * Widget callback management for LiteGraph/Vue sync
 */
export function useNodeWidgets() {
  /**
   * Creates a wrapped callback for a widget that maintains LiteGraph/Vue sync
   */
  const createWrappedCallback = (
    widget: { value?: unknown; name: string },
    originalCallback: ((value: unknown) => void) | undefined,
    nodeId: string,
    onUpdate: (nodeId: string, widgetName: string, value: unknown) => void
  ) => {
    let updateInProgress = false

    return (value: unknown) => {
      if (updateInProgress) return
      updateInProgress = true

      try {
        // Validate that the value is of an acceptable type
        if (
          value !== null &&
          value !== undefined &&
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean' &&
          typeof value !== 'object'
        ) {
          console.warn(`Invalid widget value type: ${typeof value}`)
          updateInProgress = false
          return
        }

        // Always update widget.value to ensure sync
        widget.value = value

        // Call the original callback if it exists
        if (originalCallback) {
          originalCallback.call(widget, value)
        }

        // Update Vue state to maintain synchronization
        onUpdate(nodeId, widget.name, value)
      } finally {
        updateInProgress = false
      }
    }
  }

  /**
   * Sets up widget callbacks for a node
   */
  const setupNodeWidgetCallbacks = (
    node: LGraphNode,
    onUpdate: (nodeId: string, widgetName: string, value: unknown) => void
  ) => {
    if (!node.widgets) return

    const nodeId = String(node.id)

    node.widgets.forEach((widget) => {
      const originalCallback = widget.callback
      widget.callback = createWrappedCallback(
        widget,
        originalCallback,
        nodeId,
        onUpdate
      )
    })
  }

  return {
    validateWidgetValue,
    extractWidgetData,
    createWrappedCallback,
    setupNodeWidgetCallbacks
  }
}
