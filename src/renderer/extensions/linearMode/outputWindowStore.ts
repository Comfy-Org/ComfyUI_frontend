import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { useAppModeStore } from '@/stores/appModeStore'
import type { ResultItemImpl } from '@/stores/queueStore'

/**
 * One floating output window. Fed by linearOutputStore's in-progress
 * items; persists after the source item is absorbed (moodboard).
 */
export interface OutputWindowEntry {
  id: string
  jobId?: string
  state: 'skeleton' | 'latent' | 'image'
  latentPreviewUrl?: string
  output?: ResultItemImpl
  /** Populated by useOutputWindowSync. */
  asset?: AssetItem
  /** Workspace coordinates (pre-transform). */
  position: { x: number; y: number }
  /** User-set dimensions; undefined = auto-fit / default. */
  width?: number
  height?: number
  /** Image natural aspect (w/h); populated when the output url loads. */
  aspect?: number
  zIndex: number
}

const SPAWN_ANCHOR_X = 80
const SPAWN_ANCHOR_Y = 60
const SPAWN_GAP = 16
const SPAWN_GRID = 16
// Match OutputWindow's pre-image defaults so placement stays stable.
const DEFAULT_SPAWN_W = 512
const DEFAULT_SPAWN_H = 560

// No-zoom dashboard: oldest evicts beyond MAX_TILES, layout adapts to
// any count via squarified treemap.
const MAX_TILES = 12
// Mirrors --spacing-layout-outer (8px), --spacing-layout-cell (48px),
// --spacing-layout-gutter (8px). Hardcoded to avoid reading the DOM.
const CHROME_OUTER = 8
const CHROME_CELL = 48
const CHROME_GUTTER = 8
const CHROME_STEP = CHROME_CELL + CHROME_GUTTER
// OutputWindow header strip — sized so the body height calc matches
// what the user actually sees inside each tile.
const TILE_HEADER_PX = 40
// Flush with the chrome rail: same outer margin as the icon row, one
// chrome-row + gutter below the top cluster so tiles sit on the grid.
const NO_ZOOM_ANCHOR_X = CHROME_OUTER
const NO_ZOOM_ANCHOR_Y = CHROME_OUTER + CHROME_CELL + CHROME_GUTTER

const snapSpawn = (v: number) => Math.round(v / SPAWN_GRID) * SPAWN_GRID

interface DashboardSlot {
  x: number
  y: number
  w: number
  h: number
}

