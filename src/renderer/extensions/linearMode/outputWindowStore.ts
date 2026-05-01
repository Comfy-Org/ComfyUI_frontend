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

// Bento: pack N tiles to fill availW × availH exactly. We pick the
// slicing-tree topology whose natural aspect (under image-aspect-
// preserving fitting) is closest to the canvas aspect, then lay it
// out asymmetrically: the largest leaf in that topology stays at its
// natural aspect (no crop), and every other subtree absorbs the
// stretch needed to fill the canvas. The image renders with
// object-fit: cover so stretched bodies crop their edges instead of
// distorting.
//
// Slot 0 (newest) is always assigned to the largest tile so the
// uncropped tile is the freshest output; slots 1..N−1 fill the
// remaining tiles in descending area.
//
// For small N (≤ FULL_TREE_MAX_LEAVES) we enumerate every binary
// tree shape × V/H cut assignment for fixed leaf order [0..N−1] and
// pick the one with the smallest stretch deviation. For larger N we
// fall back to feature@availH + uniform grid (uniform stretch).
const FULL_TREE_MAX_LEAVES = 7

function bentoAspectRects(
  N: number,
  aspects: (number | undefined)[],
  availW: number,
  availH: number,
  gutter: number
): Rect[] {
  if (N === 0) return []
  if (N === 1) return [{ x: 0, y: 0, w: availW, h: availH }]

  const aspectArr: number[] = []
  for (let i = 0; i < N; i++) {
    const a = aspects[i]
    aspectArr.push(a && a > 0 ? a : 1)
  }
  const h = TILE_HEADER_PX

  if (N <= FULL_TREE_MAX_LEAVES) {
    const best = bestSliceTreeForFill(aspectArr, availW, availH, h, gutter)
    if (best) {
      const tiles = layoutTreeFeatureNatural(
        best.tree,
        0,
        0,
        availW,
        availH,
        aspectArr,
        h,
        gutter,
        best.featureLeafIdx
      )
      // Slot order = tile area descending, ties broken by tree leaf
      // index. Slot 0 lands on the unstretched feature.
      tiles.sort((a, b) => b.w * b.h - a.w * a.h || a.idx - b.idx)
      return tiles.map((t) => ({ x: t.x, y: t.y, w: t.w, h: t.h }))
    }
  }

  const grid = layoutGridCandidate(
    N - 1,
    aspectArr[0],
    aspectArr.slice(1),
    availW,
    availH,
    h,
    gutter
  )
  if (!grid) return [{ x: 0, y: 0, w: availW, h: availH }]
  return stretchToFill(grid, availW, availH)
}

// Enumerate every slicing tree for the given leaves (fixed order),
// score by 1D stretch deviation needed to fill canvas, return the
// best tree along with which leaf index ends up largest under the
// aspect-preserving fit (= the "feature" we'll keep unstretched).
function bestSliceTreeForFill(
  aspects: number[],
  availW: number,
  availH: number,
  h: number,
  g: number
): { tree: SliceTree; featureLeafIdx: number } | null {
  let best: {
    tree: SliceTree
    featureLeafIdx: number
    deviation: number
  } | null = null
  const leafIdxs = Array.from({ length: aspects.length }, (_, i) => i)

  for (const tree of enumerateTrees(leafIdxs)) {
    const shape = treeShape(tree, aspects, h, g)
    if (!Number.isFinite(shape.c) || shape.c <= 0) continue

    let w = availW
    let totH = shape.c * w + shape.d
    if (totH > availH) {
      totH = availH
      w = (totH - shape.d) / shape.c
    }
    if (w <= 0 || totH <= 0) continue

    // Stretch deviation = how much we'd anisotropically scale to fill
    // the canvas. 0 means the natural layout already matches canvas
    // aspect; higher = more crop after object-fit: cover.
    const sx = availW / w
    const sy = availH / totH
    const deviation = Math.max(sx, sy) / Math.min(sx, sy) - 1
    if (best && deviation >= best.deviation) continue

    const tiles = layoutTreeInBox(tree, 0, 0, w, totH, aspects, h, g)
    let valid = true
    let featureIdx = tiles[0].idx
    let maxArea = tiles[0].w * tiles[0].h
    for (const t of tiles) {
      if (t.w <= 0 || t.h <= 0) {
        valid = false
        break
      }
      const a = t.w * t.h
      if (a > maxArea) {
        maxArea = a
        featureIdx = t.idx
      }
    }
    if (!valid) continue
    best = { tree, featureLeafIdx: featureIdx, deviation }
  }
  return best && { tree: best.tree, featureLeafIdx: best.featureLeafIdx }
}

