import { createTestingPinia } from '@pinia/testing'
import { getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('warnDeprecated', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(undefined)
    vi.resetModules()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('formats the console message with source tag and suggestion suffix', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('use bar() instead of foo()', {
      source: 'frontend',
      suggestion: 'Migrate by 2.0.'
    })

    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      '[DEPRECATED:frontend] use bar() instead of foo() Migrate by 2.0.'
    )
  })

  it('omits the source tag when no source is provided', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('something is deprecated')

    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      '[DEPRECATED] something is deprecated'
    )
  })

  it('does not re-log to console on subsequent duplicate calls post-pinia', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('same', { source: 'a' })
    warnDeprecated('same', { source: 'a' })
    warnDeprecated('same', { source: 'a' })

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('buffers warnings fired before pinia is active; drains them into the store on first access', async () => {
    expect(getActivePinia()).toBeUndefined()

    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('early one', { source: 'boot' })
    warnDeprecated('early two', { source: 'boot' })
    warnDeprecated('early one', { source: 'boot' })

    expect(warnSpy).toHaveBeenCalledTimes(3)
    expect(warnSpy).toHaveBeenNthCalledWith(1, '[DEPRECATED:boot] early one')
    expect(warnSpy).toHaveBeenNthCalledWith(2, '[DEPRECATED:boot] early two')
    expect(warnSpy).toHaveBeenNthCalledWith(3, '[DEPRECATED:boot] early one')

    setActivePinia(createTestingPinia({ stubActions: false }))
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')
    const store = useDeprecationWarningsStore()

    expect(store.warnings).toHaveLength(2)
    const earlyOne = store.warnings.find((w) => w.message === 'early one')
    expect(earlyOne?.count).toBe(2)
  })

  it('drains the pre-pinia buffer when the next warnDeprecated lands post-pinia', async () => {
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('buffered', { source: 'boot' })

    setActivePinia(createTestingPinia({ stubActions: false }))
    warnDeprecated('post-pinia', { source: 'late' })

    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')
    const store = useDeprecationWarningsStore()
    expect(store.warnings.map((w) => w.message).sort()).toEqual([
      'buffered',
      'post-pinia'
    ])
  })
})

describe('defineDeprecatedProperty', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetModules()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  it('proxies reads to the current key and warns once', async () => {
    const { defineDeprecatedProperty } =
      await import('@/platform/dev/warnDeprecated')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    const target: { newName: string; oldName?: string } = { newName: 'hello' }
    defineDeprecatedProperty(
      target,
      'oldName',
      'newName',
      'target.oldName is deprecated.',
      { source: 'unit-test', suggestion: 'Use target.newName.' }
    )

    expect(target.oldName).toBe('hello')
    expect(target.oldName).toBe('hello')

    const store = useDeprecationWarningsStore()
    expect(store.warnings).toHaveLength(1)
    expect(store.warnings[0]).toMatchObject({
      message: 'target.oldName is deprecated.',
      suggestion: 'Use target.newName.',
      source: 'unit-test'
    })
  })

  it('proxies writes to the current key and warns', async () => {
    const { defineDeprecatedProperty } =
      await import('@/platform/dev/warnDeprecated')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    const target: { newName: string; oldName?: string } = { newName: 'a' }
    defineDeprecatedProperty(
      target,
      'oldName',
      'newName',
      'target.oldName is deprecated.'
    )

    target.oldName = 'b'
    expect(target.newName).toBe('b')
    expect(useDeprecationWarningsStore().warnings).toHaveLength(1)
  })
})
