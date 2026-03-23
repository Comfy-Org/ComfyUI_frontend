import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { getWidgetDefaultValue, renameWidget } from '@/utils/widgetUtil'

describe('getWidgetDefaultValue', () => {
  it('returns undefined for undefined spec', () => {
    expect(getWidgetDefaultValue(undefined)).toBeUndefined()
  })

  it('returns explicit default when provided', () => {
    const spec = { type: 'INT', default: 42 } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe(42)
  })

  it.for([
    { type: 'INT', expected: 0 },
    { type: 'FLOAT', expected: 0 },
    { type: 'BOOLEAN', expected: false },
    { type: 'STRING', expected: '' }
  ])(
    'returns $expected for $type type without default',
    ({ type, expected }) => {
      const spec = { type } as InputSpec
      expect(getWidgetDefaultValue(spec)).toBe(expected)
    }
  )

  it('returns first option for array options without default', () => {
    const spec = { type: 'COMBO', options: ['a', 'b', 'c'] } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBe('a')
  })

  it('returns undefined for unknown type without options', () => {
    const spec = { type: 'CUSTOM' } as InputSpec
    expect(getWidgetDefaultValue(spec)).toBeUndefined()
  })
})

function makeWidget(overrides: Record<string, unknown> = {}): IBaseWidget {
  return {
    name: 'myWidget',
    type: 'number',
    value: 0,
    label: undefined,
    options: {},
    ...overrides
  } as unknown as IBaseWidget
}

function makeNode({
  isSubgraph = false,
  inputs = [] as INodeInputSlot[]
}: {
  isSubgraph?: boolean
  inputs?: INodeInputSlot[]
} = {}): LGraphNode {
  return {
    id: 1,
    inputs,
    isSubgraphNode: () => isSubgraph
  } as unknown as LGraphNode
}

describe('renameWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renames a regular widget and its matching input', () => {
    const widget = makeWidget({ name: 'seed' })
    const input = { name: 'seed', widget: { name: 'seed' } } as INodeInputSlot
    const node = makeNode({ inputs: [input] })

    const result = renameWidget(widget, node, 'My Seed')

    expect(result).toBe(true)
    expect(widget.label).toBe('My Seed')
    expect(input.label).toBe('My Seed')
  })

  it('clears label when given empty string', () => {
    const widget = makeWidget({ name: 'seed', label: 'Old Label' })
    const node = makeNode()

    renameWidget(widget, node, '')

    expect(widget.label).toBeUndefined()
  })

  it('does not propagate rename to interior node widgets or inputs', () => {
    const interiorWidget = makeWidget({ name: 'innerSeed', label: undefined })
    const interiorInput = {
      name: 'innerSeed',
      label: undefined,
      widget: { name: 'innerSeed' }
    } as INodeInputSlot
    const interiorNode = makeNode({ inputs: [interiorInput] })

    // Promoted widget on SubgraphNode exterior
    const promotedWidget = makeWidget({
      name: 'seed',
      sourceNodeId: '5',
      sourceWidgetName: 'innerSeed'
    })
    const subgraphInput = {
      name: 'seed',
      widget: { name: 'seed' }
    } as INodeInputSlot
    const subgraphNode = makeNode({
      isSubgraph: true,
      inputs: [subgraphInput]
    })

    const result = renameWidget(promotedWidget, subgraphNode, 'Renamed')

    expect(result).toBe(true)
    // External label changed
    expect(promotedWidget.label).toBe('Renamed')
    expect(subgraphInput.label).toBe('Renamed')
    // Interior widget and input remain untouched
    expect(interiorWidget.label).toBeUndefined()
    expect(interiorInput.label).toBeUndefined()
    // Interior node was never accessed
    expect(interiorNode.inputs[0].label).toBeUndefined()
  })

  it('only modifies the matching input, not other inputs', () => {
    const widget = makeWidget({ name: 'seed' })
    const matchingInput = {
      name: 'seed',
      widget: { name: 'seed' }
    } as INodeInputSlot
    const otherInput = {
      name: 'steps',
      widget: { name: 'steps' }
    } as INodeInputSlot
    const node = makeNode({ inputs: [matchingInput, otherInput] })

    renameWidget(widget, node, 'My Seed')

    expect(matchingInput.label).toBe('My Seed')
    expect(otherInput.label).toBeUndefined()
  })

  it('handles node with no inputs gracefully', () => {
    const widget = makeWidget({ name: 'seed' })
    const node = makeNode({ inputs: [] })

    const result = renameWidget(widget, node, 'Renamed')

    expect(result).toBe(true)
    expect(widget.label).toBe('Renamed')
  })
})
