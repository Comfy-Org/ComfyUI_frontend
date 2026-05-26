import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('installLiteGraphDeprecationBridge', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.resetModules()
  })

  it('forwards LiteGraph deprecation callbacks into the store', async () => {
    const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
    const { installLiteGraphDeprecationBridge } =
      await import('@/platform/dev/installLiteGraphDeprecationBridge')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    const baseline = LiteGraph.onDeprecationWarning.length
    installLiteGraphDeprecationBridge()
    expect(LiteGraph.onDeprecationWarning).toHaveLength(baseline + 1)

    const bridgeCallback = LiteGraph.onDeprecationWarning.at(-1)!
    bridgeCallback('bridge-test-message')

    const store = useDeprecationWarningsStore()
    expect(store.warnings).toHaveLength(1)
    expect(store.warnings[0]).toMatchObject({
      message: 'bridge-test-message',
      source: 'litegraph'
    })
  })

  it('only registers one forwarding callback no matter how many times install is called', async () => {
    const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
    const { installLiteGraphDeprecationBridge } =
      await import('@/platform/dev/installLiteGraphDeprecationBridge')

    const baseline = LiteGraph.onDeprecationWarning.length

    installLiteGraphDeprecationBridge()
    installLiteGraphDeprecationBridge()
    installLiteGraphDeprecationBridge()

    expect(LiteGraph.onDeprecationWarning).toHaveLength(baseline + 1)
  })

  it('drains warnings buffered before pinia was active when the first LiteGraph callback fires', async () => {
    setActivePinia(undefined)

    const { warnDeprecated } = await import('@/platform/dev/warnDeprecated')
    warnDeprecated('early-frontend', { source: 'frontend' })

    setActivePinia(createTestingPinia({ stubActions: false }))

    const { LiteGraph } = await import('@/lib/litegraph/src/litegraph')
    const { installLiteGraphDeprecationBridge } =
      await import('@/platform/dev/installLiteGraphDeprecationBridge')
    const { useDeprecationWarningsStore } =
      await import('@/platform/dev/deprecationWarningsStore')

    installLiteGraphDeprecationBridge()
    LiteGraph.onDeprecationWarning.at(-1)!('lg-message')

    const store = useDeprecationWarningsStore()
    expect(store.warnings.map((w) => w.message).sort()).toEqual([
      'early-frontend',
      'lg-message'
    ])
  })
})
