import { describe, expect, it, vi } from 'vitest'

import { emptyDocument } from '@/renderer/extensions/superComfy/engine/documentSchema'
import { ioNode } from '@/renderer/extensions/superComfy/engine/engineFixtures'

import { useSuperComfyGraphStore } from './superComfyGraphStore'
import {
  createSuperGraphSaver,
  loadSuperGraph,
  saveDraftNow
} from './superComfyPersistence'

vi.mock(import('firebase/auth'))
vi.mock(import('./superComfyPersistence'))

const save = vi.fn(async () => 'userdata' as const)

async function loadedStore() {
  vi.mocked(loadSuperGraph).mockResolvedValue({
    doc: emptyDocument(),
    location: 'userdata',
    recovered: false
  })
  vi.mocked(createSuperGraphSaver).mockReturnValue(save)
  const store = useSuperComfyGraphStore()
  await store.ensureLoaded()
  store.dispatch({ type: 'nodeAdded', node: ioNode('busy', 'image') })
  return store
}

async function moveEvery(
  store: ReturnType<typeof useSuperComfyGraphStore>,
  intervalMs: number,
  times: number
) {
  for (let step = 1; step <= times; step++) {
    store.dispatch({
      type: 'nodesMoved',
      moves: [{ id: 'busy', x: step, y: 0 }]
    })
    await vi.advanceTimersByTimeAsync(intervalMs)
  }
}

describe('useSuperComfyGraphStore autosave', () => {
  it('still saves while the document keeps changing faster than the autosave delay', async () => {
    vi.useFakeTimers()
    const store = await loadedStore()

    await moveEvery(store, 500, 12)

    expect(save).toHaveBeenCalled()
  })

  it('keeps a change in the browser when the page closes before the autosave', async () => {
    vi.useFakeTimers()
    await loadedStore()

    window.dispatchEvent(new Event('pagehide'))

    expect(saveDraftNow).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [expect.objectContaining({ id: 'busy' })]
      })
    )
  })

  it('leaves the browser copy alone when everything is saved', async () => {
    vi.useFakeTimers()
    await loadedStore()
    await vi.advanceTimersByTimeAsync(2000)

    window.dispatchEvent(new Event('pagehide'))

    expect(saveDraftNow).not.toHaveBeenCalled()
  })
})
