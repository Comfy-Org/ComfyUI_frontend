import { createPinia, setActivePinia } from 'pinia'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  markStoresPending,
  markStoresReady,
  whenStoresReady
} from './storeReadiness'

afterEach(() => {
  markStoresReady()
  setActivePinia(undefined)
})

describe('whenStoresReady', () => {
  it('resolves immediately when no pending window was opened', async () => {
    await expect(whenStoresReady()).resolves.toBeUndefined()
  })

  it('blocks while stores are pending and resolves when they are ready', async () => {
    markStoresPending()
    const resolved = vi.fn()
    void whenStoresReady().then(resolved)

    await Promise.resolve()
    expect(resolved).not.toHaveBeenCalled()

    markStoresReady()
    await whenStoresReady()
    expect(resolved).toHaveBeenCalledOnce()
  })

  it('resolves during a pending window once a Pinia instance is active', async () => {
    markStoresPending()
    setActivePinia(createPinia())

    await expect(whenStoresReady()).resolves.toBeUndefined()
  })
})
