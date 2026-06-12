import { createTestingPinia } from '@pinia/testing'
import { getActivePinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEPRECATIONS,
  formatDeprecationConsole
} from '@/platform/dev/deprecations'

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

  it('formats the console message with the registry source tag, message and suggestion', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('widgetInputs.convertToInput')

    const entry = DEPRECATIONS['widgetInputs.convertToInput']
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      ...formatDeprecationConsole({
        source: entry.source,
        message: entry.message,
        suggestion: entry.suggestion
      })
    )
  })

  it('forwards extension and detail as structured fields, not baked into the message', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('nodeDef.defaultInputRequired', {
      extension: 'custom_nodes.devtools',
      detail: 'NodeA.seed'
    })

    const entry = DEPRECATIONS['nodeDef.defaultInputRequired']
    expect(warnSpy).toHaveBeenCalledExactlyOnceWith(
      ...formatDeprecationConsole({
        source: entry.source,
        message: entry.message,
        suggestion: entry.suggestion,
        extension: 'custom_nodes.devtools',
        detail: 'NodeA.seed'
      })
    )
  })

  it('does not re-log to console on subsequent duplicate calls post-pinia', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('changeTracker.checkState')
    warnDeprecated('changeTracker.checkState')
    warnDeprecated('changeTracker.checkState')

    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('keeps distinct detail as distinct entries so every affected target stays visible', async () => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    warnDeprecated('nodeDef.defaultInputRequired', { detail: 'NodeA.seed' })
    warnDeprecated('nodeDef.defaultInputRequired', { detail: 'NodeB.seed' })
    warnDeprecated('nodeDef.defaultInputRequired', { detail: 'NodeA.seed' })

    const store = useDeprecationWarningsStore()
    expect(store.warnings).toHaveLength(2)
    expect(warnSpy).toHaveBeenCalledTimes(2)
    const nodeA = store.warnings.find((w) => w.detail === 'NodeA.seed')
    expect(nodeA?.count).toBe(2)
  })

  it('buffers warnings fired before pinia is active; drains them into the store on first access', async () => {
    expect(getActivePinia()).toBeUndefined()

    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('changeTracker.checkState')
    warnDeprecated('maskEditor.openMaskEditor')
    warnDeprecated('changeTracker.checkState')

    // Console logs once per unique deprecation even before pinia is active —
    // the repeated checkState warning must not log twice.
    expect(warnSpy).toHaveBeenCalledTimes(2)

    setActivePinia(createTestingPinia({ stubActions: false }))
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')
    const store = useDeprecationWarningsStore()

    expect(store.warnings).toHaveLength(2)
    const checkState = store.warnings.find((w) =>
      w.message.includes('checkState')
    )
    expect(checkState?.count).toBe(2)
  })

  it('drains the pre-pinia buffer when the next warnDeprecated lands post-pinia', async () => {
    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')

    warnDeprecated('changeTracker.checkState')

    setActivePinia(createTestingPinia({ stubActions: false }))
    warnDeprecated('maskEditor.openMaskEditor')

    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')
    const store = useDeprecationWarningsStore()
    expect(store.warnings.map((w) => w.source).sort()).toEqual(
      [
        DEPRECATIONS['maskEditor.openMaskEditor'].source,
        DEPRECATIONS['changeTracker.checkState'].source
      ].sort()
    )
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

  it('proxies reads to the current key and warns once with the registry entry', async () => {
    const { defineDeprecatedProperty } =
      await import('@/platform/dev/warnDeprecated')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    const target: { element: string; inputEl?: string } = { element: 'hello' }
    defineDeprecatedProperty(target, 'inputEl', 'element', 'widget.inputEl')

    expect(target.inputEl).toBe('hello')
    expect(target.inputEl).toBe('hello')

    const store = useDeprecationWarningsStore()
    expect(store.warnings).toHaveLength(1)
    expect(store.warnings[0]).toMatchObject(DEPRECATIONS['widget.inputEl'])
  })

  it('proxies writes to the current key and warns', async () => {
    const { defineDeprecatedProperty } =
      await import('@/platform/dev/warnDeprecated')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    const target: { element: string; inputEl?: string } = { element: 'a' }
    defineDeprecatedProperty(target, 'inputEl', 'element', 'widget.inputEl')

    target.inputEl = 'b'
    expect(target.element).toBe('b')
    expect(useDeprecationWarningsStore().warnings).toHaveLength(1)
  })
})
