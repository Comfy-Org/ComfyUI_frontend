/**
 * Pointer-driven drag for FloatingPanel between fixed presets.
 * `snapTarget` tracks the nearest preset under the pointer; caller
 * commits on release.
 */
import { ref } from 'vue'
import type { Ref } from 'vue'

import type { PanelPreset } from './panelTypes'
import { usePointerDrag } from './usePointerDrag'

const DOCK_V_CENTER = 0.5 // fraction of viewport height
const FLOAT_V_OFFSET = 200 // px from top/bottom for float corners
const DRAG_THRESHOLD_PX = 5
// Fallback if --panel-dock-width can't be read (SSR / token missing).
const PANEL_WIDTH_FALLBACK = 440

interface PresetAnchor {
  preset: PanelPreset
  x: number
  y: number
}

// Returns NaN when unavailable so callers can apply their own fallback.
function readRootVarPx(name: string): number {
  if (typeof document === 'undefined') return NaN
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim()
  return parseFloat(raw)
}

function readSidebarWidth(): number {
  const n = readRootVarPx('--sidebar-width')
  return Number.isFinite(n) ? n : 0
}

function readPanelHalfWidth(): number {
  const n = readRootVarPx('--panel-dock-width')
  return (Number.isFinite(n) ? n : PANEL_WIDTH_FALLBACK) / 2
}

function presetAnchors(vw: number, vh: number): PresetAnchor[] {
  const halfWidth = readPanelHalfWidth()
  const rightX = vw - halfWidth
  const leftX = readSidebarWidth() + halfWidth
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
