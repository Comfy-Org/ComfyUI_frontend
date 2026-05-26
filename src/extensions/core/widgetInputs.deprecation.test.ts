import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { registerExtension } = vi.hoisted(() => ({
  registerExtension: vi.fn()
}))
vi.mock('@/scripts/app', () => ({
  app: { registerExtension }
}))

import { convertToInput } from '@/extensions/core/widgetInputs'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useDeprecationWarningsStore } from '@/platform/dev/deprecationWarningsStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

describe('widgetInputs deprecation', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    useDeprecationWarningsStore().clear()
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
  })

  describe('convertToInput', () => {
    it('returns the input slot whose widget name matches', () => {
      const slot = { widget: { name: 'seed' } }
      const node = createMockLGraphNode({
        inputs: [slot, { widget: { name: 'other' } }]
      })

      expect(convertToInput(node, { name: 'seed' } as IBaseWidget)).toBe(slot)
    })

    it('reports a deprecation warning to the store', () => {
      const node = createMockLGraphNode({ inputs: [] })

      convertToInput(node, { name: 'x' } as IBaseWidget)

      const store = useDeprecationWarningsStore()
      expect(store.warnings).toHaveLength(1)
      expect(store.warnings[0]).toMatchObject({
        message: 'convertToInput is no longer necessary.',
        source: 'widgetInputs'
      })
    })
  })

  describe('convertWidgetToInput prototype patch', () => {
    it('reports a deprecation when the patched method is called', async () => {
      const config = registerExtension.mock.calls.find(
        ([c]) => c?.name === 'Comfy.WidgetInputs'
      )?.[0]
      expect(config?.beforeRegisterNodeDef).toBeDefined()

      class MockNode {}
      await config.beforeRegisterNodeDef(MockNode, {})
      const instance = new MockNode() as { convertWidgetToInput: () => boolean }

      expect(instance.convertWidgetToInput()).toBe(false)

      const store = useDeprecationWarningsStore()
      expect(store.warnings[0]).toMatchObject({
        message: 'convertWidgetToInput is no longer necessary.',
        source: 'widgetInputs'
      })
    })
  })
})
