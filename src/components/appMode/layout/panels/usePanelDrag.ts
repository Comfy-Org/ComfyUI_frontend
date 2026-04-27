/**
 * Pointer-driven drag for FloatingPanel between 6 fixed presets (no
 * free positioning). `snapTarget` tracks the nearest preset under the
 * pointer; the caller commits on release. Drag activates only after
 * the pointer moves past `DRAG_THRESHOLD_PX` so a plain click on the
 * header is a no-op. Window blur abandons the drag so it can't get
 * stuck waiting for a pointerup that never arrives.
 */
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { PanelPreset } from './panelTypes'

// Half the dock panel width (matches --panel-dock-width: 440px).
// Drives preset-center anchor math; keep in sync with the CSS var.
const PANEL_HALF_WIDTH = 220
const DOCK_V_CENTER = 0.5 // fraction of viewport height
const FLOAT_V_OFFSET = 200 // px from top/bottom for float corners
/** Pointer must move this far before a press counts as a drag. */
const DRAG_THRESHOLD_PX = 5

interface PresetAnchor {
  preset: PanelPreset
  x: number
  y: number
}

// Snap-target math mirrors the CSS sidebar offset (see panelPresetClasses)
// so hovering near a left-anchored landing point actually snaps to it.
function readSidebarWidth(): number {
  if (typeof document === 'undefined') return 0
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--sidebar-width')
    .trim()
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 0
}

function presetAnchors(vw: number, vh: number): PresetAnchor[] {
  const rightX = vw - PANEL_HALF_WIDTH
  const leftX = readSidebarWidth() + PANEL_HALF_WIDTH
  return [
    { preset: 'right-dock', x: rightX, y: vh * DOCK_V_CENTER },
    { preset: 'left-dock', x: leftX, y: vh * DOCK_V_CENTER },
    { preset: 'float-tr', x: rightX, y: FLOAT_V_OFFSET },
    { preset: 'float-br', x: rightX, y: vh - FLOAT_V_OFFSET },
    { preset: 'float-tl', x: leftX, y: FLOAT_V_OFFSET },
    { preset: 'float-bl', x: leftX, y: vh - FLOAT_V_OFFSET }
  ]
}

function nearestPreset(pointerX: number, pointerY: number): PanelPreset {
  const anchors = presetAnchors(window.innerWidth, window.innerHeight)
  let best = anchors[0]
  let bestDist = Infinity
  for (const a of anchors) {
    const dx = a.x - pointerX
    const dy = a.y - pointerY
    const d = dx * dx + dy * dy
    if (d < bestDist) {
      bestDist = d
      best = a
    }
  }
  return best.preset
}

interface UsePanelDragOptions {
  /** Currently-committed preset. Displayed while not dragging. */
  currentPreset: Ref<PanelPreset>
  /** Called on pointerup when the snap target differs from current. */
  onCommit: (preset: PanelPreset) => void
}

export function usePanelDrag(opts: UsePanelDragOptions) {
  const isDragging = ref(false)
  const snapTarget = ref<PanelPreset>(opts.currentPreset.value)

  // Non-reactive — these gate handler behavior, not UI.
  let activePointerId: number | null = null
  let capturedEl: HTMLElement | null = null
  let startX = 0
  let startY = 0
  let movedFarEnough = false

  function isOurPointer(e: PointerEvent): boolean {
    return activePointerId !== null && e.pointerId === activePointerId
  }

  function reset() {
    isDragging.value = false
    if (capturedEl && activePointerId !== null) {
      try {
        capturedEl.releasePointerCapture(activePointerId)
      } catch {
        // ignore — pointer may already be released
      }
    }
    activePointerId = null
    capturedEl = null
    movedFarEnough = false
  }

  // Always-on; bails O(1) on non-matching pointers.
  useEventListener(window, 'pointermove', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    if (!movedFarEnough) {
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return
      movedFarEnough = true
      isDragging.value = true
    }
    snapTarget.value = nearestPreset(e.clientX, e.clientY)
  })

  useEventListener(window, 'pointerup', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    const shouldCommit =
      movedFarEnough && snapTarget.value !== opts.currentPreset.value
    reset()
    if (shouldCommit) opts.onCommit(snapTarget.value)
  })

  useEventListener(window, 'pointercancel', (e: PointerEvent) => {
    if (!isOurPointer(e)) return
    reset()
  })

  const focused = useWindowFocus()
  watch(focused, (nowFocused) => {
    if (!nowFocused && activePointerId !== null) reset()
  })

  function onHeaderPointerDown(e: PointerEvent) {
    // Primary button (mouse) or any non-mouse pointer (touch, pen).
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.currentTarget as HTMLElement
    activePointerId = e.pointerId
    capturedEl = target
    startX = e.clientX
    startY = e.clientY
    movedFarEnough = false
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // ignore — some browsers restrict capture on non-touch
    }
    e.preventDefault()
    // Stop bubbling so LayoutView's pan handler doesn't also fire.
    e.stopPropagation()
  }

  return {
    isDragging,
    snapTarget,
    onHeaderPointerDown
  }
}
