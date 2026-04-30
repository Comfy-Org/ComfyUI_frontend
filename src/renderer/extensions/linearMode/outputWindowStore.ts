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

// Bento: 1 feature tile + (N−1) stack tiles inside availW × availH.
// Each tile body matches its image aspect (no letterbox). Anchored
// top-left so slack collapses toward the bottom-right where the panel
// and bottom chrome cluster already sit.
//
// We generate three candidates and pick whichever yields the most
// total visible tile area:
//   • grid     — feature@availH + uniform cols×rows stack grid
//   • legacy   — feature shrunk to fit availW, single stack column
//   • slice    — feature@availH + slicing-tree (guillotine) stack
//                packing in the remaining box (stackCount ≤ 6)
// The slicing tree explores topologies the uniform grid can't (rows,
// asymmetric splits, mixed-aspect interlocks) — see
// bento-layout-research.md in the context repo.
function bentoAspectRects(
  N: number,
  aspects: (number | undefined)[],
  availW: number,
  availH: number,
  gutter: number
): Rect[] {
  if (N === 0) return []
  const featureA = aspects[0] && aspects[0] > 0 ? aspects[0] : 1
  if (N === 1) return [centerAspectInRect(featureA, availW, availH)]

  const stackCount = N - 1
  const stackAspects: number[] = []
  for (let i = 1; i < N; i++) {
    const a = aspects[i]
    stackAspects.push(a && a > 0 ? a : 1)
  }
  const h = TILE_HEADER_PX

  const candidates: Rect[][] = []
  const grid = layoutGridCandidate(
    stackCount,
    featureA,
    stackAspects,
    availW,
    availH,
    h,
    gutter
  )
  if (grid) candidates.push(grid)
  const legacy = layoutLegacyCandidate(
    stackCount,
    featureA,
    stackAspects,
    availW,
    availH,
    h,
    gutter
  )
  if (legacy) candidates.push(legacy)
  const slice = layoutSliceTreeCandidate(
    featureA,
    stackAspects,
    availW,
    availH,
    h,
    gutter
  )
  if (slice) candidates.push(slice)

  if (candidates.length === 0) {
    return [centerAspectInRect(featureA, availW, availH)]
  }

  let best = candidates[0]
  let bestArea = sumRectArea(best)
  for (let i = 1; i < candidates.length; i++) {
    const area = sumRectArea(candidates[i])
    if (area > bestArea) {
      best = candidates[i]
      bestArea = area
    }
  }
  return best
}

function sumRectArea(rects: Rect[]): number {
  let total = 0
  for (const r of rects) total += r.w * r.h
  return total
}

// Feature@availH + uniform cols×rows stack grid, searching cols for
// max stack-cell area. Each stack tile re-applies its own aspect
// inside its cell so mixed-aspect runs don't stretch.
function layoutGridCandidate(
  stackCount: number,
  featureA: number,
  stackAspects: number[],
  availW: number,
  availH: number,
  h: number,
  gutter: number
): Rect[] | null {
  const fH = availH
  const fW = featureA * (fH - h)
  if (fW <= 0 || fW + gutter >= availW) return null
  const remW = availW - fW - gutter
  const avgA = stackAspects.reduce((s, a) => s + a, 0) / stackCount

  let best: {
    cols: number
    rows: number
    cellW: number
    cellH: number
  } | null = null
  for (let cols = 1; cols <= stackCount; cols++) {
    const rows = Math.ceil(stackCount / cols)
    const hH = (availH - (rows - 1) * gutter) / rows
    const hW = avgA * (hH - h)
    if (
      hW > 0 &&
      cols * hW + (cols - 1) * gutter <= remW &&
      (!best || hW * hH > best.cellW * best.cellH)
    ) {
      best = { cols, rows, cellW: hW, cellH: hH }
    }
    const wW = (remW - (cols - 1) * gutter) / cols
    if (wW > 0) {
      const wH = wW / avgA + h
      if (
        rows * wH + (rows - 1) * gutter <= availH &&
        (!best || wW * wH > best.cellW * best.cellH)
      ) {
        best = { cols, rows, cellW: wW, cellH: wH }
      }
    }
  }
  if (!best) return null

  const rects: Rect[] = [{ x: 0, y: 0, w: fW, h: fH }]
  const stackOriginX = fW + gutter
  for (let i = 0; i < stackCount; i++) {
    const col = i % best.cols
    const row = Math.floor(i / best.cols)
    const cellX = stackOriginX + col * (best.cellW + gutter)
    const cellY = row * (best.cellH + gutter)
    const a = stackAspects[i]
    const wByCellH = a * (best.cellH - h)
    let renderW: number
    let renderH: number
    if (wByCellH <= best.cellW) {
      renderW = wByCellH
      renderH = best.cellH
    } else {
      renderW = best.cellW
      renderH = best.cellW / a + h
    }
    rects.push({
      x: cellX + (best.cellW - renderW) / 2,
      y: cellY + (best.cellH - renderH) / 2,
      w: renderW,
      h: renderH
    })
  }
  return rects
}

