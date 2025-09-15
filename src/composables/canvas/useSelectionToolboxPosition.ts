import { onUnmounted, ref, watch } from 'vue'
import type { Ref } from 'vue'

import { useCanvasTransformSync } from '@/composables/canvas/useCanvasTransformSync'
import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'
import { computeUnionBounds } from '@/utils/mathUtil'

/**
 * Manages the position of the selection toolbox independently.
 * Uses CSS custom properties for performant transform updates.
 */

// Shared signals for auxiliary UI (e.g., MoreOptions) to coordinate hide/restore
export const moreOptionsOpen = ref(false)
export const forceCloseMoreOptionsSignal = ref(0)
export const restoreMoreOptionsSignal = ref(0)
export const moreOptionsRestorePending = ref(false)
let moreOptionsWasOpenBeforeDrag = false
let moreOptionsSelectionSignature: string | null = null

function buildSelectionSignature(
  store: ReturnType<typeof useCanvasStore>
): string | null {
  const c = store.canvas
  if (!c) return null
  const items = Array.from(c.selectedItems)
  if (items.length !== 1) return null
  const item = items[0]
  if (isLGraphNode(item)) return `N:${item.id}`
  if (isLGraphGroup(item)) return `G:${item.id}`
  return null
}

function currentSelectionMatchesSignature(
  store: ReturnType<typeof useCanvasStore>
) {
  if (!moreOptionsSelectionSignature) return false
  return buildSelectionSignature(store) === moreOptionsSelectionSignature
}

export function useSelectionToolboxPosition(
  toolboxRef: Ref<HTMLElement | undefined>
) {
  const canvasStore = useCanvasStore()
  const lgCanvas = canvasStore.getCanvas()
  const { getSelectableItems } = useSelectedLiteGraphItems()
  const { shouldRenderVueNodes } = useVueFeatureFlags()

  // World position of selection center
  const worldPosition = ref({ x: 0, y: 0 })

  const visible = ref(false)

  /**
   * Update position based on selection
   */
  const updateSelectionBounds = () => {
    const selectableItems = getSelectableItems()

    if (!selectableItems.size) {
      visible.value = false
      return
    }

    visible.value = true

    // Get bounds for all selected items
    const allBounds: ReadOnlyRect[] = []
    for (const item of selectableItems) {
      // Skip items without valid IDs
      if (item.id == null) continue

      if (shouldRenderVueNodes.value && typeof item.id === 'string') {
        // Use layout store for Vue nodes (only works with string IDs)
        const layout = layoutStore.getNodeLayoutRef(item.id).value
        if (layout) {
          allBounds.push([
            layout.bounds.x,
            layout.bounds.y,
            layout.bounds.width,
            layout.bounds.height
          ])
        }
      } else {
        // Fallback to LiteGraph bounds for regular nodes or non-string IDs
        if (item instanceof LGraphNode) {
          const bounds = item.getBounding()
          allBounds.push([bounds[0], bounds[1], bounds[2], bounds[3]] as const)
        }
      }
    }

    // Compute union bounds
    const unionBounds = computeUnionBounds(allBounds)
    if (!unionBounds) return

    worldPosition.value = {
      x: unionBounds.x + unionBounds.width / 2,
      y: unionBounds.y - 10
    }

    updateTransform()
  }

  const updateTransform = () => {
    if (!visible.value) return

    const { scale, offset } = lgCanvas.ds
    const canvasRect = lgCanvas.canvas.getBoundingClientRect()

    const screenX =
      (worldPosition.value.x + offset[0]) * scale + canvasRect.left
    const screenY = (worldPosition.value.y + offset[1]) * scale + canvasRect.top

    // Update CSS custom properties directly for best performance
    if (toolboxRef.value) {
      toolboxRef.value.style.setProperty('--tb-x', `${screenX}px`)
      toolboxRef.value.style.setProperty('--tb-y', `${screenY}px`)
    }
  }

  // Sync with canvas transform
  const { startSync, stopSync } = useCanvasTransformSync(updateTransform, {
    autoStart: false
  })

  // Watch for selection changes
  watch(
    () => canvasStore.getCanvas().state.selectionChanged,
    (changed) => {
      if (changed) {
        if (moreOptionsRestorePending.value || moreOptionsSelectionSignature) {
          moreOptionsRestorePending.value = false
          moreOptionsWasOpenBeforeDrag = false
          if (!moreOptionsOpen.value) {
            moreOptionsSelectionSignature = null
          } else {
            moreOptionsSelectionSignature = buildSelectionSignature(canvasStore)
          }
        }
        updateSelectionBounds()
        canvasStore.getCanvas().state.selectionChanged = false
        if (visible.value) {
          startSync()
        } else {
          stopSync()
        }
      }
    },
    { immediate: true }
  )
  watch(
    () => moreOptionsOpen.value,
    (v) => {
      if (v) {
        moreOptionsSelectionSignature = buildSelectionSignature(canvasStore)
      } else if (!canvasStore.canvas?.state?.draggingItems) {
        moreOptionsSelectionSignature = null
        if (moreOptionsRestorePending.value)
          moreOptionsRestorePending.value = false
      }
    }
  )

  // Watch for dragging state
  watch(
    () => canvasStore.canvas?.state?.draggingItems,
    (dragging) => {
      if (dragging) {
        visible.value = false

        if (moreOptionsOpen.value) {
          const currentSig = buildSelectionSignature(canvasStore)
          if (currentSig !== moreOptionsSelectionSignature) {
            moreOptionsSelectionSignature = null
          }
          moreOptionsWasOpenBeforeDrag = true
          moreOptionsOpen.value = false
          moreOptionsRestorePending.value = !!moreOptionsSelectionSignature
          if (moreOptionsRestorePending.value) {
            forceCloseMoreOptionsSignal.value++
          } else {
            moreOptionsWasOpenBeforeDrag = false
          }
        } else {
          moreOptionsRestorePending.value = false
          moreOptionsWasOpenBeforeDrag = false
        }
      } else {
        requestAnimationFrame(() => {
          updateSelectionBounds()
          const selectionMatches = currentSelectionMatchesSignature(canvasStore)
          const shouldRestore =
            moreOptionsWasOpenBeforeDrag &&
            visible.value &&
            moreOptionsRestorePending.value &&
            selectionMatches

          if (shouldRestore) {
            restoreMoreOptionsSignal.value++
          } else {
            moreOptionsRestorePending.value = false
          }
          moreOptionsWasOpenBeforeDrag = false
        })
      }
    }
  )

  onUnmounted(() => {
    resetMoreOptionsState()
  })

  return {
    visible
  }
}

// External cleanup utility to be called when SelectionToolbox component unmounts
function resetMoreOptionsState() {
  moreOptionsOpen.value = false
  moreOptionsRestorePending.value = false
  moreOptionsWasOpenBeforeDrag = false
  moreOptionsSelectionSignature = null
}
