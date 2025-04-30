import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useContextKeyStore } from '@/stores/contextKeyStore'

describe('evalAst via evaluateCondition', () => {
  let store: ReturnType<typeof useContextKeyStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useContextKeyStore()
  })

  it('evaluates logical OR correctly', () => {
    store.setContextKey('a', true)
    store.setContextKey('b', false)
    const result = store.evaluateCondition('a || b')
    expect(result).toBe(true)
  })

  it('evaluates logical AND and NOT correctly', () => {
    store.setContextKey('a', true)
    store.setContextKey('b', false)
    const result = store.evaluateCondition('a && !b')
    expect(result).toBe(true)
  })

  it('evaluates OR and AND precedence correctly', () => {
    store.setContextKey('a', false)
    store.setContextKey('b', true)
    store.setContextKey('c', false)
    const result = store.evaluateCondition('a || b && c')
    expect(result).toBe(false)
  })

  it('evaluates equality and inequality with numeric values', () => {
    store.setContextKey('d', 1)
    store.setContextKey('e', 1)
    const eq = store.evaluateCondition('d == e')
    const neq = store.evaluateCondition('d != e')
    expect(eq).toBe(true)
    expect(neq).toBe(false)
  })

  it('checks identifier truthiness for string and zero numeric', () => {
    store.setContextKey('s', 'hello')
    store.setContextKey('z', 0)
    expect(store.evaluateCondition('s')).toBe(true)
    expect(store.evaluateCondition('!s')).toBe(false)
    expect(store.evaluateCondition('z')).toBe(false)
  })

  it('evaluates literals correctly', () => {
    store.setContextKey('s', 'hello')
    expect(store.evaluateCondition('s != "hello"')).toBe(false)
  })
})
