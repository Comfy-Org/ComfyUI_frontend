import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { InputSpec as InputSpecV2 } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec as InputSpecV1 } from '@/schemas/nodeDefSchema'
import { useWidgetStore } from '@/stores/widgetStore'

/** Cast shorthand — the mock bypasses Zod validation, so we only need the shape `inputIsWidget` reads. */
const v1 = (spec: unknown) => spec as InputSpecV1
const v2 = (spec: unknown) => spec as InputSpecV2

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
    it('includes core widgets', () => {
      const store = useWidgetStore()
      expect(store.widgets.has('INT')).toBe(true)
      expect(store.widgets.has('FLOAT')).toBe(true)
      expect(store.widgets.has('STRING')).toBe(true)
    })

    it('includes custom widgets after registration', () => {
      const store = useWidgetStore()
      const customFn = vi.fn()
      store.registerCustomWidgets({ CUSTOM_TYPE: customFn })
      expect(store.widgets.has('CUSTOM_TYPE')).toBe(true)
    })

    it('core widgets take precedence over custom widgets with same key', () => {
      const store = useWidgetStore()
      const override = vi.fn()
      store.registerCustomWidgets({ INT: override })
      // Core widgets are spread last, so they win
      expect(store.widgets.get('INT')).not.toBe(override)
    })
  })

  describe('registerCustomWidgets', () => {
    it('registers multiple custom widgets', () => {
      const store = useWidgetStore()
      store.registerCustomWidgets({
        TYPE_A: vi.fn(),
        TYPE_B: vi.fn()
      })
      expect(store.widgets.has('TYPE_A')).toBe(true)
      expect(store.widgets.has('TYPE_B')).toBe(true)
    })
  })

  describe('inputIsWidget', () => {
    it('returns true for known widget type (v1 spec)', () => {
      const store = useWidgetStore()
      expect(store.inputIsWidget(v1(['INT', {}]))).toBe(true)
    })

    it('returns false for unknown type (v1 spec)', () => {
      const store = useWidgetStore()
      expect(store.inputIsWidget(v1(['UNKNOWN_TYPE', {}]))).toBe(false)
    })

    it('returns true for v2 spec with known type', () => {
      const store = useWidgetStore()
      expect(
        store.inputIsWidget(v2({ type: 'STRING', name: 'test_input' }))
      ).toBe(true)
    })

    it('returns false for v2 spec with unknown type', () => {
      const store = useWidgetStore()
      expect(
        store.inputIsWidget(v2({ type: 'LATENT', name: 'test_input' }))
      ).toBe(false)
    })

    it('returns true for custom registered type', () => {
      const store = useWidgetStore()
      store.registerCustomWidgets({ MY_WIDGET: vi.fn() })
      expect(
        store.inputIsWidget(v2({ type: 'MY_WIDGET', name: 'test_input' }))
      ).toBe(true)
    })
  })
})
