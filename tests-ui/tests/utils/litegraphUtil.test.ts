import { ISerialisedGraph } from '@comfyorg/litegraph/dist/types/serialisation'
import type { IWidget } from '@comfyorg/litegraph/dist/types/widgets'
import { describe, expect, it } from 'vitest'

import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  compressWidgetInputSlots,
  migrateWidgetsValues
} from '@/utils/litegraphUtil'

describe('migrateWidgetsValues', () => {
  it('should remove widget values for forceInput inputs', () => {
    const inputDefs: Record<string, InputSpec> = {
      normalInput: {
        type: 'INT',
        name: 'normalInput'
      },
      forceInputField: {
        type: 'STRING',
        name: 'forceInputField',
        forceInput: true
      },
      anotherNormal: {
        type: 'FLOAT',
        name: 'anotherNormal'
      }
    }

    const widgets: IWidget[] = [
      { name: 'normalInput', type: 'number' },
      { name: 'anotherNormal', type: 'number' }
    ] as unknown as IWidget[]

    const widgetValues = [42, 'dummy value', 3.14]

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual([42, 3.14])
  })

  it('should return original values if lengths do not match', () => {
    const inputDefs: Record<string, InputSpec> = {
      input1: {
        type: 'INT',
        name: 'input1',
        forceInput: true
      }
    }

    const widgets: IWidget[] = []
    const widgetValues = [42, 'extra value']

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual(widgetValues)
  })

  it('should handle empty widgets and values', () => {
    const inputDefs: Record<string, InputSpec> = {}
    const widgets: IWidget[] = []
    const widgetValues: any[] = []

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual([])
  })

  it('should preserve order of non-forceInput widget values', () => {
    const inputDefs: Record<string, InputSpec> = {
      first: {
        type: 'INT',
        name: 'first'
      },
      forced: {
        type: 'STRING',
        name: 'forced',
        forceInput: true
      },
      last: {
        type: 'FLOAT',
        name: 'last'
      }
    }

    const widgets: IWidget[] = [
      { name: 'first', type: 'number' },
      { name: 'last', type: 'number' }
    ] as unknown as IWidget[]

    const widgetValues = ['first value', 'dummy', 'last value']

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual(['first value', 'last value'])
  })
})

describe('compressWidgetInputSlots', () => {
  it('should remove unconnected widget input slots', () => {
    const graph: ISerialisedGraph = {
      nodes: [
        {
          id: 1,
          type: 'foo',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [
            { widget: { name: 'foo' }, link: null, type: 'INT', name: 'foo' },
            { widget: { name: 'bar' }, link: 2, type: 'INT', name: 'bar' },
            { widget: { name: 'baz' }, link: null, type: 'INT', name: 'baz' }
          ],
          outputs: []
        }
      ],
      links: [[2, 1, 0, 1, 0, 'INT']]
    } as unknown as ISerialisedGraph

    compressWidgetInputSlots(graph)

    expect(graph.nodes[0].inputs).toEqual([
      { widget: { name: 'bar' }, link: 2, type: 'INT', name: 'bar' }
    ])
  })

  it('should update link target slots correctly', () => {
    const graph: ISerialisedGraph = {
      nodes: [
        {
          id: 1,
          type: 'foo',
          pos: [0, 0],
          size: [100, 100],
          flags: {},
          order: 0,
          mode: 0,
          inputs: [
            { widget: { name: 'foo' }, link: null, type: 'INT', name: 'foo' },
            { widget: { name: 'bar' }, link: 2, type: 'INT', name: 'bar' },
            { widget: { name: 'baz' }, link: 3, type: 'INT', name: 'baz' }
          ],
          outputs: []
        }
      ],
      links: [
        [2, 1, 0, 1, 1, 'INT'],
        [3, 1, 0, 1, 2, 'INT']
      ]
    } as unknown as ISerialisedGraph

    compressWidgetInputSlots(graph)

    expect(graph.nodes[0].inputs).toEqual([
      { widget: { name: 'bar' }, link: 2, type: 'INT', name: 'bar' },
      { widget: { name: 'baz' }, link: 3, type: 'INT', name: 'baz' }
    ])

    expect(graph.links).toEqual([
      [2, 1, 0, 1, 0, 'INT'],
      [3, 1, 0, 1, 1, 'INT']
    ])
  })

  it('should handle graphs with no nodes gracefully', () => {
    const graph: ISerialisedGraph = {
      nodes: [],
      links: []
    } as unknown as ISerialisedGraph

    compressWidgetInputSlots(graph)

    expect(graph.nodes).toEqual([])
    expect(graph.links).toEqual([])
  })
})
