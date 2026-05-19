import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the app module to prevent side effects from registerExtension at module load
vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: vi.fn()
  }
}))

// Mock services that might be called during module initialization
vi.mock('@/services/extensionService', () => ({
  useExtensionService: vi.fn(() => ({}))
}))

import { PrimitiveNode } from './widgetInputs'

describe('PrimitiveNode', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  describe('serialize', () => {
    it('preserves widgets_values when widgets array is empty (disconnected state)', () => {
      // Regression test for dante01yoon's review comment:
      // When a PrimitiveNode is disconnected, _removeWidgets() sets this.widgets = []
      // The base serialize() then creates widgets_values: [] from the empty widgets array.
      // We must fall back to the saved this.widgets_values snapshot.
      const node = new PrimitiveNode('Primitive')
      node.widgets = []
      node.widgets_values = ['preserved value', 42]

      const serialized = node.serialize()

      expect(serialized.widgets_values).toEqual(['preserved value', 42])
    })

    it('uses live widgets_values when widgets exist', () => {
      const node = new PrimitiveNode('Primitive')
      node.widgets = [
        {
          name: 'value',
          type: 'string',
          value: 'live value',
          options: {},
          y: 0
        }
      ]

      const serialized = node.serialize()

      expect(serialized.widgets_values).toEqual(['live value'])
    })
  })
})
