import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getStorageStats,
  getWithLruTracking,
  removeFromStorage,
  setWithLruEviction
} from './sessionStorageLruService'

describe('sessionStorageLruService', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setWithLruEviction', () => {
    it('stores data with LRU metadata wrapper', () => {
      const data = { nodes: [], links: [] }
      const result = setWithLruEviction('workflow:test', data)

      expect(result).toBe(true)

      const stored = sessionStorage.getItem('workflow:test')
      expect(stored).toBeTruthy()

      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveProperty('accessedAt')
      expect(parsed).toHaveProperty('data')
      expect(parsed.data).toEqual(data)
      expect(typeof parsed.accessedAt).toBe('number')
    })

    it('returns true on successful storage', () => {
      const result = setWithLruEviction('key', { test: 'data' })
      expect(result).toBe(true)
    })

    it('evicts LRU entries when quota is exceeded', () => {
      const oldEntry = { accessedAt: 1000, data: { old: 'data' } }
      const newEntry = { accessedAt: 2000, data: { new: 'data' } }

      sessionStorage.setItem('workflow:old', JSON.stringify(oldEntry))
      sessionStorage.setItem('workflow:new', JSON.stringify(newEntry))

      let callCount = 0
      const originalSetItem = sessionStorage.setItem.bind(sessionStorage)
      vi.spyOn(sessionStorage, 'setItem').mockImplementation((key, value) => {
        callCount++
        if (key === 'workflow:current' && callCount === 1) {
          const error = new DOMException('Quota exceeded', 'QuotaExceededError')
          throw error
        }
        return originalSetItem(key, value)
      })

      const result = setWithLruEviction(
        'workflow:current',
        { current: 'data' },
        /^workflow:/
      )

      expect(result).toBe(true)
      expect(sessionStorage.getItem('workflow:old')).toBeNull()
      expect(sessionStorage.getItem('workflow:new')).toBeTruthy()
    })

    it('returns false after max eviction attempts', () => {
      const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      })

      const result = setWithLruEviction('key', { test: 'data' })
      expect(result).toBe(false)

      spy.mockRestore()
    })
  })

  describe('getWithLruTracking', () => {
    it('returns null for non-existent key', () => {
      const result = getWithLruTracking('nonexistent')
      expect(result).toBeNull()
    })

    it('returns unwrapped data for new format entries', () => {
      const entry = { accessedAt: Date.now(), data: { nodes: [], links: [] } }
      sessionStorage.setItem('workflow:test', JSON.stringify(entry))

      const result = getWithLruTracking('workflow:test')
      expect(result).toEqual({ nodes: [], links: [] })
    })

    it('handles legacy format (unwrapped data) with accessedAt: 0', () => {
      const legacyData = { nodes: [1, 2, 3], links: [] }
      sessionStorage.setItem('workflow:legacy', JSON.stringify(legacyData))

      const result = getWithLruTracking('workflow:legacy')
      expect(result).toEqual(legacyData)
    })

    it('updates accessedAt when reading', () => {
      const oldTime = 1000
      const entry = { accessedAt: oldTime, data: { test: 'data' } }
      sessionStorage.setItem('workflow:test', JSON.stringify(entry))

      getWithLruTracking('workflow:test', true)

      const stored = JSON.parse(sessionStorage.getItem('workflow:test')!)
      expect(stored.accessedAt).toBeGreaterThan(oldTime)
    })

    it('does not update accessedAt when updateAccessTime is false', () => {
      const oldTime = 1000
      const entry = { accessedAt: oldTime, data: { test: 'data' } }
      sessionStorage.setItem('workflow:test', JSON.stringify(entry))

      getWithLruTracking('workflow:test', false)

      const stored = JSON.parse(sessionStorage.getItem('workflow:test')!)
      expect(stored.accessedAt).toBe(oldTime)
    })
  })

  describe('removeFromStorage', () => {
    it('removes item from session storage', () => {
      sessionStorage.setItem('key', 'value')
      expect(sessionStorage.getItem('key')).toBe('value')

      removeFromStorage('key')
      expect(sessionStorage.getItem('key')).toBeNull()
    })
  })

  describe('getStorageStats', () => {
    it('returns stats for all entries', () => {
      const entry1 = { accessedAt: 1000, data: { a: 1 } }
      const entry2 = { accessedAt: 2000, data: { b: 2 } }
      sessionStorage.setItem('workflow:a', JSON.stringify(entry1))
      sessionStorage.setItem('workflow:b', JSON.stringify(entry2))
      sessionStorage.setItem('other:c', 'value')

      const stats = getStorageStats()

      expect(stats.totalItems).toBe(3)
      expect(stats.matchingItems).toBe(3)
    })

    it('filters entries by pattern', () => {
      const entry1 = { accessedAt: 1000, data: { a: 1 } }
      const entry2 = { accessedAt: 2000, data: { b: 2 } }
      sessionStorage.setItem('workflow:a', JSON.stringify(entry1))
      sessionStorage.setItem('workflow:b', JSON.stringify(entry2))
      sessionStorage.setItem('other:c', 'value')

      const stats = getStorageStats(/^workflow:/)

      expect(stats.totalItems).toBe(3)
      expect(stats.matchingItems).toBe(2)
      expect(stats.entries).toHaveLength(2)
    })

    it('sorts entries by accessedAt (oldest first)', () => {
      const entry1 = { accessedAt: 2000, data: { newer: true } }
      const entry2 = { accessedAt: 1000, data: { older: true } }
      sessionStorage.setItem('workflow:newer', JSON.stringify(entry1))
      sessionStorage.setItem('workflow:older', JSON.stringify(entry2))

      const stats = getStorageStats(/^workflow:/)

      expect(stats.entries[0].key).toBe('workflow:older')
      expect(stats.entries[1].key).toBe('workflow:newer')
    })

    it('treats legacy entries as accessedAt: 0', () => {
      const legacyData = { nodes: [], links: [] }
      const newEntry = { accessedAt: 1000, data: { test: true } }
      sessionStorage.setItem('workflow:legacy', JSON.stringify(legacyData))
      sessionStorage.setItem('workflow:new', JSON.stringify(newEntry))

      const stats = getStorageStats(/^workflow:/)

      expect(stats.entries[0].key).toBe('workflow:legacy')
      expect(stats.entries[0].accessedAt).toBe(0)
    })
  })

  describe('LRU eviction order', () => {
    it('evicts oldest entries first (legacy before new)', () => {
      const legacyData = { nodes: [], links: [] }
      const newEntry = { accessedAt: Date.now(), data: { new: true } }

      sessionStorage.setItem('workflow:legacy', JSON.stringify(legacyData))
      sessionStorage.setItem('workflow:new', JSON.stringify(newEntry))

      let callCount = 0
      const originalSetItem = sessionStorage.setItem.bind(sessionStorage)
      vi.spyOn(sessionStorage, 'setItem').mockImplementation((key, value) => {
        callCount++
        if (key === 'workflow:current' && callCount === 1) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        return originalSetItem(key, value)
      })

      setWithLruEviction('workflow:current', { current: true }, /^workflow:/)

      expect(sessionStorage.getItem('workflow:legacy')).toBeNull()
      expect(sessionStorage.getItem('workflow:new')).toBeTruthy()
    })

    it('evicts oldest new-format entries when no legacy entries exist', () => {
      const oldEntry = { accessedAt: 1000, data: { old: true } }
      const newEntry = { accessedAt: 2000, data: { new: true } }

      sessionStorage.setItem('workflow:old', JSON.stringify(oldEntry))
      sessionStorage.setItem('workflow:new', JSON.stringify(newEntry))

      let callCount = 0
      const originalSetItem = sessionStorage.setItem.bind(sessionStorage)
      vi.spyOn(sessionStorage, 'setItem').mockImplementation((key, value) => {
        callCount++
        if (key === 'workflow:current' && callCount === 1) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        return originalSetItem(key, value)
      })

      setWithLruEviction('workflow:current', { current: true }, /^workflow:/)

      expect(sessionStorage.getItem('workflow:old')).toBeNull()
      expect(sessionStorage.getItem('workflow:new')).toBeTruthy()
    })
  })
})
