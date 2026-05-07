import { acceptHMRUpdate, defineStore } from 'pinia'
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
  /**
   * Monotonic creation order; never modified after spawn. Distinct
   * from `zIndex` (which `promote` rewrites) so dashboard layout can
   * find the newest tile without being thrown off by user clicks or
   * by sync-watch tick batching that pushes items in newest-first
   * iteration order.
   */
  createdSeq: number
}

// Match OutputWindow's pre-image defaults so placement stays stable.
const DEFAULT_SPAWN_W = 512
const DEFAULT_SPAWN_H = 560

// Dashboard cap — keeps the cell-grid first-fit search small and
// avoids cramming tiles when too many accumulate. Oldest evicts first.
const MAX_TILES = 9
// Mirrors --spacing-layout-outer (8px), --spacing-layout-cell (48px),
// --spacing-layout-gutter (8px). Hardcoded to avoid reading the DOM.
const CHROME_OUTER = 8
const CHROME_CELL = 48
const CHROME_GUTTER = 8
const CHROME_STEP = CHROME_CELL + CHROME_GUTTER

// Align zoom-mode spawn to the same chrome cell grid that
// OutputWindow's drag/resize snapping uses (CHROME_STEP=56 with an
// CHROME_OUTER=8 origin). Mismatched 16px snap drift would leave
// non-uniform gaps after OutputWindow re-snapped on mount.
const SPAWN_ANCHOR_X = CHROME_OUTER + CHROME_STEP
const SPAWN_ANCHOR_Y = CHROME_OUTER + CHROME_STEP
const SPAWN_GAP = CHROME_GUTTER

// First-spawn anchor used before the first relayout fires; matches
// the chrome rail offset so there's no flash before LayoutView reports
// its size.
const NO_ZOOM_ANCHOR_X = CHROME_OUTER
const NO_ZOOM_ANCHOR_Y = CHROME_OUTER + CHROME_CELL + CHROME_GUTTER

const snapSpawn = (v: number) =>
  Math.round((v - CHROME_OUTER) / CHROME_STEP) * CHROME_STEP + CHROME_OUTER

interface DashboardSlot {
  x: number
  y: number
  w: number
  h: number
}