// Legacy: feature shrunk so feature + single-column stack exactly
// fills availW. Stack tiles centered in their column at own aspect.
function layoutLegacyCandidate(
  stackCount: number,
  featureA: number,
  stackAspects: number[],
  availW: number,
  availH: number,
  h: number,
  gutter: number
): Rect[] | null {
  const avgA = stackAspects.reduce((s, a) => s + a, 0) / stackCount
  const calcWidthAt = (lh: number): number => {
    const fw = featureA * (lh - h)
    const sth = (lh - (stackCount - 1) * gutter) / stackCount
    const sw = avgA * (sth - h)
    return fw + gutter + sw
  }
  let layoutH = availH
  if (calcWidthAt(layoutH) > availW) {
    const slope = featureA + avgA / stackCount
    const w0 = calcWidthAt(0)
    layoutH = (availW - w0) / slope
  }
  if (layoutH <= h) return null

  const fH = layoutH
  const fW = featureA * (fH - h)
  const sH = (layoutH - (stackCount - 1) * gutter) / stackCount
  const sBodyH = sH - h
  if (sBodyH <= 0) return null

  const stackTileWs = stackAspects.map((a) => Math.max(0, a * sBodyH))
  const maxStackW = Math.max(...stackTileWs, 0)

  const rects: Rect[] = [{ x: 0, y: 0, w: fW, h: fH }]
  let stackY = 0
  for (let i = 0; i < stackCount; i++) {
    const w = stackTileWs[i]
    rects.push({
      x: fW + gutter + (maxStackW - w) / 2,
      y: stackY,
      w,
      h: sH
    })
    stackY += sH + gutter
  }
  return rects
}

// Feature@availH + slicing-tree (guillotine) stack packing in remW ×
// availH. The slicing tree composes leaf aspects via the V/H rules
// (Stockmeyer 1983; Wu & Aizawa 2013), giving an aspect-preserving
// layout whose canvas dimensions emerge from leaf aspects exactly.
// Capped at SLICE_TREE_MAX_LEAVES to keep enumeration ≤ ~10k trees.
const SLICE_TREE_MAX_LEAVES = 6

function layoutSliceTreeCandidate(
  featureA: number,
  stackAspects: number[],
  availW: number,
  availH: number,
  h: number,
  gutter: number
): Rect[] | null {
  if (stackAspects.length === 0) return null
  if (stackAspects.length > SLICE_TREE_MAX_LEAVES) return null

  const fH = availH
  const fW = featureA * (fH - h)
  if (fW <= 0 || fW + gutter >= availW) return null
  const remW = availW - fW - gutter

  const sub = bestSliceTreeInBox(stackAspects, remW, availH, h, gutter)
  if (!sub) return null

  const rects: Rect[] = [{ x: 0, y: 0, w: fW, h: fH }]
  const offsetX = fW + gutter
  for (const r of sub.rects) {
    rects.push({ x: r.x + offsetX, y: r.y, w: r.w, h: r.h })
  }
  return rects
}

// ---- Slicing tree helpers ----

type SliceTree =
  | { type: 'leaf'; leafIdx: number }
  | { type: 'V' | 'H'; left: SliceTree; right: SliceTree }

interface TreeShape {
  /** H = c·W + d for the bounding rectangle of this subtree. */
  c: number
  d: number
}

