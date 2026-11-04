import { useElementHover, useEventListener } from '@vueuse/core'
import { clamp } from 'es-toolkit'
import type { Ref } from 'vue'
import { computed, onScopeDispose, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  normalizeMarqueeRect,
  selectMarqueeIds
} from '@/platform/assets/utils/marqueeSelectionUtil'
import { clipRectToBounds } from '@/utils/mathUtil'
import type { ReadOnlyRectEdges as RectEdges } from '@comfyorg/shared-frontend-utils/geometry'

const DRAG_THRESHOLD_PX = 4
const CARD_SELECTOR = '[data-asset-id]'
const SCROLLER_SELECTOR = '[data-asset-grid-scroller]'
const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a[href], [role="slider"], [role="tab"], [contenteditable]'

interface AssetGridSelectionOptions {
  marqueeContainerRef: Ref<HTMLElement | undefined>
  hoverTargetRef: Ref<HTMLElement | undefined>
  getAssets: () => AssetItem[]
  getSelectedIds: () => string[]
  setSelectedIds: (ids: string[], allAssets: AssetItem[]) => void
  selectAll: (assets: AssetItem[]) => void
  isEnabled?: () => boolean
}

function shiftRectY(rect: RectEdges, dy: number): RectEdges {
  return { ...rect, top: rect.top + dy, bottom: rect.bottom + dy }
}

function isTextEntryTarget(element: Element | null): boolean {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  )
}

