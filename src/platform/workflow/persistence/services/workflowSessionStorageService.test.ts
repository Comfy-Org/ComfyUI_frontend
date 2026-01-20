import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getWithAccessTracking,
  removeFromStorage,
  setWithEviction
} from './workflowSessionStorageService'

describe('workflowSessionStorageService', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('setWithEviction', () => {
    it('stores data with accessedAt wrapper', () => {
      const data = { nodes: [], links: [] }
      const result = setWithEviction('workflow:test', data)

      expect(result).toBe(true)

      const stored = sessionStorage.getItem('workflow:test')
      const parsed = JSON.parse(stored!)
      expect(parsed).toHaveProperty('accessedAt')
      expect(parsed).toHaveProperty('data')
      expect(parsed.data).toEqual(data)
    })

    it('evicts oldest entries when quota is exceeded', () => {
      const oldEntry = { accessedAt: 1000, data: { old: 'data' } }
      const newEntry = { accessedAt: 2000, data: { new: 'data' } }

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

      const result = setWithEviction(
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

      const result = setWithEviction('key', { test: 'data' })
      expect(result).toBe(false)

      spy.mockRestore()
    })

    it('returns false on unexpected errors', () => {
      const spy = vi.spyOn(sessionStorage, 'setItem').mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = setWithEviction('key', { test: 'data' })
      expect(result).toBe(false)

      spy.mockRestore()
    })
  })

  describe('getWithAccessTracking', () => {
    it('returns null for non-existent key', () => {
      expect(getWithAccessTracking('nonexistent')).toBeNull()
    })

    it('returns unwrapped data for new format entries', () => {
      const entry = { accessedAt: Date.now(), data: { nodes: [], links: [] } }
      sessionStorage.setItem('workflow:test', JSON.stringify(entry))

      const result = getWithAccessTracking('workflow:test')
      expect(result).toEqual({ nodes: [], links: [] })
    })

    it('handles legacy format with accessedAt: 0', () => {
      const legacyData = { nodes: [1, 2, 3], links: [] }
      sessionStorage.setItem('workflow:legacy', JSON.stringify(legacyData))

      const result = getWithAccessTracking('workflow:legacy')
      expect(result).toEqual(legacyData)
    })

    it('updates accessedAt when reading', () => {
      const oldTime = 1000
      const entry = { accessedAt: oldTime, data: { test: 'data' } }
      sessionStorage.setItem('workflow:test', JSON.stringify(entry))

      getWithAccessTracking('workflow:test', true)

      const stored = JSON.parse(sessionStorage.getItem('workflow:test')!)
      expect(stored.accessedAt).toBeGreaterThan(oldTime)
    })

    it('does not update accessedAt when updateAccessTime is false', () => {
      const oldTime = 1000
      const entry = { accessedAt: oldTime, data: { test: 'data' } }
      sessionStorage.setItem('workflow:test', JSON.stringify(entry))

      getWithAccessTracking('workflow:test', false)

      const stored = JSON.parse(sessionStorage.getItem('workflow:test')!)
      expect(stored.accessedAt).toBe(oldTime)
    })

    it('returns null for invalid JSON', () => {
      sessionStorage.setItem('workflow:invalid', 'not json')

      const result = getWithAccessTracking('workflow:invalid')
      expect(result).toBeNull()
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

  describe('eviction order', () => {
    it('evicts legacy entries (accessedAt: 0) before new entries', () => {
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

      setWithEviction('workflow:current', { current: true }, /^workflow:/)

      expect(sessionStorage.getItem('workflow:legacy')).toBeNull()
      expect(sessionStorage.getItem('workflow:new')).toBeTruthy()
    })

    it('does not evict protected keys', () => {
      const workspaceEntry = { accessedAt: 0, data: { workspace: true } }
      const workflowEntry = { accessedAt: 1000, data: { workflow: true } }

      sessionStorage.setItem(
        'workspace.settings',
        JSON.stringify(workspaceEntry)
      )
      sessionStorage.setItem('workflow:old', JSON.stringify(workflowEntry))

      let callCount = 0
      const originalSetItem = sessionStorage.setItem.bind(sessionStorage)
      vi.spyOn(sessionStorage, 'setItem').mockImplementation((key, value) => {
        callCount++
        if (key === 'workflow:current' && callCount === 1) {
          throw new DOMException('Quota exceeded', 'QuotaExceededError')
        }
        return originalSetItem(key, value)
      })

      setWithEviction('workflow:current', { current: true }, /^workflow:/)

      expect(sessionStorage.getItem('workspace.settings')).toBeTruthy()
      expect(sessionStorage.getItem('workflow:old')).toBeNull()
    })
  })
})
