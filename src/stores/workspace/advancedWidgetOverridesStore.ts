import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IWidgetOptions } from '@/lib/litegraph/src/types/widgets'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import type { NodeLocatorId } from '@/types/nodeIdentification'

interface AdvancedWidgetOverrideEntry {
  nodeLocatorId: NodeLocatorId
  widgetName: string
  /** true = force advanced, false = force non-advanced */
  advanced: boolean
}

interface AdvancedWidgetOverridesStorage {
  overrides: AdvancedWidgetOverrideEntry[]
}

/**
 * Manages per-workflow user overrides for widget advanced status.
 *
 * Three-state model per widget:
 * - No override: uses backend value (widget.options.advanced)
 * - Override to true: widget is forced into the advanced section
 * - Override to false: widget is forced out of the advanced section
 *
 * Persisted in workflow.extra.advancedWidgetOverrides.
 */
export const useAdvancedWidgetOverridesStore = defineStore(
  'advancedWidgetOverrides',
  () => {
    const workflowStore = useWorkflowStore()
    const canvasStore = useCanvasStore()

    /** Map of override key → advanced boolean */
    const overrides = ref<Map<string, boolean>>(new Map())

    function getOverrideKey(
      nodeLocatorId: NodeLocatorId,
      widgetName: string
    ): string {
      return JSON.stringify([nodeLocatorId, widgetName])
    }

    function parseOverrideKey(
      key: string
    ): { nodeLocatorId: NodeLocatorId; widgetName: string } | null {
      try {
        const [nodeLocatorId, widgetName] = JSON.parse(key) as [string, string]
        if (!nodeLocatorId || !widgetName) return null
        return { nodeLocatorId, widgetName }
      } catch {
        return null
      }
    }

    function getNodeLocatorId(node: LGraphNode): NodeLocatorId {
      return workflowStore.nodeToNodeLocatorId(node)
    }

    function loadFromWorkflow() {
      const graph = app.rootGraph
      if (!graph) {
        overrides.value = new Map()
        return
      }

      try {
        const storedData = graph.extra?.advancedWidgetOverrides as
          | AdvancedWidgetOverridesStorage
          | undefined

        const newMap = new Map<string, boolean>()
        if (storedData?.overrides) {
          for (const entry of storedData.overrides) {
            if (!entry.nodeLocatorId || !entry.widgetName) continue
            const key = getOverrideKey(entry.nodeLocatorId, entry.widgetName)
            newMap.set(key, entry.advanced)
          }
        }
        overrides.value = newMap
      } catch (error) {
        console.error(
          'Failed to load advanced widget overrides from workflow:',
          error
        )
        overrides.value = new Map()
      }
    }

    function saveToWorkflow() {
      const graph = app.rootGraph
      if (!graph) return

      try {
        const entries: AdvancedWidgetOverrideEntry[] = []
        for (const [key, advanced] of overrides.value) {
          const parsed = parseOverrideKey(key)
          if (!parsed) continue
          entries.push({ ...parsed, advanced })
        }

        const data: AdvancedWidgetOverridesStorage = { overrides: entries }
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
     * Resolved advanced state for a widget, considering user override.
     */
    function getAdvancedState(
      node: LGraphNode,
      widget: { name: string; options?: IWidgetOptions<unknown> }
    ): boolean {
      const key = getOverrideKey(getNodeLocatorId(node), widget.name)
      const override = overrides.value.get(key)
      if (override !== undefined) return override
      return !!widget.options?.advanced
    }

    /**
     * Set the advanced override for a widget.
     * Pass the desired advanced state (true/false).
     */
    function setAdvanced(
      node: LGraphNode,
      widgetName: string,
      advanced: boolean
    ) {
      const key = getOverrideKey(getNodeLocatorId(node), widgetName)
      overrides.value.set(key, advanced)
      overrides.value = new Map(overrides.value)
      saveToWorkflow()
    }

    /**
     * Remove the override for a widget, reverting to backend default.
     */
    function clearOverride(node: LGraphNode, widgetName: string) {
      const key = getOverrideKey(getNodeLocatorId(node), widgetName)
      overrides.value.delete(key)
      overrides.value = new Map(overrides.value)
      saveToWorkflow()
    }

    /**
     * Whether a widget has a user override.
     */
    function isOverridden(node: LGraphNode, widgetName: string): boolean {
      const key = getOverrideKey(getNodeLocatorId(node), widgetName)
      return overrides.value.has(key)
    }

    /**
     * Whether a node has any widget that is effectively advanced
     * (after applying overrides).
     */
    function hasAnyAdvanced(node: LGraphNode): boolean {
      const widgets = node.widgets
      if (!widgets?.length) return false
      return widgets.some((w) => getAdvancedState(node, w))
    }

    function clearAllOverrides() {
      overrides.value = new Map()
      saveToWorkflow()
    }

    /**
     * Remove overrides for nodes/widgets that no longer exist.
     */
    function pruneInvalidOverrides() {
      const graph = app.rootGraph
      if (!graph) return

      const validKeys = new Set<string>()
      graph.nodes?.forEach((node) => {
        node.widgets?.forEach((widget) => {
          const key = getOverrideKey(
            getNodeLocatorId(node as LGraphNode),
            widget.name
          )
          validKeys.add(key)
        })
      })

      let changed = false
      for (const key of overrides.value.keys()) {
        if (!validKeys.has(key)) {
          overrides.value.delete(key)
          changed = true
        }
      }

      if (changed) {
        overrides.value = new Map(overrides.value)
        saveToWorkflow()
      }
    }

    watch(
      () => workflowStore.activeWorkflow,
      () => {
        loadFromWorkflow()
      },
      { immediate: true }
    )

    return {
      getAdvancedState,
      setAdvanced,
      clearOverride,
      isOverridden,
      hasAnyAdvanced,
      clearAllOverrides,
      pruneInvalidOverrides
    }
  }
)
