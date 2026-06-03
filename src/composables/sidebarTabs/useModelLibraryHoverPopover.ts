import { useEventListener, useResizeObserver } from '@vueuse/core'
import type { CSSProperties, Ref } from 'vue'
import { nextTick, onBeforeUnmount, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

// Single shared hover popover, owned by the sidebar tab. Leaves emit
// `hover-change` with their row rect; we position the popover next to the
// row, swap content as the user moves between rows (no stacking), and
// support the row → popover mouse bridge with a short hide delay.
const HOVER_BRIDGE_DELAY_MS = 120
const HOVER_GAP_PX = 12
const HOVER_VIEWPORT_MARGIN_PX = 8

type HoveredItem =
  | { kind: 'asset'; asset: AssetItem; rect: DOMRect }
  | { kind: 'partner'; nodeDef: ComfyNodeDefImpl; rect: DOMRect }

export function useModelLibraryHoverPopover(
  hoverPopoverRef: Ref<HTMLElement | null>
) {
  const hoveredItem = ref<HoveredItem | null>(null)
  const hoverPopoverStyle = ref<CSSProperties>({ top: '0px', left: '0px' })

  let hoverHideTimer: ReturnType<typeof setTimeout> | null = null
  function cancelHoverHide() {
    if (hoverHideTimer !== null) {
      clearTimeout(hoverHideTimer)
      hoverHideTimer = null
    }
  }
  function scheduleHoverHide() {
    cancelHoverHide()
    hoverHideTimer = setTimeout(() => {
      hoveredItem.value = null
      hoverHideTimer = null
    }, HOVER_BRIDGE_DELAY_MS)
  }

  async function updateHoverPopoverPosition() {
    const rect = hoveredItem.value?.rect
    if (!rect) return
    await nextTick()
    const el = hoverPopoverRef.value
    const popoverHeight = el?.offsetHeight ?? 240
    const minTop = HOVER_VIEWPORT_MARGIN_PX
    const maxTop = Math.max(
      minTop,
      window.innerHeight - popoverHeight - HOVER_VIEWPORT_MARGIN_PX
    )
    const top = Math.max(minTop, Math.min(rect.top, maxTop))
    hoverPopoverStyle.value = {
      top: `${top}px`,
      left: `${rect.right + HOVER_GAP_PX}px`
    }
  }

  function handleAssetHoverChange(
    payload: { asset: AssetItem; rect: DOMRect } | { asset: null }
  ) {
    if (payload.asset) {
      cancelHoverHide()
      hoveredItem.value = {
        kind: 'asset',
        asset: payload.asset,
        rect: payload.rect
      }
      void updateHoverPopoverPosition()
    } else {
      scheduleHoverHide()
    }
  }
  function handlePartnerHoverChange(
    payload: { nodeDef: ComfyNodeDefImpl; rect: DOMRect } | { nodeDef: null }
  ) {
    if (payload.nodeDef) {
      cancelHoverHide()
      hoveredItem.value = {
        kind: 'partner',
        nodeDef: payload.nodeDef,
        rect: payload.rect
      }
      void updateHoverPopoverPosition()
    } else {
      scheduleHoverHide()
    }
  }
  function handlePopoverEnter() {
    cancelHoverHide()
  }
  function handlePopoverLeave() {
    scheduleHoverHide()
  }

  useResizeObserver(hoverPopoverRef, () => {
    void updateHoverPopoverPosition()
  })
  useEventListener(window, 'resize', () => {
    void updateHoverPopoverPosition()
  })
  useEventListener(
    window,
    'scroll',
    () => {
      void updateHoverPopoverPosition()
    },
    true
  )

  onBeforeUnmount(() => {
    cancelHoverHide()
  })

  return {
    hoveredItem,
    hoverPopoverStyle,
    handleAssetHoverChange,
    handlePartnerHoverChange,
    handlePopoverEnter,
    handlePopoverLeave
  }
}
