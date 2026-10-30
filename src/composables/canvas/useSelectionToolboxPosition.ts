import {
  TransitionPresets,
  useElementBounding,
  useEventListener,
  usePreferredReducedMotion,
  useRafFn,
  useTransition
} from '@vueuse/core'
import { computed, onUnmounted, ref, watch, watchEffect } from 'vue'
import type { Ref } from 'vue'

import { useSelectedLiteGraphItems } from '@/composables/canvas/useSelectedLiteGraphItems'
import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import type { Positionable } from '@comfyorg/graph-model/interfaces'
import type {
  ReadOnlyRect,
  Rect,
  Point2D as Point
} from '@comfyorg/shared-frontend-utils/geometry'
import { getSelectedLinksAnchor } from '@/lib/litegraph/src/canvas/linkSelection'
import { LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLinkSelectionStore } from '@/stores/linkSelectionStore'
import { isLGraphGroup, isLGraphNode } from '@/utils/litegraphUtil'
import { computeUnionBounds } from '@/utils/mathUtil'

/**
 * Manages the position of the selection toolbox independently.
 * Uses CSS custom properties for performant transform updates.
 */

// Shared signals for auxiliary UI (e.g., MoreOptions) to coordinate hide/restore
const moreOptionsOpen = ref(false)
const forceCloseMoreOptionsSignal = ref(0)
const restoreMoreOptionsSignal = ref(0)
const moreOptionsRestorePending = ref(false)
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

function getSelectionBounds(item: LGraphNode | LGraphGroup): ReadOnlyRect {
  if (item instanceof LGraphGroup) return item.boundingRect

  const bounds: Rect = [0, 0, 0, 0]
  item.measure(bounds)
  return bounds
}

const SELECTION_BOUNDS_PADDING = 10
const LIFT_DURATION_MS = 200
const LINK_ANCHOR_GAP = 10

