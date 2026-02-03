import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useWidgetValueStore } from './widgetValueStore'

describe('useWidgetValueStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('stores and retrieves values', () => {
    const store = useWidgetValueStore()
    store.set('node-1', 'seed', 12345)
    expect(store.get('node-1', 'seed')).toBe(12345)
  })

  it('returns undefined for missing values', () => {
    const store = useWidgetValueStore()
    expect(store.get('missing', 'widget')).toBeUndefined()
  })

  it('removes single widget value', () => {
    const store = useWidgetValueStore()
    store.set('node-1', 'seed', 100)
    store.remove('node-1', 'seed')
    expect(store.get('node-1', 'seed')).toBeUndefined()
  })

  it('removes all widgets for a node', () => {
    const store = useWidgetValueStore()
    store.set('node-1', 'seed', 1)
    store.set('node-1', 'steps', 20)
    store.set('node-2', 'seed', 2)

    store.removeNode('node-1')

    expect(store.get('node-1', 'seed')).toBeUndefined()
    expect(store.get('node-1', 'steps')).toBeUndefined()
    expect(store.get('node-2', 'seed')).toBe(2)
  })

  it('overwrites existing values', () => {
    const store = useWidgetValueStore()
    store.set('node-1', 'seed', 100)
    store.set('node-1', 'seed', 200)
    expect(store.get('node-1', 'seed')).toBe(200)
  })

  it('stores different value types', () => {
    const store = useWidgetValueStore()
    store.set('node-1', 'text', 'hello')
    store.set('node-1', 'number', 42)
    store.set('node-1', 'boolean', true)
    store.set('node-1', 'array', [1, 2, 3])

    expect(store.get('node-1', 'text')).toBe('hello')
    expect(store.get('node-1', 'number')).toBe(42)
    expect(store.get('node-1', 'boolean')).toBe(true)
    expect(store.get('node-1', 'array')).toEqual([1, 2, 3])
  })
})