export function useAssetGridSelection(options: AssetGridSelectionOptions) {
  const {
    marqueeContainerRef,
    hoverTargetRef,
    getAssets,
    getSelectedIds,
    setSelectedIds,
    selectAll,
    isEnabled = () => true
  } = options

  const marquee = ref<{ rect: RectEdges; visible: RectEdges } | null>(null)
  const isHoveringPanel = useElementHover(hoverTargetRef)

  let startX = 0
  let startY = 0
  let pointerId = 0
  let baseIds: string[] = []
  let isSubtractive = false
  let isTracking = false
  let isDragging = false
  let suppressNextClick = false
  let suppressClickResetTimeout: ReturnType<typeof setTimeout> | null = null
  const dragCards = new Map<string, RectEdges>()
  let dragBounds: DOMRect | null = null
  let dragScroller: HTMLElement | null = null
  let startScrollTop = 0
  let pointerClientX = 0
  let pointerClientY = 0
  let hasPointerSample = false

  function recordRenderedCards(container: HTMLElement, dy: number) {
    for (const el of container.querySelectorAll<HTMLElement>(CARD_SELECTOR)) {
      const id = el.dataset.assetId
      if (id) dragCards.set(id, shiftRectY(el.getBoundingClientRect(), dy))
    }
  }

  function snapshotDrag() {
    const container = marqueeContainerRef.value
    if (!container) return
    dragScroller = container.querySelector<HTMLElement>(SCROLLER_SELECTOR)
    startScrollTop = dragScroller?.scrollTop ?? 0
    dragBounds = (dragScroller ?? container).getBoundingClientRect()
  }

  function applyMarquee(clientX: number, clientY: number) {
    const container = marqueeContainerRef.value
    if (!dragBounds || !container) return
    const dy = (dragScroller?.scrollTop ?? 0) - startScrollTop
    recordRenderedCards(container, dy)
    const pointer = {
      x: clamp(clientX, dragBounds.left, dragBounds.right),
      y: clamp(clientY, dragBounds.top, dragBounds.bottom) + dy
    }
    const contentRect = normalizeMarqueeRect({ x: startX, y: startY }, pointer)
    const rect = shiftRectY(contentRect, -dy)
    marquee.value = { rect, visible: clipRectToBounds(rect, dragBounds) }
    const cards = [...dragCards].map(([id, rect]) => ({ id, rect }))
    setSelectedIds(
      [...selectMarqueeIds(cards, contentRect, baseIds, isSubtractive)],
      getAssets()
    )
  }

  function onScroll() {
    if (!isDragging) return
    requestAnimationFrame(() => {
      if (isDragging) applyMarquee(pointerClientX, pointerClientY)
    })
  }

  function onPointerMove(e: PointerEvent) {
    pointerClientX = e.clientX
    pointerClientY = e.clientY
    hasPointerSample = true
    if (!isTracking) return
    if (
      !isDragging &&
      Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX
    ) {
      return
    }
    if (!isDragging) {
      isDragging = true
      snapshotDrag()
      capturePointer()
    }
    applyMarquee(e.clientX, e.clientY)
  }

  function capturePointer() {
    try {
      marqueeContainerRef.value?.setPointerCapture(pointerId)
    } catch {
      // Stale/invalid pointerId: window listeners still end the drag.
    }
  }

  function endDrag() {
    if (!isTracking) return
    isTracking = false
    marquee.value = null
    dragCards.clear()
    dragBounds = null
    if (isDragging) scheduleSuppressNextClick()
    isDragging = false
  }

  function scheduleSuppressNextClick() {
    suppressNextClick = true
    clearSuppressTimer()
    suppressClickResetTimeout = setTimeout(() => {
      suppressNextClick = false
      suppressClickResetTimeout = null
    }, 0)
  }

  function clearSuppressTimer() {
    if (suppressClickResetTimeout !== null) {
      clearTimeout(suppressClickResetTimeout)
      suppressClickResetTimeout = null
    }
  }

  function preventDragStart(e: Event) {
    if (isTracking) e.preventDefault()
  }

  function preventTextSelection(e: Event) {
    if (!isTracking) return
    const container = marqueeContainerRef.value
    if (container && e.target instanceof Node && container.contains(e.target)) {
      e.preventDefault()
    }
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    if (isTracking) return
    if (!isEnabled()) return
    suppressNextClick = false
    clearSuppressTimer()
    const container = marqueeContainerRef.value
    if (!container) return
    if (!container.querySelector(CARD_SELECTOR)) return
    const target = e.target
    if (!(target instanceof HTMLElement)) return
    if (target.closest(INTERACTIVE_SELECTOR)) return

    const onCard = target.closest(CARD_SELECTOR)
    if (onCard && !e.ctrlKey && !e.metaKey) return

    startX = e.clientX
    startY = e.clientY
    pointerId = e.pointerId
    baseIds = e.shiftKey || e.ctrlKey || e.metaKey ? getSelectedIds() : []
    isSubtractive = (e.ctrlKey || e.metaKey) && e.shiftKey
    isDragging = false
    isTracking = true
  }

  function onClickCapture(e: MouseEvent) {
    if (!suppressNextClick) return
    suppressNextClick = false
    clearSuppressTimer()
    e.stopImmediatePropagation()
    e.preventDefault()
  }

  // useElementHover latches stale-false when an overlay under the cursor (the
  // selection bar) unmounts on "deselect all"; recheck the live pointer against
  // the panel rect so Ctrl/Cmd+A still resolves against the panel it is over.
  function isPointerInsidePanel(): boolean {
    const el = hoverTargetRef.value
    if (!el || !hasPointerSample) return false
    const { left, top, right, bottom } = el.getBoundingClientRect()
    return (
      pointerClientX >= left &&
      pointerClientX <= right &&
      pointerClientY >= top &&
      pointerClientY <= bottom
    )
  }

  function onKeydown(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'a' && e.key !== 'A')) return
    if (
      !(isHoveringPanel.value || isPointerInsidePanel()) ||
      isTextEntryTarget(document.activeElement) ||
      document.querySelector('[role="dialog"][aria-modal="true"]')
    ) {
      return
    }
    e.preventDefault()
    e.stopImmediatePropagation()
    selectAll(getAssets())
  }

  useEventListener(marqueeContainerRef, 'pointerdown', onPointerDown)
  useEventListener(marqueeContainerRef, 'dragstart', preventDragStart, {
    capture: true
  })
  useEventListener(window, 'pointermove', onPointerMove)
  useEventListener(window, ['pointerup', 'pointercancel', 'dragend'], endDrag)
  useEventListener(window, 'click', onClickCapture, { capture: true })
  useEventListener(window, 'scroll', onScroll, { capture: true, passive: true })
  useEventListener(window, 'keydown', onKeydown, { capture: true })
  useEventListener(window, 'selectstart', preventTextSelection, {
    capture: true
  })

  onScopeDispose(clearSuppressTimer)

  const marqueeStyle = computed(() => {
    if (!marquee.value) return null
    const { rect, visible } = marquee.value
    return {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.right - rect.left}px`,
      height: `${rect.bottom - rect.top}px`,
      clipPath: `inset(${visible.top - rect.top}px ${rect.right - visible.right}px ${rect.bottom - visible.bottom}px ${visible.left - rect.left}px)`
    }
  })

  return { marqueeStyle }
}
