import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

/**
 * Unique identifier for a favorited widget.
 * Combines node ID and widget name to locate a widget in the graph.
 */
export interface FavoritedWidgetId {
  /** The node ID in the graph */
  nodeId: NodeId
  /** The widget name on the node */
  widgetName: string
}

/**
 * A favorited widget with its resolved runtime instance.
 * The widget instance may be null if the node or widget no longer exists.
 */
export interface FavoritedWidget extends FavoritedWidgetId {
  /** The resolved node instance (null if node was deleted) */
  node: LGraphNode | null
  /** The resolved widget instance (null if widget no longer exists) */
  widget: IBaseWidget | null
  /** Display label for the favorited item */
  label: string
}

export interface ValidFavoritedWidget extends FavoritedWidget {
  node: LGraphNode
  widget: IBaseWidget
}

/**
 * Storage format for persisted favorited widgets.
 * Stored per-workflow in localStorage.
 */
interface FavoritedWidgetStorage {
  /** Array of favorited widget identifiers */
  favorites: FavoritedWidgetId[]
}

/**
 * Store for managing favorited/starred widgets.
 *
 * Favorited widgets can be accessed and edited from the right side panel
 * without needing to select the corresponding node. This store manages:
 * - Persisting favorited widget IDs per workflow
 * - Resolving widget IDs to actual widget instances
 * - Handling cases where nodes/widgets are deleted
 *
 * Design decisions for MVP:
 * - Scope: Per-workflow (not global user preference)
 * - Identifier: node.id + widget.name
 * - Persistence: localStorage with workflow-specific keys
 * - Future: Can be extended for Linear Mode
 */
