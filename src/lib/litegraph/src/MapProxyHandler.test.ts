import { describe, expect, it } from 'vitest'

import { MapProxyHandler } from '@/lib/litegraph/src/MapProxyHandler'

function createProxy<V>() {
  const map = new Map<number | string, V>()
  const handler = new MapProxyHandler<V>()
  const proxy = new Proxy(map, handler) as unknown as Map<number | string, V> &
    Record<string, V>
  return { map, proxy }
}

describe('MapProxyHandler', () => {
  describe('numeric string key conversion', () => {
    it('converts numeric string keys to integers on set/get', () => {
      const { map, proxy } = createProxy<string>()

      proxy['42'] = 'answer'
      expect(map.get(42)).toBe('answer')
      expect(proxy['42']).toBe('answer')
    })

    it('stores non-numeric string keys as strings', () => {
      const { map, proxy } = createProxy<string>()

      proxy['hello'] = 'world'
      expect(map.get('hello')).toBe('world')
      expect(proxy['hello']).toBe('world')
    })
  })

  describe('has trap (in operator)', () => {
    it('detects numeric string keys via the underlying int key', () => {
      const { map, proxy } = createProxy<string>()

      map.set(7, 'seven')
      expect('7' in proxy).toBe(true)
      expect('8' in proxy).toBe(false)
    })

    it('detects string keys', () => {
      const { map, proxy } = createProxy<string>()

      map.set('foo', 'bar')
      expect('foo' in proxy).toBe(true)
      expect('baz' in proxy).toBe(false)
    })
  })

  describe('deleteProperty trap', () => {
    it('deletes entries via the delete operator', () => {
      const { map, proxy } = createProxy<string>()

      map.set('key', 'value')
      delete (proxy as Record<string, unknown>)['key']
      expect(map.has('key')).toBe(false)
    })
  })

  describe('ownKeys trap', () => {
    it('returns all keys as strings via Object.keys', () => {
      const { map, proxy } = createProxy<string>()

      map.set(1, 'one')
      map.set(2, 'two')
      map.set('abc', 'letters')

      expect(Object.keys(proxy)).toEqual(['1', '2', 'abc'])
    })
  })

  describe('Map method access', () => {
    it('exposes Map properties like size through the proxy', () => {
      const { proxy } = createProxy<string>()

      proxy['1'] = 'one'
      proxy['2'] = 'two'

      expect(proxy.size).toBe(2)
    })
  })

  describe('bindAllMethods', () => {
    it('allows destructured Map methods to work without receiver', () => {
      const map = new Map<number | string, string>()
      MapProxyHandler.bindAllMethods(map)

      const { set, get, has, delete: del } = map
      set(1, 'one')
      expect(get(1)).toBe('one')
      expect(has(1)).toBe(true)
      del(1)
      expect(has(1)).toBe(false)
    })

    it('binds iterator methods', () => {
      const map = new Map<number | string, string>()
      map.set('a', '1')
      map.set('b', '2')
      MapProxyHandler.bindAllMethods(map)

      const { keys, values, entries } = map
      expect([...keys()]).toEqual(['a', 'b'])
      expect([...values()]).toEqual(['1', '2'])
      expect([...entries()]).toEqual([
        ['a', '1'],
        ['b', '2']
      ])
    })
  })
})
