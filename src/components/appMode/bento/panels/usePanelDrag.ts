/**
 * usePanelDrag — pointer-driven drag for FloatingPanel.
 *
 * Phase 4-C: panels move between 6 preset positions only (no free
 * positioning). During drag, `snapTarget` tracks the closest preset
 * under the pointer. On release, the caller commits the preset.
 */
import { onBeforeUnmount, ref } from 'vue'
import type { Ref } from 'vue'

import type { PanelPreset } from './panelTypes'

const PANEL_HALF_WIDTH = 210 // approx — drives preset-center math
const DOCK_V_CENTER = 0.5 // fraction of viewport height
const FLOAT_V_OFFSET = 200 // px from top/bottom for float corners

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

  let activePointerId: number | null = null
  let capturedEl: HTMLElement | null = null

  function onPointerMove(e: PointerEvent) {
    if (!isDragging.value) return
    snapTarget.value = nearestPreset(e.clientX, e.clientY)
  }

  function endDrag() {
    if (!isDragging.value) return
    isDragging.value = false
    if (capturedEl && activePointerId !== null) {
      try {
        capturedEl.releasePointerCapture(activePointerId)
      } catch {
        // ignore — pointer may already be released
      }
    }
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)

    if (snapTarget.value !== opts.currentPreset.value) {
      opts.onCommit(snapTarget.value)
    }
    activePointerId = null
    capturedEl = null
  }

  function onPointerUp() {
    endDrag()
  }

  function onHeaderPointerDown(e: PointerEvent) {
    // Left button / primary pointer only.
    if (e.button !== 0 && e.pointerType === 'mouse') return
    const target = e.currentTarget as HTMLElement
    activePointerId = e.pointerId
    capturedEl = target
    try {
      target.setPointerCapture(e.pointerId)
    } catch {
      // ignore — some browsers restrict capture on non-touch
    }
    isDragging.value = true
    snapTarget.value = nearestPreset(e.clientX, e.clientY)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
    e.preventDefault()
  }

  onBeforeUnmount(() => {
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerUp)
  })

  return {
    isDragging,
    snapTarget,
    onHeaderPointerDown
  }
}