interface DashboardInsets {
  /**
   * Panel rect in canvas coords (relative to LayoutView origin).
   * The cells overlapping it are reserved so tiles flow around the
   * panel — same code path for full-height docks and corner floats.
   */
  panelRect?: { x: number; y: number; w: number; h: number }
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

// Place tiles on the chrome cell grid: feature on the side opposite
// the panel, stacks pack the remaining cells in a near-square grid.
// The avail rect is fully covered (zero slack); image aspect is
// handled by `object-cover` inside each slot rather than by sizing
// the slot to the image.
function dashboardSlots(
  count: number,
  viewW: number,
  viewH: number,
  insets: DashboardInsets = {},
  /** Per-slot image aspect (slot 0 = newest). Default 1:1. */
  aspects: (number | undefined)[] = []
): DashboardSlot[] {
  const N = Math.max(1, Math.min(count, MAX_TILES))

  const cols = Math.max(
    1,
    Math.floor((viewW - 2 * CHROME_OUTER + CHROME_GUTTER) / CHROME_STEP)
  )
  const rows = Math.max(
    1,
    Math.floor((viewH - 2 * CHROME_OUTER + CHROME_GUTTER) / CHROME_STEP)
  )

  const avail = computeAvailRect(insets, cols, rows)
  if (avail.cols < 2 || avail.rows < 2) return []

  const aspectArr: number[] = []
  for (let i = 0; i < N; i++) {
    const a = aspects[i]
    aspectArr.push(a && a > 0 ? a : 1)
  }

  // Feature anchors on the side opposite the panel so the panel and
  // newest output don't crowd each other. With no panel, default left.
  const panelOnLeft = !!insets.panelRect && insets.panelRect.x === 0
  const featureOnRight = panelOnLeft

  const placements = templatePlacements(
    N,
    avail.cols,
    avail.rows,
    aspectArr,
    featureOnRight
  )

  // Pixel boundaries to snap edge-touching tiles to. The cell grid
  // floors the panel's column position, so when the panel doesn't sit
  // on a cell boundary there's a sub-cell sliver between the last
  // avail cell and the panel/canvas edge. Tiles in the last avail
  // column or row stretch to consume that sliver, leaving exactly
  // one standard gutter to the chrome.
  const rightBoundaryWithPanel =
    insets.panelRect && insets.panelRect.x > 0
      ? insets.panelRect.x - CHROME_GUTTER
      : viewW - CHROME_OUTER
  const leftBoundaryWithPanel =
    insets.panelRect && insets.panelRect.x === 0
      ? insets.panelRect.x + insets.panelRect.w + CHROME_GUTTER
      : CHROME_OUTER
  const bottomBoundary = viewH - CHROME_OUTER - CHROME_CELL - CHROME_GUTTER

  return placements.map((p) => {
    let x = CHROME_OUTER + (avail.startCol + p.col) * CHROME_STEP
    const y = CHROME_OUTER + (avail.startRow + p.row) * CHROME_STEP
    let w = p.cellsW * CHROME_STEP - CHROME_GUTTER
    let h = p.cellsH * CHROME_STEP - CHROME_GUTTER

    // Tiles touching an avail edge absorb any sub-cell sliver so the
    // dashboard fills exactly to the chrome / panel margins. Safe to
    // apply to stack tiles too because the 0.55 feature split keeps
    // the feature wider than any stack column even with full
    // sliver absorption (max sliver ~47px, feature lead ≥56px).
    if (p.col + p.cellsW === avail.cols && rightBoundaryWithPanel > x + w) {
      w = rightBoundaryWithPanel - x
    }
    if (p.col === 0 && leftBoundaryWithPanel < x) {
      w += x - leftBoundaryWithPanel
      x = leftBoundaryWithPanel
    }
    if (p.row + p.cellsH === avail.rows && bottomBoundary > y + h) {
      h = bottomBoundary - y
    }

    return roundRect({ x, y, w, h })
  })
}

interface CellPlacement {
  col: number
  row: number
  cellsW: number
  cellsH: number
}

// TODO(bento-templates): Demo-grade hand-tuned layout. Feature tile
// fills 50% of the avail width on the side opposite the panel; the
// remaining stacks tile a near-square grid that fully covers the
// rest. The last stack tile spans any leftover slots in its row so
// the avail rect has zero slack. Image aspect is ignored — slots
// are filled by `object-cover`. Replace with the hero-split +
// slicing-tree + justified-rows hybrid in
// github-prs/pr-11317/bento-layout-research.md once aspect-preserving
// packing is back on the roadmap.
function templatePlacements(
  N: number,
  cols: number,
  rows: number,
  aspects: number[],
  featureOnRight: boolean
): CellPlacement[] {
  if (N === 0 || cols < 1 || rows < 1) return []

  if (N === 1) {
    // Bounded-fit feature so a square image in a landscape avail
    // doesn't lose ~24% to cover-crop. Anchored opposite the panel.
    const fit = boundedFitTile(aspects[0] ?? 1, cols, rows, 0, 0)
    if (featureOnRight) fit.col = cols - fit.cellsW
    return [fit]
  }

  // 0.55 (not 0.5) so feature is always at least one cell wider
  // than the stack region. With 0.5 + even cols, both halves are
  // equal cells; the panel-side sliver-stretch then makes the
  // stack tile visibly bigger than the feature, which inverts the
  // "newest dominates" intent.
  const featW = Math.max(2, Math.ceil(cols * 0.55))
  const stackCols = cols - featW
  if (stackCols < 1) {
    return [{ col: 0, row: 0, cellsW: cols, cellsH: rows }]
  }

  const stackCount = N - 1
  // Pick (sc × sr) so the stack cells are as close to square as
  // possible. Score is |log(cellW/cellH)| — symmetric around 1:1.
  let best = { sc: 1, sr: stackCount, score: Infinity }
  for (let sc = 1; sc <= stackCount; sc++) {
    const sr = Math.ceil(stackCount / sc)
    const cellW = stackCols / sc
    const cellH = rows / sr
    if (cellW < 1 || cellH < 1) continue
    const score = Math.abs(Math.log(cellW / cellH))
    if (score < best.score) best = { sc, sr, score }
  }
  if (best.score === Infinity) {
    return [{ col: 0, row: 0, cellsW: cols, cellsH: rows }]
  }

  const { sc, sr } = best
  const colWidths = distributeCells(stackCols, sc)
  const rowHeights = distributeCells(rows, sr)
  const colXs = cumOffsets(colWidths)
  const rowYs = cumOffsets(rowHeights)

  const featCol = featureOnRight ? stackCols : 0
  const stackBaseCol = featureOnRight ? 0 : featW
  const tiles: CellPlacement[] = [
    { col: featCol, row: 0, cellsW: featW, cellsH: rows }
  ]

  // Stack tiles in row-major order. The last tile spans any leftover
  // slots in its row to keep the avail rect fully covered.
  const totalSlots = sc * sr
  const leftover = totalSlots - stackCount
  for (let i = 0; i < stackCount; i++) {
    const r = Math.floor(i / sc)
    const c = i % sc
    const isLast = i === stackCount - 1
    const span = isLast && r === sr - 1 && leftover > 0 ? 1 + leftover : 1
    let w = 0
    for (let k = 0; k < span; k++) w += colWidths[c + k]
    tiles.push({
      col: stackBaseCol + colXs[c],
      row: rowYs[r],
      cellsW: w,
      cellsH: rowHeights[r]
    })
  }

  return tiles
}

// e.g. distributeCells(13, 3) → [5, 4, 4]. Extras land in the
// earliest rows/cols so the avail rect is fully covered.
function distributeCells(total: number, count: number): number[] {
  const base = Math.floor(total / count)
  const extra = total - base * count
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}

function cumOffsets(sizes: number[]): number[] {
  const out: number[] = [0]
  for (let i = 0; i < sizes.length; i++) out.push(out[i] + sizes[i])
  return out
}

// Max body-aspect / image-aspect ratio for the solo-tile case. A
// value of 1.2 caps image-cover cropping at ~17% on each side (the
// bottom edge-snap usually shaves it further by extending the body
// height). Larger = closer to fill-avail with more crop; smaller =
// tighter aspect match with bigger gaps along the slack dimension.
const SOLO_TILE_ASPECT_CAP = 1.2

// Aspect-locked tile that expands toward the avail boundary up to
// SOLO_TILE_ASPECT_CAP. Used for N=1 where the alternative (full
// avail fill) over-crops the image when avail and image aspects
// diverge.
function boundedFitTile(
  aspect: number,
  cols: number,
  rows: number,
  col: number,
  row: number
): CellPlacement {
  const bodyRows = Math.max(1, rows - 1)
  let bodyW = Math.max(1, Math.round(aspect * bodyRows))
  let bodyH = bodyRows
  if (bodyW > cols) {
    bodyW = cols
    bodyH = Math.max(1, Math.round(bodyW / aspect))
  }
  if (cols > bodyW) {
    bodyW = Math.min(cols, Math.round(aspect * bodyH * SOLO_TILE_ASPECT_CAP))
  } else if (bodyRows > bodyH) {
    bodyH = Math.min(
      bodyRows,
      Math.round((bodyW / aspect) * SOLO_TILE_ASPECT_CAP)
    )
  }
  return { col, row, cellsW: bodyW, cellsH: bodyH + 1 }
}

interface AvailRect {
  startCol: number
  startRow: number
  cols: number
  rows: number
}

// Compute the rectangular cell region available for tiles, after
// reserving the chrome top/bottom rows and the panel column. For
// floating panels that don't reach an edge, this overestimates the
// reservation (treats them as full-height) — simpler than splitting
// the canvas into an L-shape and good enough for most layouts.
function computeAvailRect(
  insets: DashboardInsets,
  cols: number,
  rows: number
): AvailRect {
  let startCol = 0
  let endCol = cols
  // Top and bottom rows host the chrome corner clusters.
  const startRow = 1
  const endRow = rows - 1

  if (insets.panelRect) {
    const pr = insets.panelRect
    const pStart = Math.max(0, Math.floor((pr.x - CHROME_OUTER) / CHROME_STEP))
    const pEnd = Math.min(
      cols,
      Math.ceil((pr.x + pr.w - CHROME_OUTER) / CHROME_STEP)
    )
    if (pEnd >= cols && pStart > 0) {
      // Panel hugs the right edge — shrink the right side.
      endCol = pStart
    } else if (pStart === 0 && pEnd < cols) {
      // Panel hugs the left edge — shrink the left side.
      startCol = pEnd
    } else if (pEnd >= cols) {
      // Panel covers the full width somehow — nothing usable.
      endCol = startCol
    }
  }

  return {
    startCol,
    startRow,
    cols: Math.max(0, endCol - startCol),
    rows: Math.max(0, endRow - startRow)
  }
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
  let nextSeq = 1

  const sortedWindows = computed(() =>
    [...windows.value].sort((a, b) => a.zIndex - b.zIndex)
  )

  function nextSpawnPosition(
    newW: number = DEFAULT_SPAWN_W,
    newH: number = DEFAULT_SPAWN_H
  ): { x: number; y: number } {
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
    patch: Omit<
      Partial<OutputWindowEntry>,
      'id' | 'position' | 'zIndex' | 'createdSeq'
    >
  ): void {
    const existing = windows.value.find((w) => w.id === id)
    if (existing) {
      Object.assign(existing, patch)
      return
    }
    // In zoom mode, new tiles inherit the most recent tile's
    // dimensions so a sequence reads as one consistent canvas
    // instead of cascading to the default 512×560 (smaller than
    // the first tile's bounded-fit slot from placeFirstZoomTile).
    // No-zoom dashboard relayout will overwrite size anyway.
    const inheritFrom = !useAppModeStore().noZoomMode
      ? windows.value[windows.value.length - 1]
      : undefined
    const inheritW = inheritFrom?.width
    const inheritH = inheritFrom?.height
    windows.value.push({
      id,
      state: 'skeleton',
      position: nextSpawnPosition(
        inheritW ?? DEFAULT_SPAWN_W,
        inheritH ?? DEFAULT_SPAWN_H
      ),
      width: inheritW,
      height: inheritH,
      zIndex: nextZ++,
      createdSeq: nextSeq++,
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
    nextSeq = 1
  }

  // Re-flow all tiles into the cell grid sized to the LayoutView.
  // Caller (LayoutView) provides dimensions and the panel rect so we
  // don't reach into the DOM here. Newest tile (highest createdSeq)
  // gets slot 0 — the biggest tier — and older tiles take subsequent
  // slots in descending recency. Sorting by createdSeq instead of
  // trusting windows.value order matters because useOutputWindowSync
  // can push newest-first when multiple items appear in a single
  // reactive tick, leaving the newest at windows[0] rather than the
  // end.
  function relayoutDashboard(
    viewW: number,
    viewH: number,
    insets?: DashboardInsets
  ): void {
    if (!useAppModeStore().noZoomMode) return
    pruneToCapacity()
    // Fall back to zIndex when createdSeq is missing — undefined
    // arithmetic produces NaN, which makes the sort non-deterministic
    // and was masking this fix when Vite HMR carried over store state
    // from an earlier build.
    const newnessOf = (w: OutputWindowEntry) => w.createdSeq ?? w.zIndex
    const byNewness = [...windows.value].sort(
      (a, b) => newnessOf(b) - newnessOf(a)
    )
    const aspectsBySlot = byNewness.map((w) => w.aspect)
    const slots = dashboardSlots(
      byNewness.length,
      viewW,
      viewH,
      insets,
      aspectsBySlot
    )
    byNewness.forEach((w, i) => {
      const slot = slots[i]
      if (!slot) return
      w.position = { x: slot.x, y: slot.y }
      w.width = slot.w
      w.height = slot.h
    })
  }

  // Place the first zoom-mode tile in the corner opposite the input
  // panel, bounded-fit to the avail rect — same shape as no-zoom
  // N=1 — so a single output reads as the focus tile in either
  // mode. Subsequent zoom-mode tiles fall back to cluster spawn
  // (`nextSpawnPosition`) so the user can drag them freely.
  function placeFirstZoomTile(
    viewW: number,
    viewH: number,
    insets?: DashboardInsets
  ): void {
    if (windows.value.length !== 1) return
    const win = windows.value[0]
    const slots = dashboardSlots(1, viewW, viewH, insets, [win.aspect])
    const slot = slots[0]
    if (!slot) return
    win.position = { x: slot.x, y: slot.y }
    win.width = slot.w
    win.height = slot.h
  }

  // Wrap `windows` as a computed before exposing so consumers cannot
  // mutate the array directly. Internal mutation continues to use
  // `windows.value` inside the store closure.
  const exposedWindows = computed<readonly OutputWindowEntry[]>(
    () => windows.value
  )

  return {
    windows: exposedWindows,
    sortedWindows,
    upsert,
    attachAsset,
    attachAspect,
    remove,
    move,
    resize,
    promote,
    clear,
    relayoutDashboard,
    placeFirstZoomTile
  }
})

// Lets Vite drop the existing store instance on HMR rather than
// keeping stale entries around (e.g., entries from before
// `createdSeq` was added, which break the dashboard newness sort).
if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useOutputWindowStore, import.meta.hot))
}
