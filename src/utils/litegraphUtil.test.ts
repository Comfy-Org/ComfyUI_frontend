import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  LGraph,
  LGraphCanvas,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/types/serialisation'
import type { IWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import {
  compressWidgetInputSlots,
  createNode,
  migrateWidgetsValues
} from '@/utils/litegraphUtil'

vi.mock('@/lib/litegraph/src/litegraph', () => ({
  LiteGraph: {
    createNode: vi.fn()
  }
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => ({
    addAlert: vi.fn(),
    add: vi.fn(),
    remove: vi.fn()
  }))
}))

vi.mock('@/i18n', () => ({
  t: vi.fn((key: string) => key)
}))

function createMockCanvas(overrides: Partial<LGraphCanvas> = {}): LGraphCanvas {
  const mockGraph = {
    add: vi.fn((node) => node),
    change: vi.fn()
  } satisfies Partial<LGraph> as unknown as LGraph
  const mockCanvas: Partial<LGraphCanvas> = {
    graph_mouse: [100, 200],
    graph: mockGraph,
    ...overrides
  }
  return mockCanvas as LGraphCanvas
}

describe('createNode', () => {
  beforeEach(vi.clearAllMocks)

  it('should create a node successfully', async () => {
    const mockNode = { pos: [0, 0] }
    vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode as LGraphNode)

    const mockCanvas = createMockCanvas()
    const result = await createNode(mockCanvas, 'LoadImage')

    expect(LiteGraph.createNode).toHaveBeenCalledWith('LoadImage')
    expect(mockNode.pos).toEqual([100, 200])
    expect(mockCanvas.graph!.add).toHaveBeenCalledWith(mockNode)
    expect(mockCanvas.graph!.change).toHaveBeenCalled()
    expect(result).toBe(mockNode)
  })

  it('should return null when name is empty', async () => {
    const mockCanvas = createMockCanvas()
    const result = await createNode(mockCanvas, '')

    expect(LiteGraph.createNode).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('should handle graph being null', async () => {
    const mockNode = { pos: [0, 0] }
    const mockCanvas = createMockCanvas({ graph: null })
    vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode as LGraphNode)

    const result = await createNode(mockCanvas, 'LoadImage')

    expect(mockNode.pos).toEqual([0, 0])
    expect(result).toBeNull()
  })
  it('should set position based on canvas graph_mouse', async () => {
    const mockCanvas = createMockCanvas({ graph_mouse: [250, 350] })
    const mockNode = { pos: [0, 0] }
    vi.mocked(LiteGraph.createNode).mockReturnValue(mockNode as LGraphNode)

    await createNode(mockCanvas, 'LoadAudio')

    expect(mockNode.pos).toEqual([250, 350])
  })
})

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

    const widgets = [
      { name: 'normalInput', type: 'number' },
      { name: 'anotherNormal', type: 'number' }
    ] as Partial<IWidget>[] as IWidget[]

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
    const widgetValues: unknown[] = []

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

    const widgets = [
      { name: 'first', type: 'number' },
      { name: 'last', type: 'number' }
    ] as Partial<IWidget>[] as IWidget[]

    const widgetValues = ['first value', 'dummy', 'last value']

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual(['first value', 'last value'])
  })
  it('should correctly handle seed with unexpected value', () => {
    const inputDefs: Record<string, InputSpec> = {
      normalInput: {
        type: 'INT',
        name: 'normalInput',
        control_after_generate: true
      },
      forceInputField: {
        type: 'STRING',
        name: 'forceInputField',
        forceInput: true
      }
    }

    const widgets = [
      { name: 'normalInput', type: 'number' },
      { name: 'control_after_generate', type: 'string' }
    ] as Partial<IWidget>[] as IWidget[]

    const widgetValues = [42, 'fixed', 'unexpected widget value']

    const result = migrateWidgetsValues(inputDefs, widgets, widgetValues)
    expect(result).toEqual([42, 'fixed'])
  })
})

describe('compressWidgetInputSlots', () => {
  it('should remove unconnected widget input slots', () => {
    // Using partial mock - only including properties needed for test
    const graph = {
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
    } as Partial<ISerialisedGraph> as ISerialisedGraph

    compressWidgetInputSlots(graph)

    expect(graph.nodes[0].inputs).toEqual([
      { widget: { name: 'bar' }, link: 2, type: 'INT', name: 'bar' }
    ])
  })

  it('should update link target slots correctly', () => {
    const graph = {
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
    } as Partial<ISerialisedGraph> as ISerialisedGraph

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
    // Using partial mock - only including properties needed for test
    const graph = {
      nodes: [],
      links: []
    } as Partial<ISerialisedGraph> as ISerialisedGraph

    compressWidgetInputSlots(graph)

    expect(graph.nodes).toEqual([])
    expect(graph.links).toEqual([])
  })
})
