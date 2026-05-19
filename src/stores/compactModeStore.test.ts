import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCompactModeStore } from './compactModeStore'

describe('useCompactModeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('starts with compact mode disabled', () => {
    const store = useCompactModeStore()
    expect(store.isCompactMode).toBe(false)
  })

  it('toggle flips the value', () => {
    const store = useCompactModeStore()
    store.toggle()
    expect(store.isCompactMode).toBe(true)
    store.toggle()
    expect(store.isCompactMode).toBe(false)
  })

  it('set assigns the value directly', () => {
    const store = useCompactModeStore()
    store.set(true)
    expect(store.isCompactMode).toBe(true)
    store.set(false)
    expect(store.isCompactMode).toBe(false)
  })
})
