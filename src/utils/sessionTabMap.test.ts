import { beforeEach, describe, expect, it } from 'vitest'

import { createSessionTabMap } from '@/utils/sessionTabMap'

const PREFIX = 'test-prefix'

beforeEach(() => {
  sessionStorage.clear()
  ;(window as { name: string }).name = 'test-client'
})

describe('createSessionTabMap', () => {
  describe('basic operations', () => {
    it('stores a value readable via map.value.get', () => {
      const { map, set } = createSessionTabMap(PREFIX)
      set('node-1', 'tab-a')
      expect(map.value.get('node-1')).toBe('tab-a')
    })

    it('overwrites an existing key with a new value', () => {
      const { map, set } = createSessionTabMap(PREFIX)
      set('node-1', 'tab-a')
      set('node-1', 'tab-b')
      expect(map.value.get('node-1')).toBe('tab-b')
      expect(map.value.size).toBe(1)
    })

    it('is a no-op when setting the same key/value pair', () => {
      const { map, set } = createSessionTabMap(PREFIX)
      set('node-1', 'tab-a')
      const refAfterFirst = map.value

      set('node-1', 'tab-a')
      expect(map.value).toBe(refAfterFirst)
    })
  })

  describe('LRU eviction', () => {
    it('evicts oldest entries when exceeding maxEntries', () => {
      const { map, set } = createSessionTabMap(PREFIX, 3)
      set('a', '1')
      set('b', '2')
      set('c', '3')
      set('d', '4')

      expect(map.value.size).toBe(3)
      expect(map.value.has('a')).toBe(false)
      expect(map.value.get('b')).toBe('2')
      expect(map.value.get('c')).toBe('3')
      expect(map.value.get('d')).toBe('4')
    })

    it('refreshes key position on update, evicting the actual oldest', () => {
      const { map, set } = createSessionTabMap(PREFIX, 3)
      set('a', '1')
      set('b', '2')
      set('c', '3')

      // Update 'a' with a new value makes it newest; 'b' is now oldest
      set('a', 'updated')
      set('d', '4')

      expect(map.value.size).toBe(3)
      expect(map.value.has('b')).toBe(false)
      expect(map.value.get('a')).toBe('updated')
      expect(map.value.get('c')).toBe('3')
      expect(map.value.get('d')).toBe('4')
    })
  })

  describe('sessionStorage persistence', () => {
    it('persists data to sessionStorage under the correct key', () => {
      const { set } = createSessionTabMap(PREFIX)
      set('node-1', 'tab-a')

      const raw = sessionStorage.getItem(`${PREFIX}:test-client`)
      expect(raw).not.toBeNull()

      const entries: [string, string][] = JSON.parse(raw!)
      expect(entries).toEqual([['node-1', 'tab-a']])
    })

    it('persists multiple entries in insertion order', () => {
      const { set } = createSessionTabMap(PREFIX)
      set('x', '1')
      set('y', '2')

      const entries: [string, string][] = JSON.parse(
        sessionStorage.getItem(`${PREFIX}:test-client`)!
      )
      expect(entries).toEqual([
        ['x', '1'],
        ['y', '2']
      ])
    })
  })

  describe('restore on creation', () => {
    it('restores previously persisted data into the new map', () => {
      const entries: [string, string][] = [
        ['node-1', 'tab-a'],
        ['node-2', 'tab-b']
      ]
      sessionStorage.setItem(`${PREFIX}:test-client`, JSON.stringify(entries))

      const { map } = createSessionTabMap(PREFIX)
      expect(map.value.get('node-1')).toBe('tab-a')
      expect(map.value.get('node-2')).toBe('tab-b')
      expect(map.value.size).toBe(2)
    })
  })

  describe('migration', () => {
    it('migrates data from a different client key with the same prefix', () => {
      const entries: [string, string][] = [['node-1', 'tab-a']]
      sessionStorage.setItem(`${PREFIX}:client-1`, JSON.stringify(entries))
      ;(window as { name: string }).name = 'client-2'

      const { map } = createSessionTabMap(PREFIX)

      expect(map.value.get('node-1')).toBe('tab-a')
      // Old key is removed
      expect(sessionStorage.getItem(`${PREFIX}:client-1`)).toBeNull()
      // Data is persisted under the new key
      expect(sessionStorage.getItem(`${PREFIX}:client-2`)).not.toBeNull()
    })

    it('does not migrate data from a different prefix', () => {
      sessionStorage.setItem(
        'other-prefix:client-1',
        JSON.stringify([['x', '1']])
      )
      ;(window as { name: string }).name = 'client-2'

      const { map } = createSessionTabMap(PREFIX)
      expect(map.value.size).toBe(0)
    })
  })

  describe('graceful degradation', () => {
    it('works in-memory when window.name is empty', () => {
      ;(window as { name: string }).name = ''

      const { map, set } = createSessionTabMap(PREFIX)
      set('node-1', 'tab-a')

      expect(map.value.get('node-1')).toBe('tab-a')
    })
  })

  describe('reactivity', () => {
    it('produces a new Map reference on each set call', () => {
      const { map, set } = createSessionTabMap(PREFIX)
      const ref1 = map.value

      set('a', '1')
      const ref2 = map.value

      set('b', '2')
      const ref3 = map.value

      expect(ref1).not.toBe(ref2)
      expect(ref2).not.toBe(ref3)
    })
  })
})