// V-cut (side-by-side, share H, sum W with gutter):
//   1/c_V = 1/c_L + 1/c_R
//   d_V   = c_V · (d_L/c_L + d_R/c_R − gutter)
// H-cut (stacked, share W, sum H with gutter):
//   c_H = c_L + c_R
//   d_H = d_L + d_R + gutter
function treeShape(
  t: SliceTree,
  aspects: number[],
  h: number,
  g: number
): TreeShape {
  if (t.type === 'leaf') {
    const a =
      aspects[t.leafIdx] && aspects[t.leafIdx] > 0 ? aspects[t.leafIdx] : 1
    return { c: 1 / a, d: h }
  }
  const L = treeShape(t.left, aspects, h, g)
  const R = treeShape(t.right, aspects, h, g)
  if (t.type === 'H') {
    return { c: L.c + R.c, d: L.d + R.d + g }
  }
  const cV = 1 / (1 / L.c + 1 / R.c)
  const dV = cV * (L.d / L.c + R.d / R.c - g)
  return { c: cV, d: dV }
}

function* enumerateTrees(leaves: number[]): Generator<SliceTree> {
  if (leaves.length === 1) {
    yield { type: 'leaf', leafIdx: leaves[0] }
    return
  }
  for (let split = 1; split < leaves.length; split++) {
    const lefts = [...enumerateTrees(leaves.slice(0, split))]
    const rights = [...enumerateTrees(leaves.slice(split))]
    for (const left of lefts) {
      for (const right of rights) {
        yield { type: 'V', left, right }
        yield { type: 'H', left, right }
      }
    }
  }
}

interface IndexedRect extends Rect {
  idx: number
}

function layoutTreeInBox(
  t: SliceTree,
  x: number,
  y: number,
  w: number,
  totH: number,
  aspects: number[],
  h: number,
  g: number
): IndexedRect[] {
  if (t.type === 'leaf') {
    return [{ idx: t.leafIdx, x, y, w, h: totH }]
  }
  const L = treeShape(t.left, aspects, h, g)
  const R = treeShape(t.right, aspects, h, g)
  if (t.type === 'V') {
    const wL = (totH - L.d) / L.c
    const wR = (totH - R.d) / R.c
    return [
      ...layoutTreeInBox(t.left, x, y, wL, totH, aspects, h, g),
      ...layoutTreeInBox(t.right, x + wL + g, y, wR, totH, aspects, h, g)
    ]
  }
  const hL = L.c * w + L.d
  const hR = R.c * w + R.d
  return [
    ...layoutTreeInBox(t.left, x, y, w, hL, aspects, h, g),
    ...layoutTreeInBox(t.right, x, y + hL + g, w, hR, aspects, h, g)
  ]
}

// Enumerate all (binary tree shape × cut assignment) combinations for
// leaves in fixed order [0..N−1] and pick the one with the largest
// total tile area inside (boxW × boxH). Returns rects in slot order.
function bestSliceTreeInBox(
  aspects: number[],
  boxW: number,
  boxH: number,
  h: number,
  g: number
): { rects: Rect[]; area: number } | null {
  const N = aspects.length
  if (N === 0) return null
  if (N === 1) {
    const r = centerAspectInRect(aspects[0] || 1, boxW, boxH)
    return { rects: [r], area: r.w * r.h }
  }

  let best: { rects: Rect[]; area: number } | null = null
  const leafIdxs = Array.from({ length: N }, (_, i) => i)

  for (const tree of enumerateTrees(leafIdxs)) {
    const shape = treeShape(tree, aspects, h, g)
    if (!Number.isFinite(shape.c) || shape.c <= 0) continue
    // Bind whichever axis runs out first; layout fits inside the box.
    let w = boxW
    let totH = shape.c * w + shape.d
    if (totH > boxH) {
      totH = boxH
      w = (totH - shape.d) / shape.c
    }
    if (w <= 0 || totH <= 0) continue

    const tiles = layoutTreeInBox(tree, 0, 0, w, totH, aspects, h, g)
    let valid = true
    let area = 0
    for (const t of tiles) {
      if (t.w <= 0 || t.h <= 0) {
        valid = false
        break
      }
      area += t.w * t.h
    }
    if (!valid) continue
    if (!best || area > best.area) {
      const rects: Rect[] = new Array(N)
      for (const t of tiles) {
        rects[t.idx] = { x: t.x, y: t.y, w: t.w, h: t.h }
      }
      best = { rects, area }
    }
  }
  return best
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
