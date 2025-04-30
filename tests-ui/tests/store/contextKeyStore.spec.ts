import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useContextKeyStore } from '@/stores/contextKeyStore'

describe('contextKeyStore', () => {
  let store: ReturnType<typeof useContextKeyStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useContextKeyStore()
  })

  it('should set and get a context key', () => {
    store.setContextKey('key1', true)
    expect(store.getContextKey('key1')).toBe(true)
  })

  it('should remove a context key', () => {
    store.setContextKey('key1', true)
    store.removeContextKey('key1')
    expect(store.getContextKey('key1')).toBeUndefined()
  })

  it('should clear all context keys', () => {
    store.setContextKey('key1', true)
    store.setContextKey('key2', false)
    store.clearAllContextKeys()
    expect(Object.keys(store.contextKeys)).toHaveLength(0)
  })

  it('should evaluate a simple condition', () => {
    store.setContextKey('key1', true)
    store.setContextKey('key2', false)
    expect(store.evaluateCondition('key1 && !key2')).toBe(true)
  })
})