// Lay out `tree` inside (x, y, w, h) with the subtree containing
// `featureLeafIdx` at its aspect-preserving size and the sibling
// subtree stretched anisotropically to fill the remaining space.
// Recurses into the feature subtree so the same rule applies all
// the way down: only the path from root to the feature leaf is
// natural; everything else picks up the slack via cover-fit crop.
function layoutTreeFeatureNatural(
  tree: SliceTree,
  x: number,
  y: number,
  w: number,
  h: number,
  aspects: number[],
  header: number,
  g: number,
  featureLeafIdx: number
): IndexedRect[] {
  if (tree.type === 'leaf') {
    return [{ idx: tree.leafIdx, x, y, w, h }]
  }

  const featureInLeft = treeContains(tree.left, featureLeafIdx)

  if (tree.type === 'V') {
    // Subtrees share total height = h; widths add (with gutter).
    const featSide = featureInLeft ? tree.left : tree.right
    const featShape = treeShape(featSide, aspects, header, g)
    const wFeat = (h - featShape.d) / featShape.c
    if (!Number.isFinite(wFeat) || wFeat <= 0 || wFeat + g >= w) {
      // Feature subtree can't fit alongside its sibling; fall back to
      // uniform stretch of the whole subtree.
      return layoutSubtreeStretchedToBox(tree, x, y, w, h, aspects, header, g)
    }
    const wOther = w - wFeat - g
    if (featureInLeft) {
      return [
        ...layoutTreeFeatureNatural(
          tree.left,
          x,
          y,
          wFeat,
          h,
          aspects,
          header,
          g,
          featureLeafIdx
        ),
        ...layoutSubtreeStretchedToBox(
          tree.right,
          x + wFeat + g,
          y,
          wOther,
          h,
          aspects,
          header,
          g
        )
      ]
    }
    return [
      ...layoutSubtreeStretchedToBox(
        tree.left,
        x,
        y,
        wOther,
        h,
        aspects,
        header,
        g
      ),
      ...layoutTreeFeatureNatural(
        tree.right,
        x + wOther + g,
        y,
        wFeat,
        h,
        aspects,
        header,
        g,
        featureLeafIdx
      )
    ]
  }

  // H-cut: subtrees share width = w; heights add.
  const featSide = featureInLeft ? tree.left : tree.right
  const featShape = treeShape(featSide, aspects, header, g)
  const hFeat = featShape.c * w + featShape.d
  if (!Number.isFinite(hFeat) || hFeat <= 0 || hFeat + g >= h) {
    return layoutSubtreeStretchedToBox(tree, x, y, w, h, aspects, header, g)
  }
  const hOther = h - hFeat - g
  if (featureInLeft) {
    return [
      ...layoutTreeFeatureNatural(
        tree.left,
        x,
        y,
        w,
        hFeat,
        aspects,
        header,
        g,
        featureLeafIdx
      ),
      ...layoutSubtreeStretchedToBox(
        tree.right,
        x,
        y + hFeat + g,
        w,
        hOther,
        aspects,
        header,
        g
      )
    ]
  }
  return [
    ...layoutSubtreeStretchedToBox(
      tree.left,
      x,
      y,
      w,
      hOther,
      aspects,
      header,
      g
    ),
    ...layoutTreeFeatureNatural(
      tree.right,
      x,
      y + hOther + g,
      w,
      hFeat,
      aspects,
      header,
      g,
      featureLeafIdx
    )
  ]
}

// Lay out subtree aspect-preserving into the largest box that fits
// in (w, h), then anisotropically stretch each tile so the subtree
// fills (w, h) exactly. Used for the non-feature side of every cut.
function layoutSubtreeStretchedToBox(
  tree: SliceTree,
  x: number,
  y: number,
  w: number,
  h: number,
  aspects: number[],
  header: number,
  g: number
): IndexedRect[] {
  const shape = treeShape(tree, aspects, header, g)
  let natW = w
  let natH = shape.c * natW + shape.d
  if (natH > h) {
    natH = h
    natW = (natH - shape.d) / shape.c
  }
  if (natW <= 0 || natH <= 0) return []
  const natTiles = layoutTreeInBox(tree, 0, 0, natW, natH, aspects, header, g)
  const sx = w / natW
  const sy = h / natH
  return natTiles.map((t) => ({
    idx: t.idx,
    x: x + t.x * sx,
    y: y + t.y * sy,
    w: t.w * sx,
    h: t.h * sy
  }))
}

function treeContains(tree: SliceTree, leafIdx: number): boolean {
  if (tree.type === 'leaf') return tree.leafIdx === leafIdx
  return treeContains(tree.left, leafIdx) || treeContains(tree.right, leafIdx)
}

// Anisotropically scale rects so the bounding box fills exactly
// (availW, availH). Used by the N>7 fallback path.
function stretchToFill(rects: Rect[], availW: number, availH: number): Rect[] {
  if (rects.length === 0) return rects
  let layoutW = 0
  let layoutH = 0
  for (const r of rects) {
    if (r.x + r.w > layoutW) layoutW = r.x + r.w
    if (r.y + r.h > layoutH) layoutH = r.y + r.h
  }
  if (layoutW <= 0 || layoutH <= 0) return rects
  const sx = availW / layoutW
  const sy = availH / layoutH
  return rects.map((r) => ({
    x: r.x * sx,
    y: r.y * sy,
    w: r.w * sx,
    h: r.h * sy
  }))
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

// ---- Slicing tree helpers ----
// References: Stockmeyer 1983 (VLSI floorplanning); Wu & Aizawa
// "PicWall" 2013 (photo collage). See bento-layout-research.md in
// the context repo.

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
