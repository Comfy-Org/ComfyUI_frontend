import { createPinia, setActivePinia } from 'pinia'
import { effectScope, ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useRaisedSurface, useRaisedSurfaceStore } from './raisedSurfaceStore'

describe('raisedSurfaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is empty by default', () => {
    const store = useRaisedSurfaceStore()
    expect(store.isAnyOpen).toBe(false)
    expect(store.stack).toHaveLength(0)
  })

  it('tracks open/close and reports isAnyOpen', () => {
    const store = useRaisedSurfaceStore()
    const id = store.open('context-menu')
    expect(store.isAnyOpen).toBe(true)
    expect(store.stack).toHaveLength(1)
    store.close(id)
    expect(store.isAnyOpen).toBe(false)
    expect(store.stack).toHaveLength(0)
  })

  it('supports concurrent surfaces and closes by id (LIFO not required)', () => {
    const store = useRaisedSurfaceStore()
    const a = store.open('context-menu')
    const b = store.open('popover')
    expect(store.stack).toHaveLength(2)
    store.close(a)
    expect(store.stack).toHaveLength(1)
    expect(store.stack[0].kind).toBe('popover')
    store.close(b)
    expect(store.isAnyOpen).toBe(false)
  })

  it('close is a no-op for unknown ids', () => {
    const store = useRaisedSurfaceStore()
    store.open('modal')
    store.close(Symbol('stale'))
    expect(store.stack).toHaveLength(1)
  })
})

describe('useRaisedSurface', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('opens when reactive flag turns true and closes when it turns false', () => {
    const store = useRaisedSurfaceStore()
    const isOpen = ref(false)
    const scope = effectScope()
    scope.run(() => useRaisedSurface('context-menu', isOpen))

    expect(store.isAnyOpen).toBe(false)
    isOpen.value = true
    expect(store.isAnyOpen).toBe(true)
    isOpen.value = false
    expect(store.isAnyOpen).toBe(false)
    scope.stop()
  })

  it('does not double-register when flag is toggled true twice', () => {
    const store = useRaisedSurfaceStore()
    const isOpen = ref(false)
    const scope = effectScope()
    scope.run(() => useRaisedSurface('context-menu', isOpen))

    isOpen.value = true
    isOpen.value = true
    expect(store.stack).toHaveLength(1)
    scope.stop()
  })

  it('releases the surface when the owning scope is disposed', () => {
    const store = useRaisedSurfaceStore()
    const isOpen = ref(true)
    const scope = effectScope()
    scope.run(() => useRaisedSurface('context-menu', isOpen))

    expect(store.isAnyOpen).toBe(true)
    scope.stop()
    expect(store.isAnyOpen).toBe(false)
  })
})
