import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'

/**
 * Unique identifier for a widget's advanced override.
 */
interface AdvancedWidgetOverrideId {
  nodeLocatorId: NodeLocatorId
  widgetName: string
}

/**
 * Storage format for persisted advanced widget overrides.
 * Stored in workflow.extra.advancedWidgetOverrides.
 */
interface AdvancedWidgetOverridesStorage {
  overrides: AdvancedWidgetOverrideId[]
}

/**
 * Store for managing advanced widget status overrides.
 *
 * Users can manually mark/unmark widgets as advanced, and this preference
 * is stored per-workflow. This allows customization of which widgets
 * appear in the advanced section.
 *
 * Design decisions:
 * - Scope: Per-workflow (not global user preference)
 * - Identifier: node locator ID + widget.name
 * - Persistence: Stored in workflow.extra.advancedWidgetOverrides
 * - Override logic: User override takes precedence over backend value
 */
export const useAdvancedWidgetOverridesStore = defineStore(
  'advancedWidgetOverrides',
  () => {
    const workflowStore = useWorkflowStore()
    const canvasStore = useCanvasStore()

    const overriddenIds = ref<string[]>([])

    /**
     * Generate a unique string key for an override ID.
     */
    function getOverrideKey(id: AdvancedWidgetOverrideId): string {
      return JSON.stringify([id.nodeLocatorId, id.widgetName])
    }

    /**
     * Parse an override key back into an AdvancedWidgetOverrideId.
     */
    function parseOverrideKey(key: string): AdvancedWidgetOverrideId | null {
      try {
        const [nodeLocatorId, widgetName] = JSON.parse(key) as [string, string]
        if (!nodeLocatorId || !widgetName) return null
        return { nodeLocatorId, widgetName }
      } catch {
        return null
      }
    }

    function createOverrideId(
      node: LGraphNode,
      widgetName: string
    ): AdvancedWidgetOverrideId {
      return {
        nodeLocatorId: workflowStore.nodeToNodeLocatorId(node),
        widgetName
      }
    }

    /**
     * Load overrides from the current workflow's extra data.
     */
    function loadFromWorkflow() {
      const graph = app.rootGraph
      if (!graph) {
        overriddenIds.value = []
        return
      }

      try {
        const storedData = graph.extra?.advancedWidgetOverrides as
          | AdvancedWidgetOverridesStorage
          | undefined

        if (storedData?.overrides) {
          const keys = storedData.overrides
            .filter((override) => override.nodeLocatorId && override.widgetName)
            .map((override) => getOverrideKey(override))
          overriddenIds.value = keys
        } else {
          overriddenIds.value = []
        }
      } catch (error) {
        console.error(
          'Failed to load advanced widget overrides from workflow:',
          error
        )
        overriddenIds.value = []
      }
    }

    /**
     * Save overrides to the current workflow's extra data.
     * Marks the workflow as modified.
     */
    function saveToWorkflow() {
      const graph = app.rootGraph
      if (!graph) return

      try {
        const overrides: AdvancedWidgetOverrideId[] = overriddenIds.value
          .map(parseOverrideKey)
          .filter((id): id is AdvancedWidgetOverrideId => id !== null)

        const data: AdvancedWidgetOverridesStorage = { overrides }

        graph.extra ??= {}
        graph.extra.advancedWidgetOverrides = data

        canvasStore.canvas?.setDirty(true, true)
      } catch (error) {
        console.error(
          'Failed to save advanced widget overrides to workflow:',
          error
        )
      }
    }

    /**
     * Get the resolved advanced state for a widget.
     * Returns: user override if exists, otherwise backend value.
     */
    function getAdvancedState(node: LGraphNode, widget: IBaseWidget): boolean {
      const key = getOverrideKey(createOverrideId(node, widget.name))
      const isOverridden = overriddenIds.value.includes(key)

      if (isOverridden) {
        return true
      }
      return !!widget.options?.advanced
    }

    /**
     * Toggle the advanced override for a widget.
     * If the widget is already marked as advanced (by backend or override),
     * toggling removes the override (falls back to backend).
     * If not marked as advanced, toggling adds it to the override list.
     */
    function toggleAdvanced(node: LGraphNode, widgetName: string) {
      const id = createOverrideId(node, widgetName)
      const key = getOverrideKey(id)

      if (overriddenIds.value.includes(key)) {
        overriddenIds.value = overriddenIds.value.filter((k) => k !== key)
      } else {
        overriddenIds.value.push(key)
      }

      saveToWorkflow()
    }

    /**
     * Check if a widget has an active override (user marked as advanced).
     */
    function isOverridden(node: LGraphNode, widgetName: string): boolean {
      const key = getOverrideKey(createOverrideId(node, widgetName))
      return overriddenIds.value.includes(key)
    }

    /**
     * Clear all overrides for the current workflow.
     */
    function clearOverrides() {
      overriddenIds.value = []
      saveToWorkflow()
    }

    /**
     * Remove invalid overrides (where node or widget no longer exists).
     */
    function pruneInvalidOverrides() {
      const graph = app.rootGraph
      if (!graph) return

      const validKeys: Set<string> = new Set()

      graph.nodes?.forEach((node) => {
        node.widgets?.forEach((widget) => {
          const id = createOverrideId(node as LGraphNode, widget.name)
          const key = getOverrideKey(id)
          validKeys.add(key)
        })
      })

      const filteredIds = overriddenIds.value.filter((key) =>
        validKeys.has(key)
      )

      if (filteredIds.length !== overriddenIds.value.length) {
        overriddenIds.value = filteredIds
        saveToWorkflow()
      }
    }

    watch(
      () => workflowStore.activeWorkflow?.path,
      () => {
        loadFromWorkflow()
      },
      { immediate: true }
    )

    return {
      // State
      overriddenIds: computed(() => overriddenIds.value),

      // Actions
      getAdvancedState,
      toggleAdvanced,
      isOverridden,
      clearOverrides,
      pruneInvalidOverrides,
      loadFromWorkflow,
      saveToWorkflow
    }
  }
)