interface DashboardInsets {
  /** Extra inset from the left edge (e.g. left-docked input panel). */
  left?: number
  /** Extra inset from the right edge (e.g. right-docked input panel). */
  right?: number
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

// Eviction priority: higher = kept longer, lower = evicted first.
// In-flight tiles ('skeleton' / 'latent') sit above any finalized tile
// so we never silently drop a generation that's still streaming.
// Within each tier, higher zIndex (newer) wins.
const EVICTION_INFLIGHT_BOOST = 1e9
function evictionScore(w: OutputWindowEntry): number {
  const tier = w.state === 'image' ? 0 : EVICTION_INFLIGHT_BOOST
  return tier + w.zIndex
}

function dashboardSlots(
  count: number,
  viewW: number,
  viewH: number,
  insets: DashboardInsets = {},
  /** Per-slot image aspect (slot order, 0 = feature). Default 1:1. */
  aspects: (number | undefined)[] = []
): DashboardSlot[] {
  const N = Math.max(1, Math.min(count, MAX_TILES))

  const startX = NO_ZOOM_ANCHOR_X + (insets.left ?? 0)
  const startY = NO_ZOOM_ANCHOR_Y
  const availW = Math.max(
    CHROME_STEP,
    viewW - 2 * CHROME_OUTER - (insets.left ?? 0) - (insets.right ?? 0)
  )
  // Reserve a chrome row at the bottom for the zoom + feedback clusters.
  const availH = Math.max(
    CHROME_STEP,
    viewH - startY - (CHROME_OUTER + CHROME_CELL + CHROME_GUTTER)
  )

  const localRects = bentoAspectRects(N, aspects, availW, availH, CHROME_GUTTER)
  return localRects
    .map((r) => ({
      x: startX + r.x,
      y: startY + r.y,
      w: r.w,
      h: r.h
    }))
    .map(roundRect)
}

interface BentoCandidate {
  featureW: number
  featureH: number
  cols: number
  rows: number
  cellW: number
  cellH: number
}

// Bento: 1 feature tile + (N−1) stack tiles arranged in a cols × rows
// grid to the right of the feature. Each tile body matches its image
// aspect (no letterbox). Anchored to the top-left of availW × availH;
// any slack collapses to the bottom-right where the panel and bottom
// chrome cluster already sit.
//
// For each candidate (cols × rows) grid, we score by total visible
// tile area and pick the best — so 4 stacks become 2×2 instead of a
// narrow 1×4 column when there's horizontal slack to fill, and a
// short feature wins when the stack column would otherwise be tiny.
function bentoAspectRects(
  N: number,
  aspects: (number | undefined)[],
  availW: number,
  availH: number,
  gutter: number
): Rect[] {
  if (N === 0) return []
  const featureA = aspects[0] && aspects[0] > 0 ? aspects[0] : 1

  if (N === 1) {
    return [centerAspectInRect(featureA, availW, availH)]
  }

  const stackCount = N - 1
  const stackAspectArr: number[] = []
  for (let i = 1; i < N; i++) {
    const a = aspects[i]
    stackAspectArr.push(a && a > 0 ? a : 1)
  }
  // avgStackA sizes the grid; per-tile aspect re-applies inside each
  // cell so mixed aspects stay un-stretched.
  const avgStackA = stackAspectArr.reduce((s, a) => s + a, 0) / stackCount
  const h = TILE_HEADER_PX

  // Candidate A: feature fills availH, stack grid (cols ≥ 1) fits in
  // remaining width. Search cols 1..stackCount, picking max tile area.
  let candA: BentoCandidate | null = null
  {
    const fH = availH
    const fW = featureA * (fH - h)
    if (fW > 0 && fW + gutter < availW) {
      const remW = availW - fW - gutter
      for (let cols = 1; cols <= stackCount; cols++) {
        const rows = Math.ceil(stackCount / cols)
        // Height-fit: stack column fills availH at this row count.
        const hH = (availH - (rows - 1) * gutter) / rows
        const hW = avgStackA * (hH - h)
        if (
          hW > 0 &&
          cols * hW + (cols - 1) * gutter <= remW &&
          (!candA || hW * hH > candA.cellW * candA.cellH)
        ) {
          candA = {
            featureW: fW,
            featureH: fH,
            cols,
            rows,
            cellW: hW,
            cellH: hH
          }
        }
        // Width-fit: cols fill remaining width at this row count.
        const wW = (remW - (cols - 1) * gutter) / cols
        if (wW > 0) {
          const wH = wW / avgStackA + h
          if (
            rows * wH + (rows - 1) * gutter <= availH &&
            (!candA || wW * wH > candA.cellW * candA.cellH)
          ) {
            candA = {
              featureW: fW,
              featureH: fH,
              cols,
              rows,
              cellW: wW,
              cellH: wH
            }
          }
        }
      }
    }
  }

  // Candidate B: legacy feature + single-column stack with the layout
  // sized to fill availW (feature shrinks if it can't fit alongside).
  // Wins when the available area is too narrow for feature@availH to
  // leave a usable stack column.
  let candB: BentoCandidate | null = null
  {
    const calcWidthAt = (lh: number): number => {
      const fw = featureA * (lh - h)
      const sth = (lh - (stackCount - 1) * gutter) / stackCount
      const sw = avgStackA * (sth - h)
      return fw + gutter + sw
    }
    let layoutH = availH
    if (calcWidthAt(layoutH) > availW) {
      const slope = featureA + avgStackA / stackCount
      const w0 = calcWidthAt(0)
      layoutH = (availW - w0) / slope
    }
    if (layoutH > h) {
      const fH = layoutH
      const fW = featureA * (fH - h)
      const sH = (layoutH - (stackCount - 1) * gutter) / stackCount
      const sW = avgStackA * (sH - h)
      if (sW > 0) {
        candB = {
          featureW: fW,
          featureH: fH,
          cols: 1,
          rows: stackCount,
          cellW: sW,
          cellH: sH
        }
      }
    }
  }

  // Score: total visible tile area (feature + every stack cell).
  const score = (c: BentoCandidate | null): number =>
    c ? c.featureW * c.featureH + stackCount * c.cellW * c.cellH : -Infinity

  const chosen = score(candA) >= score(candB) ? candA : candB
  if (!chosen) return [centerAspectInRect(featureA, availW, availH)]

  // Place feature top-left, stack tiles row-major in the grid.
  // Newest stack (slot 1) goes to (col 0, row 0) so reading order
  // matches recency — newest near the feature, older toward bottom-right.
  const rects: Rect[] = [{ x: 0, y: 0, w: chosen.featureW, h: chosen.featureH }]
  const stackOriginX = chosen.featureW + gutter
  for (let i = 0; i < stackCount; i++) {
    const col = i % chosen.cols
    const row = Math.floor(i / chosen.cols)
    const cellX = stackOriginX + col * (chosen.cellW + gutter)
    const cellY = row * (chosen.cellH + gutter)

    // Re-apply this tile's own aspect inside the uniform cell so a
    // mixed-aspect run doesn't stretch any image.
    const a = stackAspectArr[i]
    const wByCellH = a * (chosen.cellH - h)
    let renderW: number
    let renderH: number
    if (wByCellH <= chosen.cellW) {
      renderW = wByCellH
      renderH = chosen.cellH
    } else {
      renderW = chosen.cellW
      renderH = chosen.cellW / a + h
    }
    rects.push({
      x: cellX + (chosen.cellW - renderW) / 2,
      y: cellY + (chosen.cellH - renderH) / 2,
      w: renderW,
      h: renderH
    })
  }
  return rects
}

function centerAspectInRect(
  aspect: number,
  availW: number,
  availH: number
): Rect {
  // Largest tile at `aspect` (body match) fitting in availW × availH.
  // Top-left anchor matches bentoAspectRects: slack collapses toward
  // bottom-right rather than carving out a visible left/right band.
  const wByH = aspect * (availH - TILE_HEADER_PX)
  if (wByH <= availW) {
    return { x: 0, y: 0, w: wByH, h: availH }
  }
  const hByW = availW / aspect + TILE_HEADER_PX
  return { x: 0, y: 0, w: availW, h: hByW }
}

function roundRect(r: Rect): DashboardSlot {
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.w),
    h: Math.round(r.h)
  }
}
function entryRect(w: OutputWindowEntry): Rect {
  return {
    x: w.position.x,
    y: w.position.y,
    w: w.width ?? DEFAULT_SPAWN_W,
    h: w.height ?? DEFAULT_SPAWN_H
  }
}
function rectsOverlap(a: Rect, b: Rect): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  )
}

