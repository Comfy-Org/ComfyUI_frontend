/**
 * usePanelDrag — pointer-driven drag for FloatingPanel.
 *
 * Phase 4-C: panels move between 6 preset positions only (no free
 * positioning). During drag, `snapTarget` tracks the closest preset
 * under the pointer. On release, the caller commits the preset.
 *
 * Drag contract:
 * - Starts on header pointerdown; only activates (`isDragging` flips
 *   true) once the pointer moves past `DRAG_THRESHOLD_PX`, so a plain
 *   click on the header doesn't silently re-snap the panel.
 * - Only responds to the pointer that started the drag (activePointerId
 *   filter), so a stray second touch on a multi-touch device can't
 *   hijack or cancel it.
 * - Ends on pointerup / pointercancel / window blur.
 */
import { useEventListener, useWindowFocus } from '@vueuse/core'
import { ref, watch } from 'vue'
import type { Ref } from 'vue'

import type { PanelPreset } from './panelTypes'

// Half of the dock panel's width (see --panel-dock-width: 440px in
// FloatingPanel.vue). Drives preset-center anchor math; keep in sync
// with the CSS variable.
const PANEL_HALF_WIDTH = 220
const DOCK_V_CENTER = 0.5 // fraction of viewport height
const FLOAT_V_OFFSET = 200 // px from top/bottom for float corners
/** Pointer must move at least this far (px) to count as a drag, not a click. */
const DRAG_THRESHOLD_PX = 5

interface PresetAnchor {
  preset: PanelPreset
  x: number
  y: number
}

function presetAnchors(vw: number, vh: number): PresetAnchor[] {
  const rightX = vw - PANEL_HALF_WIDTH
  const leftX = PANEL_HALF_WIDTH
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

  // Non-reactive drag state. These gate handler behavior but don't drive
  // UI, so plain refs would only add re-render churn.
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

  // Always-on window listeners; bail in O(1) if the pointerId doesn't
  // match an active drag. useEventListener auto-removes on scope
  // dispose, replacing the manual addEventListener/removeEventListener
  // bookkeeping in the previous implementation.
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

  // If the window loses focus mid-drag (alt-tab, lock screen, OS-level
  // modal), abandon the drag so we don't leave the panel stuck in drag
  // state waiting for a pointerup that never arrives.
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
    // isDragging + snapTarget stay unchanged until the movement
    // threshold is crossed — so a plain click on the header is a no-op.
    e.preventDefault()
  }

  return {
    isDragging,
    snapTarget,
    onHeaderPointerDown
  }
}
