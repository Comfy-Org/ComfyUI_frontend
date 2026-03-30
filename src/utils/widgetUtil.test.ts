import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { getWidgetDefaultValue, renameWidget } from '@/utils/widgetUtil'
import { fromAny } from '@total-typescript/shoehorn'

vi.mock('@/core/graph/subgraph/resolvePromotedWidgetSource', () => ({
  resolvePromotedWidgetSource: vi.fn()
}))

import { resolvePromotedWidgetSource } from '@/core/graph/subgraph/resolvePromotedWidgetSource'

const mockedResolve = vi.mocked(resolvePromotedWidgetSource)

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
  return fromAny<IBaseWidget, unknown>({
    name: 'myWidget',
    type: 'number',
    value: 0,
    label: undefined,
    options: {},
    ...overrides
  })
}

function makeNode({
  isSubgraph = false,
  inputs = [] as INodeInputSlot[]
}: {
  isSubgraph?: boolean
  inputs?: INodeInputSlot[]
} = {}): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: 1,
    inputs,
    isSubgraphNode: () => isSubgraph
  })
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

  it('renames promoted widget source when node is a subgraph without explicit parents', () => {
    const sourceWidget = makeWidget({ name: 'innerSeed' })
    const interiorInput = {
      name: 'innerSeed',
      widget: { name: 'innerSeed' }
    } as INodeInputSlot
    const interiorNode = makeNode({ inputs: [interiorInput] })

    mockedResolve.mockReturnValue({
      widget: sourceWidget,
      node: interiorNode
    })

    const promotedWidget = makeWidget({
      name: 'seed',
      sourceNodeId: '5',
      sourceWidgetName: 'innerSeed'
    })
    const subgraphNode = makeNode({ isSubgraph: true })

    const result = renameWidget(promotedWidget, subgraphNode, 'Renamed')

    expect(result).toBe(true)
    expect(sourceWidget.label).toBe('Renamed')
    expect(interiorInput.label).toBe('Renamed')
    expect(promotedWidget.label).toBe('Renamed')
  })

  it('updates _subgraphSlot.label when input has a subgraph slot', () => {
    const widget = makeWidget({ name: 'seed' })
    const subgraphSlot = { label: undefined as string | undefined }
    const input = fromAny<INodeInputSlot, unknown>({
      name: 'seed',
      widget: { name: 'seed' },
      _subgraphSlot: subgraphSlot
    })
    const node = makeNode({ inputs: [input] })

    renameWidget(widget, node, 'New Label')

    expect(subgraphSlot.label).toBe('New Label')
  })

  it('does not resolve promoted widget source for non-subgraph node without parents', () => {
    const promotedWidget = makeWidget({
      name: 'seed',
      sourceNodeId: '5',
      sourceWidgetName: 'innerSeed'
    })
    const node = makeNode({ isSubgraph: false })

    const result = renameWidget(promotedWidget, node, 'Renamed')

    expect(result).toBe(true)
    expect(mockedResolve).not.toHaveBeenCalled()
    expect(promotedWidget.label).toBe('Renamed')
  })
})