export const useOutputWindowStore = defineStore('appModeOutputWindow', () => {
  const windows = ref<OutputWindowEntry[]>([])
  let nextZ = 1

  const sortedWindows = computed(() =>
    [...windows.value].sort((a, b) => a.zIndex - b.zIndex)
  )

  function nextSpawnPosition(): { x: number; y: number } {
    if (useAppModeStore().noZoomMode) {
      // Position is overwritten by relayoutDashboard once the LayoutView
      // reports its size; this anchor avoids a (0,0) flash before then.
      return { x: NO_ZOOM_ANCHOR_X, y: NO_ZOOM_ANCHOR_Y }
    }
    if (windows.value.length === 0) {
      return { x: snapSpawn(SPAWN_ANCHOR_X), y: snapSpawn(SPAWN_ANCHOR_Y) }
    }

    // Anchor on the most recently spawned window.
    const last = entryRect(windows.value[windows.value.length - 1])
    const newW = DEFAULT_SPAWN_W
    const newH = DEFAULT_SPAWN_H

    // Try each side; first non-colliding wins.
    const candidates = [
      { x: last.x + last.w + SPAWN_GAP, y: last.y },
      { x: last.x, y: last.y + last.h + SPAWN_GAP },
      { x: last.x - newW - SPAWN_GAP, y: last.y },
      { x: last.x, y: last.y - newH - SPAWN_GAP }
    ]
    for (const c of candidates) {
      const newRect: Rect = { x: c.x, y: c.y, w: newW, h: newH }
      const collides = windows.value.some((w) =>
        rectsOverlap(newRect, entryRect(w))
      )
      if (!collides) return { x: snapSpawn(c.x), y: snapSpawn(c.y) }
    }

    // Cluster boxed in — wrap to a fresh row below.
    const bottomY = Math.max(
      ...windows.value.map((w) => w.position.y + (w.height ?? DEFAULT_SPAWN_H))
    )
    return {
      x: snapSpawn(SPAWN_ANCHOR_X),
      y: snapSpawn(bottomY + SPAWN_GAP)
    }
  }

  function upsert(
    id: string,
    patch: Omit<Partial<OutputWindowEntry>, 'id' | 'position' | 'zIndex'>
  ): void {
    const existing = windows.value.find((w) => w.id === id)
    if (existing) {
      Object.assign(existing, patch)
      return
    }
    windows.value.push({
      id,
      state: 'skeleton',
      position: nextSpawnPosition(),
      zIndex: nextZ++,
      ...patch
    })
    // Prune (after push so the new tile's high zIndex protects it).
    if (useAppModeStore().noZoomMode) pruneToCapacity()
  }

  // Drop windows beyond MAX_TILES, picking finalized tiles first so
  // an in-flight generation isn't silently abandoned. Single
  // assignment for one reactive trigger.
  function pruneToCapacity(): void {
    if (windows.value.length <= MAX_TILES) return
    const sorted = [...windows.value].sort(
      (a, b) => evictionScore(b) - evictionScore(a)
    )
    const keepIds = new Set(sorted.slice(0, MAX_TILES).map((w) => w.id))
    windows.value = windows.value.filter((w) => keepIds.has(w.id))
  }

  function attachAsset(id: string, asset: AssetItem): void {
    const w = windows.value.find((w) => w.id === id)
    if (w && !w.asset) w.asset = asset
  }

  // Image aspect can change when the latent → final URL swap reveals a
  // different natural ratio, so don't gate on first-write.
  function attachAspect(id: string, aspect: number): void {
    if (!Number.isFinite(aspect) || aspect <= 0) return
    const w = windows.value.find((w) => w.id === id)
    if (w && w.aspect !== aspect) w.aspect = aspect
  }

  function remove(id: string): void {
    const idx = windows.value.findIndex((w) => w.id === id)
    if (idx >= 0) windows.value.splice(idx, 1)
  }

  function move(id: string, position: { x: number; y: number }): void {
    const w = windows.value.find((w) => w.id === id)
    if (w) w.position = position
  }

  function resize(id: string, size: { width: number; height: number }): void {
    const w = windows.value.find((w) => w.id === id)
    if (w) {
      w.width = size.width
      w.height = size.height
    }
  }

  function promote(id: string): void {
    const w = windows.value.find((w) => w.id === id)
    if (!w) return
    // No-op when already topmost; caps zIndex growth.
    const maxZ = windows.value.reduce(
      (m, x) => (x.zIndex > m ? x.zIndex : m),
      0
    )
    if (w.zIndex >= maxZ) return
    w.zIndex = nextZ++
  }

  function clear(): void {
    windows.value = []
    nextZ = 1
  }

  // Re-flow all tiles into a bento grid sized to the LayoutView.
  // Caller (LayoutView) provides dimensions and panel insets so we
  // don't reach into the DOM here. Newest window (last in the array)
  // gets the feature slot; older ones fall into the shrinking stack.
  // Prunes first so entering bento mode with > MAX_TILES windows
  // can't leave orphaned tiles in stale zoom-mode positions.
  function relayoutDashboard(
    viewW: number,
    viewH: number,
    insets?: DashboardInsets
  ): void {
    if (!useAppModeStore().noZoomMode) return
    pruneToCapacity()
    const N = windows.value.length
    // Slot 0 is the feature (newest). Walk windows in reverse so each
    // slot index lines up with that window's image aspect.
    const aspectsBySlot: (number | undefined)[] = []
    for (let i = N - 1; i >= 0; i--) {
      aspectsBySlot.push(windows.value[i].aspect)
    }
    const slots = dashboardSlots(N, viewW, viewH, insets, aspectsBySlot)
    windows.value.forEach((w, i) => {
      // Reverse map: windows[N-1] → slots[0] (feature), windows[0] → last.
      const slot = slots[N - 1 - i]
      if (!slot) return
      w.position = { x: slot.x, y: slot.y }
      w.width = slot.w
      w.height = slot.h
    })
  }

  return {
    windows,
    sortedWindows,
    upsert,
    attachAsset,
    attachAspect,
    remove,
    move,
    resize,
    promote,
    clear,
    relayoutDashboard
  }
})
