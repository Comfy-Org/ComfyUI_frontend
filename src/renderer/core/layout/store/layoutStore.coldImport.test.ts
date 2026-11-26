import { getActivePinia, setActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'

describe('layoutStore cold import', () => {
  it('allocates an empty store without timers, listeners, network requests, or a Pinia lookup', async () => {
    vi.useFakeTimers()
    setActivePinia(undefined)
    const windowListeners = vi.spyOn(window, 'addEventListener')
    const documentListeners = vi.spyOn(document, 'addEventListener')
    vi.resetModules()

    const { layoutStore } =
      await import('@/renderer/core/layout/store/layoutStore')

    expect({
      nodeCount: layoutStore.nodeCount,
      layoutVersion: layoutStore.layoutVersion,
      pendingTimers: vi.getTimerCount(),
      windowListeners: windowListeners.mock.calls.length,
      documentListeners: documentListeners.mock.calls.length,
      fetches: vi.mocked(fetch).mock.calls.length,
      activePinia: getActivePinia()
    }).toEqual({
      nodeCount: 0,
      layoutVersion: 0,
      pendingTimers: 0,
      windowListeners: 0,
      documentListeners: 0,
      fetches: 0,
      activePinia: undefined
    })
  })
})
