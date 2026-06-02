import { createTestingPinia } from '@pinia/testing'
import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { getWidgetDefaultValue, renameWidget } from '@/utils/widgetUtil'
import type { WidgetId } from '@/world/entityIds'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

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
  return fromPartial<IBaseWidget>({
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
    setActivePinia(createTestingPinia({ stubActions: false }))
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

  it('renames host subgraph widget state and matching input without source identity', () => {
    const hostWidgetId = 'graph-id:7:seed' as WidgetId
    useWidgetValueStore().registerWidget(hostWidgetId, {
      type: 'number',
      value: 12,
      options: {},
      label: undefined
    })
    const widget = makeWidget({
      name: 'seed',
      widgetId: hostWidgetId
    })
    const input = {
      name: 'seed',
      widgetId: hostWidgetId,
      widget: { name: 'seed' },
      _widget: widget
    } as INodeInputSlot
    const subgraphNode = makeNode({ isSubgraph: true, inputs: [input] })

    const result = renameWidget(widget, subgraphNode, 'Renamed')

    expect(result).toBe(true)
    expect(useWidgetValueStore().getWidget(hostWidgetId)?.label).toBe('Renamed')
    expect(input.label).toBe('Renamed')
    expect(widget.label).toBe('Renamed')
  })

  it('renames source-like widgets locally when no widgetId state exists', () => {
    const widget = makeWidget({
      name: 'seed',
      sourceNodeId: '5',
      sourceWidgetName: 'innerSeed'
    })
    const node = makeNode({ isSubgraph: false })

    const result = renameWidget(widget, node, 'Renamed')

    expect(result).toBe(true)
    expect(widget.label).toBe('Renamed')
  })
})
