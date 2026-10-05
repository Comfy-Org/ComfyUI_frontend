import { defineStore, getActivePinia } from 'pinia'
import { describe } from 'vitest'
import { ref, watch } from 'vue'

import { createDisposablePinia, test } from './pinia'

describe('test-owned Pinia', { tags: ['concurrent-safe'] }, () => {
  test.for([11, 29])(
    'keeps store state %i across an asynchronous boundary',
    async (value, { pinia, expect }) => {
      const useStore = defineStore('fixture-state', () => ({ value: ref(0) }))
      const store = useStore(pinia)
      expect(store.value).toBe(0)

      store.value = value
      await Promise.resolve()

      expect(useStore(pinia).value).toBe(value)
    }
  )

  test('disposes its own watchers even when another Pinia is active', ({
    pinia,
    expect,
    onTestFinished
  }) => {
    const source = ref(0)
    const useStore = defineStore('fixture-watcher', () => {
      const observations = ref(0)
      watch(source, () => observations.value++, { flush: 'sync' })
      return { observations }
    })
    const ownerStore = useStore(pinia)
    const peer = createDisposablePinia()
    const peerStore = useStore(peer.pinia)

    expect(() => {
      using disposable = peer
      expect(disposable.pinia).not.toBe(pinia)
      useStore(pinia)
      source.value++
      throw new Error('test scope failed')
    }).toThrow('test scope failed')

    expect(getActivePinia()).toBe(pinia)
    source.value++
    expect(ownerStore.observations).toBe(2)
    expect(peerStore.observations).toBe(1)

    onTestFinished(() => {
      source.value++
      expect(ownerStore.observations).toBe(2)
      expect(peerStore.observations).toBe(1)
    })
  })
})