export const useFavoritedWidgetsStore = defineStore('favoritedWidgets', () => {
  const workflowStore = useWorkflowStore()

  /** In-memory set of favorited widget IDs for fast lookups */
  const favoritedIds = ref<Set<string>>(new Set())

  /**
   * Generate a unique string key for a favorited widget ID.
   * Format: "nodeId:widgetName"
   */
  function getFavoriteKey(id: FavoritedWidgetId): string {
    return `${id.nodeId}:${id.widgetName}`
  }

  /**
   * Parse a favorite key back into a FavoritedWidgetId.
   */
  function parseFavoriteKey(key: string): FavoritedWidgetId | null {
    const [nodeIdStr, widgetName] = key.split(':')
    if (!nodeIdStr || !widgetName) return null

    // Try to parse as number, otherwise use as string
    const nodeIdNum = parseInt(nodeIdStr, 10)
    const nodeId: NodeId = isNaN(nodeIdNum) ? nodeIdStr : nodeIdNum

    return { nodeId, widgetName }
  }

  /**
   * Get the localStorage key for the current workflow's favorites.
   * Returns null if no workflow is active.
   */
  function getStorageKey(): string | null {
    const workflow = workflowStore.activeWorkflow
    if (!workflow) return null
    // Use workflow path as unique identifier
    return `Comfy.FavoritedWidgets.${workflow.path}`
  }

  /**
   * Load favorited widgets from localStorage for the current workflow.
   */
  function loadFromStorage() {
    const key = getStorageKey()
    if (!key) {
      favoritedIds.value.clear()
      return
    }

    try {
      const stored = localStorage.getItem(key)
      if (!stored) {
        favoritedIds.value.clear()
        return
      }

      const data: FavoritedWidgetStorage = JSON.parse(stored)
      favoritedIds.value = new Set(data.favorites.map(getFavoriteKey))
    } catch (error) {
      console.error('Failed to load favorited widgets from storage:', error)
      favoritedIds.value.clear()
    }
  }

  /**
   * Save favorited widgets to localStorage for the current workflow.
   */
  function saveToStorage() {
    const key = getStorageKey()
    if (!key) return

    try {
      const favorites: FavoritedWidgetId[] = Array.from(favoritedIds.value)
        .map(parseFavoriteKey)
        .filter((id): id is FavoritedWidgetId => id !== null)

      const data: FavoritedWidgetStorage = { favorites }
      localStorage.setItem(key, JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save favorited widgets to storage:', error)
    }
  }

  /**
   * Resolve a favorited widget ID to its actual widget instance.
   * Returns null if the node or widget no longer exists.
   */
  function resolveWidget(id: FavoritedWidgetId): FavoritedWidget {
    const graph = app.rootGraph
    if (!graph) {
      return {
        ...id,
        node: null,
        widget: null,
        label: `${id.widgetName} (graph not loaded)`
      }
    }

    const node = graph.getNodeById(id.nodeId)
    if (!node) {
      return {
        ...id,
        node: null,
        widget: null,
        label: `${id.widgetName} (node deleted)`
      }
    }

    const widget = node.widgets?.find((w) => w.name === id.widgetName)
    if (!widget) {
      return {
        ...id,
        node,
        widget: null,
        label: `${id.widgetName} (widget not found)`
      }
    }

    const nodeTitle = node.title || node.type || 'Node'
    const widgetLabel = widget.label || widget.name
    return {
      ...id,
      node,
      widget,
      label: `${nodeTitle} / ${widgetLabel}`
    }
  }

  /**
   * Get all favorited widgets with their resolved instances.
   * Widgets that no longer exist will have null node/widget properties.
   */
  const favoritedWidgets = computed((): FavoritedWidget[] => {
    return Array.from(favoritedIds.value)
      .map(parseFavoriteKey)
      .filter((id): id is FavoritedWidgetId => id !== null)
      .map(resolveWidget)
  })

  /**
   * Get only the valid favorited widgets (where both node and widget exist).
   */
  const validFavoritedWidgets = computed((): ValidFavoritedWidget[] => {
    return favoritedWidgets.value.filter(
      (fw) => fw.node !== null && fw.widget !== null
    ) as ValidFavoritedWidget[]
  })

  /**
   * Check if a widget is favorited.
   */
  function isFavorited(nodeId: NodeId, widgetName: string): boolean {
    return favoritedIds.value.has(getFavoriteKey({ nodeId, widgetName }))
  }

  /**
   * Add a widget to favorites.
   */
  function addFavorite(nodeId: NodeId, widgetName: string) {
    const key = getFavoriteKey({ nodeId, widgetName })
    if (favoritedIds.value.has(key)) return

    favoritedIds.value.add(key)
    saveToStorage()
  }

  /**
   * Remove a widget from favorites.
   */
  function removeFavorite(nodeId: NodeId, widgetName: string) {
    const key = getFavoriteKey({ nodeId, widgetName })
    if (!favoritedIds.value.has(key)) return

    favoritedIds.value.delete(key)
    saveToStorage()
  }

  /**
   * Toggle a widget's favorite status.
   */
  function toggleFavorite(nodeId: NodeId, widgetName: string) {
    if (isFavorited(nodeId, widgetName)) {
      removeFavorite(nodeId, widgetName)
    } else {
      addFavorite(nodeId, widgetName)
    }
  }

  /**
   * Clear all favorites for the current workflow.
   */
  function clearFavorites() {
    favoritedIds.value.clear()
    saveToStorage()
  }

  /**
   * Remove invalid favorites (where node or widget no longer exists).
   * Useful for cleanup after loading a workflow.
   */
  function pruneInvalidFavorites() {
    const validKeys = validFavoritedWidgets.value.map((fw) =>
      getFavoriteKey({ nodeId: fw.nodeId, widgetName: fw.widgetName })
    )
    const validSet = new Set(validKeys)

    let changed = false
    for (const key of favoritedIds.value) {
      if (!validSet.has(key)) {
        favoritedIds.value.delete(key)
        changed = true
      }
    }

    if (changed) {
      saveToStorage()
    }
  }

  // Watch for workflow changes and reload favorites
  watch(
    () => workflowStore.activeWorkflow?.path,
    () => {
      loadFromStorage()
    },
    { immediate: true }
  )

  return {
    // State
    favoritedWidgets,
    validFavoritedWidgets,

    // Actions
    isFavorited,
    addFavorite,
    removeFavorite,
    toggleFavorite,
    clearFavorites,
    pruneInvalidFavorites
  }
})
