import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyWidgets } from '@/scripts/widgets'
import { useWidgetStore } from '@/stores/widgetStore'

vi.mock('@/scripts/widgets', () => ({
  ComfyWidgets: {
    INT: vi.fn(),
    FLOAT: vi.fn(),
    STRING: vi.fn(),
    BOOLEAN: vi.fn(),
    COMBO: vi.fn()
  }
}))

vi.mock('@/schemas/nodeDefSchema', () => ({
  getInputSpecType: (spec: unknown[]) => spec[0]
}))

describe('widgetStore', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('widgets getter', () => {
    it('includes custom widgets after registration', () => {
      const store = useWidgetStore()
      const customFn = vi.fn()
      store.registerCustomWidgets({ CUSTOM_TYPE: customFn })
      expect(store.widgets.get('CUSTOM_TYPE')).toBe(customFn)
    })

    it('core widgets take precedence over custom widgets with same key', () => {
      const store = useWidgetStore()
      const override = vi.fn()
      store.registerCustomWidgets({ INT: override })
      expect(store.widgets.get('INT')).toBe(ComfyWidgets.INT)
    })
  })

  describe('inputIsWidget', () => {
    it('returns true for known widget type (v1 spec)', () => {
      const store = useWidgetStore()
      expect(store.inputIsWidget(['INT', {}] as const)).toBe(true)
    })

    it('returns false for unknown type (v1 spec)', () => {
      const store = useWidgetStore()
      expect(store.inputIsWidget(['UNKNOWN_TYPE', {}] as const)).toBe(false)
    })

    it('returns true for v2 spec with known type', () => {
      const store = useWidgetStore()
      expect(
        store.inputIsWidget({ type: 'STRING', name: 'test_input' })
      ).toBe(true)
    })

    it('returns false for v2 spec with unknown type', () => {
      const store = useWidgetStore()
      expect(
        store.inputIsWidget({ type: 'LATENT', name: 'test_input' })
      ).toBe(false)
    })

    it('returns true for custom registered type', () => {
      const store = useWidgetStore()
      store.registerCustomWidgets({ MY_WIDGET: vi.fn() })
      expect(
        store.inputIsWidget({ type: 'MY_WIDGET', name: 'test_input' })
      ).toBe(true)
    })
  })
})
