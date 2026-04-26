import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { ResultItemImpl } from '@/stores/queueStore'

/**
 * One floating output window in the App Mode workspace.
 *
 * Lifecycle is fed by `linearOutputStore.activeWorkflowInProgressItems`:
 * windows are spawned in `'skeleton'`, transition to `'latent'` /
 * `'image'`, and stay in the store after the source item gets absorbed
 * out of the in-progress list — that's what gives the canvas its
 * moodboard accumulation across runs.
 */
export interface OutputWindowEntry {
  /** Stable ID — derived from the source `InProgressItem.id`. */
  id: string
  /** Owning prompt; used to bulk-remove pending windows on cancel. */
  jobId?: string
  state: 'skeleton' | 'latent' | 'image'
  latentPreviewUrl?: string
  output?: ResultItemImpl
  /** Workspace coordinates (pre-transform), matching how OutputWindow
   *  reads its position — the LayoutView transform handles zoom/pan. */
  position: { x: number; y: number }
  zIndex: number
}

const SPAWN_ANCHOR_X = 80
const SPAWN_ANCHOR_Y = 60
const SPAWN_OFFSET = 64
// Modulo so a long session doesn't cascade a window 200 deep
// off-screen — wrap back to the anchor after a few steps.
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

  /** Insert a new window or patch an existing one in place. */
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

  function remove(id: string): void {
    const idx = windows.value.findIndex((w) => w.id === id)
    if (idx >= 0) windows.value.splice(idx, 1)
  }

  /** Drop every window for a given prompt — used when the user cancels
   *  a run before any results came back, so empty skeletons don't
   *  linger as debris on the canvas. */
  function removeJob(jobId: string): void {
    windows.value = windows.value.filter((w) => w.jobId !== jobId)
  }

  function move(id: string, position: { x: number; y: number }): void {
    const w = windows.value.find((w) => w.id === id)
    if (w) w.position = position
  }

  function promote(id: string): void {
    const w = windows.value.find((w) => w.id === id)
    if (!w) return
    // Skip the bump if it's already the topmost window — avoids an
    // unbounded zIndex climb from idle clicks on the focused window.
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
    remove,
    removeJob,
    move,
    promote,
    clear
  }
})
