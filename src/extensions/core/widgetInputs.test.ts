import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: vi.fn(),
    configuringGraph: false
  }
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: { shouldUseAssetBrowser: () => false }
}))

import { PrimitiveNode } from './widgetInputs'

describe('PrimitiveNode serialize override', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('preserves widgets_values through clone-serialize when node has no widgets', () => {
    const node = new PrimitiveNode('test')
    node.widgets_values = [42, 'fixed', '']

    const serialized = node.serialize()

    expect(serialized.widgets_values).toEqual([42, 'fixed', ''])
  })

  it('uses base serialize when node has widgets', () => {
    const node = new PrimitiveNode('test')
    node.widgets_values = [99, 'decrement']
    node.addWidget('number', 'value', 42, () => {})

    const serialized = node.serialize()

    expect(serialized.widgets_values).toBeDefined()
    expect(serialized.widgets_values?.[0]).toBe(42)
  })
})
