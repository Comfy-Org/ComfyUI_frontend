import { useElementHover, useEventListener } from '@vueuse/core'
import type { Ref } from 'vue'
import { computed, onScopeDispose, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { Box } from '@/platform/assets/utils/marqueeSelectionUtil'
import {
  normalizeMarqueeRect,
  selectMarqueeIds
} from '@/platform/assets/utils/marqueeSelectionUtil'
import { clampRectToBounds } from '@/utils/mathUtil'

const DRAG_THRESHOLD_PX = 4
const CARD_SELECTOR = '[data-asset-id]'
const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, a[href], [role="slider"], [role="tab"], [contenteditable]'

interface AssetGridSelectionOptions {
  marqueeContainerRef: Ref<HTMLElement | undefined>
  hoverTargetRef: Ref<HTMLElement | undefined>
  getAssets: () => AssetItem[]
  getSelectedIds: () => string[]
  setSelectedIds: (ids: string[], allAssets: AssetItem[]) => void
  selectAll: (assets: AssetItem[]) => void
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
    selectAll
  } = options

  const marqueeRect = ref<Box | null>(null)
  const isHoveringPanel = useElementHover(hoverTargetRef)

  let startX = 0
  let startY = 0
  let baseIds: string[] = []
  let isTracking = false
  let isDragging = false
  let suppressNextClick = false
  let priorBodyUserSelect = ''

  function collectCards(container: HTMLElement) {
    return [...container.querySelectorAll<HTMLElement>(CARD_SELECTOR)].flatMap(
      (el) => {
        const id = el.dataset.assetId
        return id ? [{ id, rect: el.getBoundingClientRect() }] : []
      }
    )
  }

  function applyMarquee(clientX: number, clientY: number) {
    const container = marqueeContainerRef.value
    if (!container) return
    const rect = clampRectToBounds(
      normalizeMarqueeRect(
        { x: startX, y: startY },
        { x: clientX, y: clientY }
      ),
      container.getBoundingClientRect()
    )
    marqueeRect.value = rect
    setSelectedIds(
      [...selectMarqueeIds(collectCards(container), rect, baseIds)],
      getAssets()
    )
  }

  function onPointerMove(e: PointerEvent) {
    if (!isTracking) return
    if (
      !isDragging &&
      Math.hypot(e.clientX - startX, e.clientY - startY) < DRAG_THRESHOLD_PX
    ) {
      return
    }
    isDragging = true
    applyMarquee(e.clientX, e.clientY)
  }

  function endDrag() {
    if (!isTracking) return
    isTracking = false
    document.body.style.userSelect = priorBodyUserSelect
    marqueeRect.value = null
    if (isDragging) suppressNextClick = true
    isDragging = false
  }

  function preventDragStart(e: Event) {
    if (isTracking) e.preventDefault()
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return
    if (isTracking) return
    suppressNextClick = false
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
    baseIds = e.shiftKey || e.ctrlKey || e.metaKey ? getSelectedIds() : []
    isDragging = false
    isTracking = true
    container.setPointerCapture(e.pointerId)
    priorBodyUserSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
  }

  function onClickCapture(e: MouseEvent) {
    if (!suppressNextClick) return
    suppressNextClick = false
    e.stopImmediatePropagation()
    e.preventDefault()
  }

  function onKeydown(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || (e.key !== 'a' && e.key !== 'A')) return
    if (!isHoveringPanel.value || isTextEntryTarget(document.activeElement)) {
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
  useEventListener(window, 'keydown', onKeydown, { capture: true })

  onScopeDispose(() => {
    if (isTracking) document.body.style.userSelect = priorBodyUserSelect
  })

  const marqueeStyle = computed(() => {
    const rect = marqueeRect.value
    if (!rect) return null
    return {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.right - rect.left}px`,
      height: `${rect.bottom - rect.top}px`
    }
  })

  return { marqueeStyle }
}
