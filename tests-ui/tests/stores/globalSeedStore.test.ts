import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useGlobalSeedStore } from '@/stores/globalSeedStore'

describe('useGlobalSeedStore', () => {
  let store: ReturnType<typeof useGlobalSeedStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useGlobalSeedStore()
  })

  describe('initialization', () => {
    it('should initialize with a random global seed', () => {
      expect(typeof store.globalSeed).toBe('number')
      expect(store.globalSeed).toBeGreaterThanOrEqual(0)
      expect(store.globalSeed).toBeLessThan(1000000)
    })

    it('should create different seeds for different store instances', () => {
      const store1 = useGlobalSeedStore()
      setActivePinia(createPinia()) // Reset pinia
      const store2 = useGlobalSeedStore()

      // Very unlikely to be the same (1 in 1,000,000 chance)
      expect(store1.globalSeed).not.toBe(store2.globalSeed)
    })
  })

  describe('setGlobalSeed', () => {
    it('should update the global seed value', () => {
      const newSeed = 42

      store.setGlobalSeed(newSeed)

      expect(store.globalSeed).toBe(newSeed)
    })

    it('should accept any number value', () => {
      const testValues = [0, 1, 999999, 1000000, -1, 123.456]

      for (const value of testValues) {
        store.setGlobalSeed(value)
        expect(store.globalSeed).toBe(value)
      }
    })
  })

  describe('reactivity', () => {
    it('should be reactive when global seed changes', () => {
      const initialSeed = store.globalSeed
      const newSeed = initialSeed + 100

      store.setGlobalSeed(newSeed)

      expect(store.globalSeed).toBe(newSeed)
      expect(store.globalSeed).not.toBe(initialSeed)
    })
  })
})
