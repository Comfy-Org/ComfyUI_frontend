import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// outputWindowStore reads `noZoomMode` from appModeStore to decide
// whether to prune past MAX_TILES on upsert. Mock with a plain object
// so the appModeStore's full dependency graph (canvasStore,
// settingStore, useAppMode, ...) doesn't get pulled in here.
const mockAppModeState = vi.hoisted(() => ({
  noZoomMode: false
}))
vi.mock('@/stores/appModeStore', () => ({
  useAppModeStore: () => mockAppModeState
}))

import { useOutputWindowStore } from './outputWindowStore'

const MAX_TILES = 9

describe('outputWindowStore', () => {
  let store: ReturnType<typeof useOutputWindowStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    mockAppModeState.noZoomMode = false
    store = useOutputWindowStore()
    vi.clearAllMocks()
  })

  describe('upsert', () => {
    it('spawns a new window with monotonic zIndex and createdSeq', () => {
      store.upsert('a', { state: 'skeleton' })
      store.upsert('b', { state: 'skeleton' })

      expect(store.windows.length).toBe(2)
      const [a, b] = store.windows
      expect(b.zIndex).toBeGreaterThan(a.zIndex)
      expect(b.createdSeq).toBeGreaterThan(a.createdSeq)
    })

    it('updates an existing window in place when id matches', () => {
      store.upsert('a', { state: 'skeleton' })
      const before = store.windows[0]
      store.upsert('a', { state: 'image' })

      expect(store.windows.length).toBe(1)
      expect(store.windows[0].state).toBe('image')
      // Same identity — patch, not replace.
      expect(store.windows[0].zIndex).toBe(before.zIndex)
      expect(store.windows[0].createdSeq).toBe(before.createdSeq)
    })

    it('does not prune past MAX_TILES when noZoomMode is off', () => {
      // Zoom mode: tiles accumulate; user pans/zooms to find them.
      for (let i = 0; i < MAX_TILES + 3; i++) {
        store.upsert(`w${i}`, { state: 'image' })
      }
      expect(store.windows.length).toBe(MAX_TILES + 3)
    })

    it('prunes finalized tiles first when noZoomMode is on', () => {
      mockAppModeState.noZoomMode = true
      // Mix of finalized + in-flight; oldest finalized should be the
      // first to go, so the latent gen at id=mid is preserved.
      store.upsert('old-final', { state: 'image' })
      store.upsert('mid-latent', { state: 'latent' })
      for (let i = 0; i < MAX_TILES; i++) {
        store.upsert(`new-final-${i}`, { state: 'image' })
      }

      expect(store.windows.length).toBe(MAX_TILES)
      const ids = store.windows.map((w) => w.id)
      expect(ids).toContain('mid-latent')
      expect(ids).not.toContain('old-final')
    })

    it('eviction respects creation order even after promote() rewrites zIndex', () => {
      // Regression for the bug where eviction sorted by mutable zIndex.
      // User clicks an OLD tile (promote raises its zIndex above all
      // others); a NEW tile then arrives and triggers prune. The OLD
      // tile must still evict before any newer untouched tile, because
      // creation order — not click recency — is the eviction contract.
      mockAppModeState.noZoomMode = true
      store.upsert('old-clicked', { state: 'image' })
      for (let i = 0; i < MAX_TILES - 1; i++) {
        store.upsert(`mid-${i}`, { state: 'image' })
      }
      // User clicks the oldest tile, raising its zIndex to the top.
      store.promote('old-clicked')

      // Now spawn one more, triggering prune.
      store.upsert('newest', { state: 'image' })

      const ids = store.windows.map((w) => w.id)
      expect(ids.length).toBe(MAX_TILES)
      expect(ids).toContain('newest')
      expect(ids).not.toContain('old-clicked')
    })
  })

  describe('mutations', () => {
    it('move updates position', () => {
      store.upsert('a', { state: 'skeleton' })
      store.move('a', { x: 100, y: 200 })
      expect(store.windows[0].position).toEqual({ x: 100, y: 200 })
    })

    it('resize updates dimensions', () => {
      store.upsert('a', { state: 'skeleton' })
      store.resize('a', { width: 400, height: 300 })
      expect(store.windows[0].width).toBe(400)
      expect(store.windows[0].height).toBe(300)
    })

    it('attachAspect ignores non-positive and non-finite values', () => {
      store.upsert('a', { state: 'skeleton' })
      store.attachAspect('a', 0)
      store.attachAspect('a', -1)
      store.attachAspect('a', Number.NaN)
      store.attachAspect('a', Number.POSITIVE_INFINITY)
      expect(store.windows[0].aspect).toBeUndefined()

      store.attachAspect('a', 1.5)
      expect(store.windows[0].aspect).toBe(1.5)
    })

    it('remove deletes the window', () => {
      store.upsert('a', { state: 'skeleton' })
      store.upsert('b', { state: 'skeleton' })
      store.remove('a')
      expect(store.windows.length).toBe(1)
      expect(store.windows[0].id).toBe('b')
    })
  })

  describe('promote', () => {
    it('raises a window above all others', () => {
      store.upsert('a', { state: 'skeleton' })
      store.upsert('b', { state: 'skeleton' })
      store.upsert('c', { state: 'skeleton' })

      store.promote('a')

      const a = store.windows.find((w) => w.id === 'a')!
      const others = store.windows.filter((w) => w.id !== 'a')
      for (const other of others) {
        expect(a.zIndex).toBeGreaterThan(other.zIndex)
      }
    })

    it('is a no-op when the window is already topmost', () => {
      store.upsert('a', { state: 'skeleton' })
      store.upsert('b', { state: 'skeleton' })
      const topZBefore = store.windows.find((w) => w.id === 'b')!.zIndex

      store.promote('b')

      const topZAfter = store.windows.find((w) => w.id === 'b')!.zIndex
      // No zIndex inflation when already on top.
      expect(topZAfter).toBe(topZBefore)
    })
  })

  describe('clear', () => {
    it('drops all windows and resets the spawn counters', () => {
      store.upsert('a', { state: 'image' })
      store.upsert('b', { state: 'image' })
      store.clear()
      expect(store.windows.length).toBe(0)

      // After clear, the next spawn should restart at zIndex/createdSeq
      // of 1 — both counters reset together so dashboard newness sort
      // can't be thrown off by stale createdSeq from a prior session.
      store.upsert('c', { state: 'skeleton' })
      expect(store.windows[0].zIndex).toBe(1)
      expect(store.windows[0].createdSeq).toBe(1)
    })
  })

  describe('sortedWindows', () => {
    it('returns windows by zIndex ascending', () => {
      store.upsert('a', { state: 'skeleton' })
      store.upsert('b', { state: 'skeleton' })
      store.upsert('c', { state: 'skeleton' })

      // Promote shuffles the natural order so this test verifies sort,
      // not just insertion order.
      store.promote('a')

      const ids = store.sortedWindows.map((w) => w.id)
      expect(ids).toEqual(['b', 'c', 'a'])
    })
  })
})
