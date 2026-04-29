import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { ResultItemImpl } from '@/stores/queueStore'

/**
 * One floating output window. Fed by
 * `linearOutputStore.activeWorkflowInProgressItems`: spawns at
 * `'skeleton'`, transitions to `'latent'` / `'image'`, and stays
 * after the source item is absorbed out of the in-progress list —
 * that's what gives the canvas its moodboard accumulation.
 */
export interface OutputWindowEntry {
  id: string
  /** Matches the window back to its `AssetItem` via `outputs.media`. */
  jobId?: string
  state: 'skeleton' | 'latent' | 'image'
  latentPreviewUrl?: string
  output?: ResultItemImpl
  /** Populated by useOutputWindowSync; unlocks rerun + reuse-params
   *  and the Cloud asset_hash URL fix. */
  asset?: AssetItem
  /** Workspace coordinates (pre-transform). */
  position: { x: number; y: number }
  /** User-set dimensions in workspace px; undefined = auto-fit / default. */
  width?: number
  height?: number
  zIndex: number
}

const SPAWN_ANCHOR_X = 80
const SPAWN_ANCHOR_Y = 60
// One grid unit between adjacent windows.
const SPAWN_GAP = 16
const SPAWN_GRID = 16
// Default size for spawn-placement math; matches OutputWindow's
// pre-image defaults. Once the image lands the window resizes in
// place; placement stays stable.
const DEFAULT_SPAWN_W = 512
const DEFAULT_SPAWN_H = 560

const snapSpawn = (v: number) => Math.round(v / SPAWN_GRID) * SPAWN_GRID

interface Rect {
  x: number
  y: number
  w: number
  h: number
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
    if (windows.value.length === 0) {
      return { x: snapSpawn(SPAWN_ANCHOR_X), y: snapSpawn(SPAWN_ANCHOR_Y) }
    }

    // Anchor on the most recently spawned window — that's the one the
    // user just generated and wants the next image next to.
    const last = entryRect(windows.value[windows.value.length - 1])
    const newW = DEFAULT_SPAWN_W
    const newH = DEFAULT_SPAWN_H

    // Try right, below, left, above of the anchor — pick the first
    // free side. SPAWN_GAP between adjacent windows.
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

    // Cluster fully boxed in — drop a row below the bottommost window.
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
  }

  function attachAsset(id: string, asset: AssetItem): void {
    const w = windows.value.find((w) => w.id === id)
    if (w && !w.asset) w.asset = asset
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
    // Skip when already topmost — caps zIndex climb from idle clicks.
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

  return {
    windows,
    sortedWindows,
    upsert,
    attachAsset,
    remove,
    move,
    resize,
    promote,
    clear
  }
})
