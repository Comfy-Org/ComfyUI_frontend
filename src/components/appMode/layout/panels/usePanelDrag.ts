/**
 * Pointer-driven drag for FloatingPanel between 6 fixed presets.
 * `snapTarget` tracks the nearest preset under the pointer; the
 * caller commits on release. Drag activates only after the pointer
 * moves past `DRAG_THRESHOLD_PX` so a click on the header is a no-op.
 */
import { ref } from 'vue';
import type { Ref } from 'vue';

import type { PanelPreset } from './panelTypes'
import { usePointerDrag } from './usePointerDrag'

// Half the dock panel width (matches --panel-dock-width: 440px).
const PANEL_HALF_WIDTH = 220
const DOCK_V_CENTER = 0.5 // fraction of viewport height
const FLOAT_V_OFFSET = 200 // px from top/bottom for float corners
const DRAG_THRESHOLD_PX = 5

interface PresetAnchor {
  preset: PanelPreset
  x: number
  y: number
}

// Mirrors the CSS sidebar offset (panelPresetClasses) so hovering near
// a left-anchored landing point actually snaps to it.
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
  /** Currently-committed preset. */
  currentPreset: Ref<PanelPreset>
  /** Called on pointerup when the snap target differs from current. */
  onCommit: (preset: PanelPreset) => void
}

export function usePanelDrag(opts: UsePanelDragOptions) {
  const snapTarget = ref<PanelPreset>(opts.currentPreset.value)

  const { isDragging, start: onHeaderPointerDown } = usePointerDrag({
    threshold: DRAG_THRESHOLD_PX,
    stopPropagation: true,
    // Primary button (mouse) or any non-mouse pointer (touch / pen).
    onStart: (e) => !(e.button !== 0 && e.pointerType === 'mouse'),
    onMove: (e) => {
      snapTarget.value = nearestPreset(e.clientX, e.clientY)
    },
    onCommit: () => {
      if (snapTarget.value !== opts.currentPreset.value) {
        opts.onCommit(snapTarget.value)
      }
    }
  })

  return { isDragging, snapTarget, onHeaderPointerDown }
}
