import type { CSSProperties, Ref } from 'vue'
import { computed, onScopeDispose, ref } from 'vue'
import { useElementHover, useEventListener } from '@vueuse/core'

import type { AssetId, AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { Point, RectEdges } from '@/utils/mathUtil'
import {
  clampRectToBounds,
  getRectFromPoints,
  hasRectArea,
  rectsIntersect
} from '@/utils/mathUtil'

type ReadonlyRef<T> = Readonly<Ref<T>>

type MarqueeDragState = {
  pointerId: number
  captureTarget: HTMLElement | null
  start: Point
  current: Point
  startTarget: EventTarget | null
  baseSelection: AssetId[]
  hasDragged: boolean
}

type UseAssetMarqueeSelectionOptions = {
  assetPanelRef: Ref<HTMLElement | null>
  isListView: ReadonlyRef<boolean>
  showLoadingState: ReadonlyRef<boolean>
  showEmptyState: ReadonlyRef<boolean>
  visibleAssets: ReadonlyRef<AssetItem[]>
  selectedIds: ReadonlyRef<ReadonlySet<AssetId>>
  selectAll: (assets: AssetItem[]) => void
  setSelectedIds: (ids: AssetId[], allAssets: AssetItem[]) => void
}

const MARQUEE_DRAG_THRESHOLD = 4
const MARQUEE_ASSET_SELECTOR = '[data-asset-id]'

export function useAssetMarqueeSelection({
  assetPanelRef,
  isListView,
  showLoadingState,
  showEmptyState,
  visibleAssets,
  selectedIds,
  selectAll,
  setSelectedIds
}: UseAssetMarqueeSelectionOptions) {
  const isPointerOverAssetsPanel = useElementHover(assetPanelRef)
  const marqueeDrag = ref<MarqueeDragState | null>(null)
  const shouldSuppressNextPanelClick = ref(false)
  let suppressClickResetTimeout: number | null = null

  const isMarqueeSelecting = computed(
    () => marqueeDrag.value?.hasDragged ?? false
  )

  const marqueeStyle = computed<CSSProperties>(() => {
    const marqueeRect = getClippedMarqueeRect()
    if (!marqueeRect) return {}

    return {
      left: `${marqueeRect.left}px`,
      top: `${marqueeRect.top}px`,
      width: `${marqueeRect.right - marqueeRect.left}px`,
      height: `${marqueeRect.bottom - marqueeRect.top}px`
    }
  })

  function handleAssetPanelClickCapture(event: MouseEvent) {
    if (!shouldSuppressNextPanelClick.value) {
      return
    }

    event.preventDefault()
    event.stopImmediatePropagation()
    resetSuppressedClick()
  }

  function handleAssetPanelDragStartCapture(event: DragEvent) {
    if (marqueeDrag.value) {
      event.preventDefault()
    }
  }

  function handleMarqueePointerDown(event: PointerEvent) {
    if (marqueeDrag.value) {
      return
    }

    resetSuppressedClick()

    if (
      isListView.value ||
      event.button !== 0 ||
      showLoadingState.value ||
      showEmptyState.value
    ) {
      return
    }

    if (
      event.target instanceof Element &&
      event.target.closest(MARQUEE_ASSET_SELECTOR) &&
      !event.ctrlKey &&
      !event.metaKey
    ) {
      return
    }

    const start = { x: event.clientX, y: event.clientY }
    const pointerId = event.pointerId
    marqueeDrag.value = {
      pointerId,
      captureTarget: capturePointer(assetPanelRef.value, pointerId),
      start,
      current: start,
      startTarget: event.target,
      baseSelection:
        event.shiftKey || event.ctrlKey || event.metaKey
          ? Array.from(selectedIds.value)
          : [],
      hasDragged: false
    }
  }

  function handleMarqueePointerMove(event: PointerEvent) {
    const drag = marqueeDrag.value
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    drag.current = { x: event.clientX, y: event.clientY }

    if (
      !drag.hasDragged &&
      Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) <
        MARQUEE_DRAG_THRESHOLD
    ) {
      return
    }

    event.preventDefault()
    drag.hasDragged = true
    shouldSuppressNextPanelClick.value = true
    clearNativeTextSelection(drag.startTarget)
    setSelectedIds(getMarqueeAssetIds(), visibleAssets.value)
  }

  function handleMarqueePointerUp(event: PointerEvent) {
    const drag = marqueeDrag.value
    if (!drag || drag.pointerId !== event.pointerId) {
      return
    }

    if (drag.hasDragged) {
      event.preventDefault()
      clearNativeTextSelection(drag.startTarget)
      setSelectedIds(getMarqueeAssetIds(), visibleAssets.value)
      scheduleSuppressClickReset()
    }

    clearMarqueeDrag()
  }

  function handleMarqueePointerCancel(event: PointerEvent) {
    if (marqueeDrag.value?.pointerId === event.pointerId) {
      resetSuppressedClick()
      clearMarqueeDrag()
    }
  }

  function handleDocumentSelectStart(event: Event) {
    const panel = assetPanelRef.value
    if (
      !marqueeDrag.value ||
      !panel ||
      !(event.target instanceof Node) ||
      !panel.contains(event.target)
    ) {
      return
    }

    event.preventDefault()
  }

  function handleAssetPanelKeydown(event: KeyboardEvent) {
    const isSelectAllShortcut =
      (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a'

    if (
      isSelectAllShortcut &&
      isPointerOverAssetsPanel.value &&
      !isEditableTarget(document.activeElement) &&
      !document.querySelector('[role="dialog"][aria-modal="true"]')
    ) {
      event.preventDefault()
      event.stopImmediatePropagation()
      selectAll(visibleAssets.value)
    }
  }

  function getClippedMarqueeRect(): RectEdges | null {
    const panel = assetPanelRef.value
    const drag = marqueeDrag.value
    if (!panel || !drag) return null

    const clipped = clampRectToBounds(
      getRectFromPoints(drag.start, drag.current),
      panel.getBoundingClientRect()
    )
    return hasRectArea(clipped) ? clipped : null
  }

  function getMarqueeAssetIds(): AssetId[] {
    const drag = marqueeDrag.value
    const panel = assetPanelRef.value
    const marqueeRect = getClippedMarqueeRect()
    if (!panel || !marqueeRect) return []

    const assetIds = new Set(drag?.baseSelection ?? [])
    for (const assetElement of panel.querySelectorAll<HTMLElement>(
      MARQUEE_ASSET_SELECTOR
    )) {
      const assetId = assetElement.dataset.assetId
      if (
        assetId &&
        rectsIntersect(marqueeRect, assetElement.getBoundingClientRect())
      ) {
        assetIds.add(assetId)
      }
    }

    return visibleAssets.value
      .filter((asset) => assetIds.has(asset.id))
      .map((asset) => asset.id)
  }

  function resetSuppressedClick() {
    clearTimeoutIfSet(suppressClickResetTimeout)
    suppressClickResetTimeout = null
    shouldSuppressNextPanelClick.value = false
  }

  function scheduleSuppressClickReset() {
    clearTimeoutIfSet(suppressClickResetTimeout)
    suppressClickResetTimeout = window.setTimeout(() => {
      suppressClickResetTimeout = null
      shouldSuppressNextPanelClick.value = false
    }, 0)
  }

  function clearMarqueeDrag() {
    const drag = marqueeDrag.value
    if (drag) {
      releasePointerCapture(drag.captureTarget, drag.pointerId)
    }
    marqueeDrag.value = null
  }

  useEventListener(window, 'pointermove', handleMarqueePointerMove, {
    capture: true
  })
  useEventListener(window, 'pointerup', handleMarqueePointerUp, {
    capture: true
  })
  useEventListener(window, 'pointercancel', handleMarqueePointerCancel, {
    capture: true
  })
  useEventListener(window, 'selectstart', handleDocumentSelectStart, {
    capture: true
  })
  useEventListener(window, 'keydown', handleAssetPanelKeydown, {
    capture: true
  })
  onScopeDispose(() => {
    clearMarqueeDrag()
    resetSuppressedClick()
  })

  return {
    isMarqueeSelecting,
    marqueeStyle,
    handleAssetPanelClickCapture,
    handleAssetPanelDragStartCapture,
    handleMarqueePointerDown
  }
}

function clearTimeoutIfSet(timeout: number | null) {
  if (timeout !== null) {
    window.clearTimeout(timeout)
  }
}

function capturePointer(target: HTMLElement | null, pointerId: number) {
  if (!target) return null

  try {
    target.setPointerCapture(pointerId)
    return target
  } catch {
    return null
  }
}

function releasePointerCapture(target: HTMLElement | null, pointerId: number) {
  if (!target) return

  try {
    if (target.hasPointerCapture(pointerId)) {
      target.releasePointerCapture(pointerId)
    }
  } catch {
    target.releasePointerCapture(pointerId)
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.isContentEditable ||
    target.matches('input, textarea, select, [role="textbox"]')
  )
}

function clearNativeTextSelection(target: EventTarget | null) {
  window.getSelection()?.removeAllRanges()

  if (
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement &&
      ['password', 'search', 'tel', 'text', 'url'].includes(target.type))
  ) {
    const end = target.value.length
    target.setSelectionRange(end, end)
  }
}
