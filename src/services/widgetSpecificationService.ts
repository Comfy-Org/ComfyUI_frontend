/**
 * Widget Specification Service - ECS-adjacent system for accessing widget metadata
 *
 * Provides type-safe access to input specifications without requiring data
 * to be stored directly on widgets or nodes.
 */
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useNodeDefStore } from '@/stores/nodeDefStore'

/**
 * Service for accessing widget specifications from input specs
 */
class WidgetSpecificationService {
  private nodeDefStore = useNodeDefStore()

  /**
   * Get the input specification for a widget
   * Use schema type guards (isComboInputSpec, etc.) to access type-specific properties
   */
  getInputSpec(node: LGraphNode, widgetName: string): InputSpecV2 | undefined {
    return this.nodeDefStore.getInputSpecForWidget(node, widgetName)
  }
}

// Singleton instance for the service
let widgetSpecService: WidgetSpecificationService | null = null

/**
 * Get the widget specification service (singleton)
 */
export function useWidgetSpec(): WidgetSpecificationService {
  if (!widgetSpecService) {
    widgetSpecService = new WidgetSpecificationService()
  }
  return widgetSpecService
}