export function useSelectionToolboxPosition(
  toolboxRef: Ref<HTMLElement | undefined>,
  lift: Ref<number>
) {
  const canvasStore = useCanvasStore()
  const lgCanvas = canvasStore.getCanvas()
  const { getSelectableItems } = useSelectedLiteGraphItems()
  const { shouldRenderVueNodes } = useVueFeatureFlags()
  const isDraggingLiteGraphItems = ref(lgCanvas.isDragging)
  const linkSelectionStore = useLinkSelectionStore()
  const motionPreference = usePreferredReducedMotion()
  const easedLift = useTransition(lift, {
    duration: computed(() =>
      motionPreference.value === 'reduce' ? 0 : LIFT_DURATION_MS
    ),
    easing: TransitionPresets.easeOutQuint
  })
  const isLifted = computed(() => lift.value !== 0 || easedLift.value !== 0)
  let anchoredItems: ReadonlySet<Positionable> = new Set()
  let anchoredLinks = linkSelectionStore.selection

  useEventListener(
    lgCanvas.canvas,
    'litegraph:dragging-items-changed',
    (event: CustomEvent<{ dragging: boolean }>) => {
      isDraggingLiteGraphItems.value = event.detail.dragging
    }
  )

  const worldPosition = ref({ x: 0, y: 0 })

  const visible = ref(false)

  const { left: canvasLeft, top: canvasTop } = useElementBounding(
    lgCanvas.canvas
  )

  const isDragging = computed((): boolean => {
    const vueNodeDragging =
      shouldRenderVueNodes.value && layoutStore.isDraggingVueNodes.value
    return isDraggingLiteGraphItems.value || vueNodeDragging
  })

  function itemsAnchor(items: Set<unknown>): Point | undefined {
    const bounds = computeUnionBounds(
      [...items].flatMap((item) =>
        item instanceof LGraphNode || item instanceof LGraphGroup
          ? [getSelectionBounds(item)]
          : []
      )
    )
    return bounds
      ? {
          x: bounds.x + bounds.width / 2,
          y: bounds.y - SELECTION_BOUNDS_PADDING
        }
      : undefined
  }

  function selectionAnchor(): Point | undefined {
    const items = getSelectableItems()
    if (items.size) return itemsAnchor(items)
    const linkAnchor = lgCanvas.graph && getSelectedLinksAnchor(lgCanvas.graph)
    return linkAnchor
      ? { x: linkAnchor.x, y: linkAnchor.y - LINK_ANCHOR_GAP }
      : undefined
  }

  const isNewSelection = () => {
    const items = canvasStore.selectedItems
    return (
      linkSelectionStore.selection !== anchoredLinks ||
      items.length !== anchoredItems.size ||
      items.some((item) => !anchoredItems.has(item))
    )
  }

  const shouldReanchor = () =>
    !visible.value || !isLifted.value || (lift.value === 0 && isNewSelection())

  const updateSelectionBounds = () => {
    const anchor = selectionAnchor()

    if (!anchor || isDragging.value) {
      visible.value = false
      anchoredItems = new Set()
      anchoredLinks = null
      return
    }

    if (shouldReanchor()) {
      worldPosition.value = anchor
      anchoredItems = new Set(canvasStore.selectedItems)
      anchoredLinks = linkSelectionStore.selection
    }
    visible.value = true

    updateTransform()
  }

  const updateTransform = () => {
    if (!visible.value) return

    const { scale, offset } = lgCanvas.ds

    const screenX =
      (worldPosition.value.x + offset[0]) * scale + canvasLeft.value
    const screenY =
      (worldPosition.value.y + offset[1]) * scale +
      canvasTop.value -
      easedLift.value

    if (toolboxRef.value) {
      toolboxRef.value.style.setProperty('--tb-x', `${screenX}px`)
      toolboxRef.value.style.setProperty('--tb-y', `${screenY}px`)
    }
  }

  const { resume: startSync, pause: stopSync } = useRafFn(updateTransform)

  watchEffect(() => {
    if (visible.value) {
      startSync()
    } else {
      stopSync()
    }
  })

  const handleSelectionMembershipChange = () => {
    if (!moreOptionsRestorePending.value && !moreOptionsSelectionSignature)
      return

    moreOptionsRestorePending.value = false
    moreOptionsWasOpenBeforeDrag = false
    moreOptionsSelectionSignature = moreOptionsOpen.value
      ? buildSelectionSignature(canvasStore)
      : null
  }

  watch(
    [
      () => canvasStore.selectedItems,
      () => layoutStore.layoutVersion,
      () => linkSelectionStore.selection
    ],
    ([selectedItems], [previousSelectedItems]) => {
      if (selectedItems !== previousSelectedItems)
        handleSelectionMembershipChange()
      updateSelectionBounds()
    },
    { immediate: true }
  )
  watch(
    () => moreOptionsOpen.value,
    (v) => {
      if (v) {
        moreOptionsSelectionSignature = buildSelectionSignature(canvasStore)
      } else if (!isDraggingLiteGraphItems.value) {
        moreOptionsSelectionSignature = null
        if (moreOptionsRestorePending.value)
          moreOptionsRestorePending.value = false
      }
    }
  )

  const handleDragStateChange = (dragging: boolean) => {
    if (dragging) {
      handleDragStart()
      return
    }

    handleDragEnd()
  }

  const handleDragStart = () => {
    visible.value = false

    if (!moreOptionsOpen.value) {
      moreOptionsRestorePending.value = false
      moreOptionsWasOpenBeforeDrag = false
      return
    }

    const currentSig = buildSelectionSignature(canvasStore)
    const selectionChanged = currentSig !== moreOptionsSelectionSignature

    if (selectionChanged) {
      moreOptionsSelectionSignature = null
    }
    moreOptionsOpen.value = false
    moreOptionsWasOpenBeforeDrag = true
    moreOptionsRestorePending.value = !!moreOptionsSelectionSignature

    if (moreOptionsRestorePending.value) {
      forceCloseMoreOptionsSignal.value++
      return
    }

    moreOptionsWasOpenBeforeDrag = false
  }

  const handleDragEnd = () => {
    requestAnimationFrame(() => {
      updateSelectionBounds()

      const selectionMatches = currentSelectionMatchesSignature(canvasStore)
      const shouldRestore =
        moreOptionsWasOpenBeforeDrag &&
        visible.value &&
        moreOptionsRestorePending.value &&
        selectionMatches

      moreOptionsRestorePending.value =
        shouldRestore && moreOptionsRestorePending.value
      moreOptionsWasOpenBeforeDrag = false

      if (shouldRestore) {
        restoreMoreOptionsSignal.value++
      }
    })
  }

  watch(isDragging, handleDragStateChange)

  watch([lift, isLifted], updateSelectionBounds)

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
