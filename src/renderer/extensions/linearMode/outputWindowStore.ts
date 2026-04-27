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
  zIndex: number
}

const SPAWN_ANCHOR_X = 80
const SPAWN_ANCHOR_Y = 60
const SPAWN_OFFSET = 64
// Wrap the cascade so a long session doesn't push windows off-screen.
const CASCADE_LIMIT = 6

export const useOutputWindowStore = defineStore('appModeOutputWindow', () => {
  const windows = ref<OutputWindowEntry[]>([])
  let nextZ = 1
  let spawnCounter = 0

  const sortedWindows = computed(() =>
    [...windows.value].sort((a, b) => a.zIndex - b.zIndex)
  )

  function nextSpawnPosition(): { x: number; y: number } {
    const i = spawnCounter++ % CASCADE_LIMIT
    return {
      x: SPAWN_ANCHOR_X + i * SPAWN_OFFSET,
      y: SPAWN_ANCHOR_Y + i * SPAWN_OFFSET
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
    spawnCounter = 0
  }

  return {
    windows,
    sortedWindows,
    upsert,
    attachAsset,
    remove,
    move,
    promote,
    clear
  }
})
