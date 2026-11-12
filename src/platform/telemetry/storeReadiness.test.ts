import type { Pinia } from 'pinia'
import { getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  markStoresPending,
  markStoresReady,
  whenStoresReady
} from './storeReadiness'

/**
 * The gate exists for the window before `main.ts` installs Pinia, so these
 * tests must opt out of the testing Pinia the global setup installs — and put
 * it back afterwards so the global teardown still disposes it.
 */
let globalPinia!: Pinia

beforeEach(() => {
  const pinia = getActivePinia()
  if (!pinia) throw new Error('vitest.setup.ts should install a testing Pinia')
  globalPinia = pinia
  setActivePinia(undefined)
})

afterEach(() => {
  markStoresReady()
  setActivePinia(globalPinia)
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
    setActivePinia(globalPinia)

    await expect(whenStoresReady()).resolves.toBeUndefined()
  })
})
