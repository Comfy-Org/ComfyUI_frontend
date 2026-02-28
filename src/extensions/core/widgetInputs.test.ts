import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ISerialisedNode } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

vi.mock('@/scripts/app', () => ({
  app: { registerExtension: vi.fn() }
}))

vi.mock('@/scripts/widgets', () => ({
  ComfyWidgets: {},
  addValueControlWidgets: vi.fn(),
  isValidWidgetType: vi.fn()
}))

vi.mock('@/platform/assets/services/assetService', () => ({
  assetService: { isAssetBrowserEligible: vi.fn() }
}))

vi.mock('@/platform/assets/utils/createAssetWidget', () => ({
  createAssetWidget: vi.fn()
}))

vi.mock('@/platform/distribution/types', () => ({
  isCloud: false
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn(() => ({ get: vi.fn() }))
}))

vi.mock('@/renderer/utils/nodeTypeGuards', () => ({
  isPrimitiveNode: vi.fn()
}))

vi.mock('@/services/litegraphService', () => ({
  CONFIG: {},
  GET_CONFIG: vi.fn()
}))

vi.mock('@/utils/searchAndReplace', () => ({
  applyTextReplacements: vi.fn()
}))

vi.mock('@/utils/nodeDefUtil', () => ({
  mergeInputSpec: vi.fn()
}))

// Must import PrimitiveNode after mocks are set up
const { PrimitiveNode } = await import('./widgetInputs')

function getMockSerialisedNode(
  data: Partial<ISerialisedNode>
): ISerialisedNode {
  return Object.assign(
    {
      id: 1,
      flags: {},
      type: 'PrimitiveNode',
      pos: [100, 100] as [number, number],
      size: [200, 60] as [number, number],
      order: 0,
      mode: 0
    },
    data
  )
}

function createPrimitiveNode(): InstanceType<typeof PrimitiveNode> {
  const node = LiteGraph.createNode('PrimitiveNode')!
  return node as InstanceType<typeof PrimitiveNode>
}

describe('PrimitiveNode serialize override', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.registerNodeType(
      'PrimitiveNode',
      Object.assign(PrimitiveNode, { title: 'Primitive' })
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('preserves widgets_values when node has no widgets', () => {
    const node = createPrimitiveNode()
    node.configure(
      getMockSerialisedNode({
        widgets_values: [42, 'randomize']
      })
    )

    // PrimitiveNode creates widgets only on connection, not on configure
    expect(node.widgets).toBeUndefined()
    // configure() stores widgets_values on the node via the generic property loop
    expect(node.widgets_values).toEqual([42, 'randomize'])

    const serialized = node.serialize()
    expect(serialized.widgets_values).toEqual([42, 'randomize'])
  })

  it('base LGraphNode.serialize produces no widgets_values for widgetless node', () => {
    const node = createPrimitiveNode()
    node.configure(
      getMockSerialisedNode({
        widgets_values: [42, 'randomize']
      })
    )

    // Call the BASE serialize (bypass PrimitiveNode override) to prove the bug
    const data = LGraphNode.prototype.serialize.call(node)

    // Base serialize sees no widgets → omits widgets_values entirely
    expect(data.widgets_values).toBeUndefined()
    // But the data IS stored on the instance
    expect(node.widgets_values).toEqual([42, 'randomize'])
  })

  it('clone produces a node with no widgets but with widgets_values', () => {
    const original = createPrimitiveNode()
    // Simulate a connected PrimitiveNode with widgets
    original.addWidget('number', 'value', 42, null)
    original.addWidget('combo', 'control_after_generate', 'randomize', null, {
      serialize: false,
      values: ['fixed', 'increment', 'decrement', 'randomize']
    })

    const clone = original.clone()
    expect(clone).not.toBeNull()

    // Clone is a fresh PrimitiveNode — no widgets (created only on connection)
    expect(clone!.widgets).toBeUndefined()
    // widgets_values was stored during configure() inside clone()
    expect(clone!.widgets_values).toBeDefined()
  })

  it('clone().serialize() preserves all widgets_values via the override', () => {
    const original = createPrimitiveNode()
    original.addWidget('number', 'value', 42, null)
    original.addWidget('combo', 'control_after_generate', 'randomize', null, {
      serialize: false,
      values: ['fixed', 'increment', 'decrement', 'randomize']
    })

    const clone = original.clone()
    const serialized = clone!.serialize()

    expect(serialized.widgets_values).toBeDefined()
    expect(serialized.widgets_values).toContain(42)
  })

  it('does not overwrite widgets_values when widgets exist', () => {
    const node = createPrimitiveNode()
    node.addWidget('number', 'value', 99, null)

    const serialized = node.serialize()
    expect(serialized.widgets_values).toBeDefined()
    expect(serialized.widgets_values![0]).toBe(99)
  })

  describe('widget.serialize vs widget.options.serialize', () => {
    it('widget.options.serialize=false does NOT set widget.serialize', () => {
      const node = createPrimitiveNode()
      const widget = node.addWidget(
        'combo',
        'control_after_generate',
        'randomize',
        null,
        { serialize: false, values: ['fixed', 'increment', 'decrement', 'randomize'] }
      )

      // widget.options.serialize is false
      expect(widget.options?.serialize).toBe(false)
      // widget.serialize is NOT false — it's undefined
      // LGraphNode.serialize() checks widget.serialize (line 967), NOT widget.options.serialize
      expect(widget.serialize).not.toBe(false)
    })

    it('widget with options.serialize=false is still included in serialize output', () => {
      const node = createPrimitiveNode()
      node.addWidget('number', 'value', 42, null)
      node.addWidget('combo', 'control_after_generate', 'randomize', null, {
        serialize: false,
        values: ['fixed', 'increment', 'decrement', 'randomize']
      })

      const serialized = node.serialize()
      // Both widget values are included because widget.serialize !== false
      // (widget.options.serialize is a different property)
      expect(serialized.widgets_values).toHaveLength(2)
      expect(serialized.widgets_values![0]).toBe(42)
      expect(serialized.widgets_values![1]).toBe('randomize')
    })
  })

  describe('copy-paste pipeline', () => {
    it('simulates item.clone().serialize() from LGraphCanvas.copyToClipboard', () => {
      const original = createPrimitiveNode()
      original.addWidget('number', 'value', 12345, null)
      original.addWidget(
        'combo',
        'control_after_generate',
        'increment',
        null,
        { serialize: false, values: ['fixed', 'increment', 'decrement', 'randomize'] }
      )

      // This is what LGraphCanvas line 3908 does
      const clipboardData = original.clone()?.serialize()

      expect(clipboardData).toBeDefined()
      expect(clipboardData!.widgets_values).toBeDefined()
      expect(clipboardData!.widgets_values).toContain(12345)
      expect(clipboardData!.widgets_values).toContain('increment')
    })
  })
})
