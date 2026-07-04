import type { TooltipOptions } from 'primevue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import type { WidgetRenderState } from '@/stores/widgetValueStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'

const GRAPH_ID = 'graph-test'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    rootGraphId: GRAPH_ID
  })
}))

function createMockWidget(
  overrides: Partial<IBaseWidget> & { widgetId?: WidgetId } = {}
): IBaseWidget {
  const { widgetId: id, ...rest } = overrides
  const widget: IBaseWidget = {
    name: 'test_widget',
    type: 'combo',
    options: {},
    value: 'value',
    y: 0,
    ...rest
  }
  if (id) {
    Object.defineProperty(widget, 'widgetId', {
      value: id,
      configurable: true
    })
  }
  return widget
}

function createNode(
  widgets: IBaseWidget[],
  id: NodeId = toNodeId(1),
  type = 'TestNode'
): LGraphNode {
  const node = new LGraphNode(type)
  node.id = id
  node.type = type
  node.widgets = widgets
  return node
}

function createGraphWithNode(
  widgets: IBaseWidget[],
  id: NodeId = toNodeId(1),
  type = 'TestNode'
): { graph: LGraph; node: LGraphNode } {
  const graph = new LGraph()
  graph.id = GRAPH_ID
  const node = createNode(widgets, id, type)
  graph.add(node)
  return { graph, node }
}

const noopUi = {
  getTooltipConfig: () => ({}) as TooltipOptions,
  handleNodeRightClick: () => {}
}

function registerWidgetState(
  id: WidgetId,
  init: {
    type?: string
    value?: unknown
    label?: string
    options?: IBaseWidget['options']
  } = {},
  renderState: WidgetRenderState = {}
) {
  return useWidgetValueStore().registerWidget(
    id,
    {
      type: init.type ?? 'combo',
      value: 'value' in init ? init.value : 'value',
      label: init.label,
      options: init.options ?? {}
    },
    renderState
  )
}

function processWidgets({
  widgetIds,
  nodeId = toNodeId(1),
  nodeType = 'TestNode',
  showAdvanced = false,
  subgraphId,
  rootGraph = null,
  inputs = []
}: {
  widgetIds: readonly WidgetId[]
  nodeId?: NodeId
  nodeType?: string
  showAdvanced?: boolean
  subgraphId?: string | null
  rootGraph?: LGraph | null
  inputs?: INodeInputSlot[]
}) {
  return computeProcessedWidgets({
    nodeData: {
      id: nodeId,
      type: nodeType,
      title: 'Test',
      mode: 0,
      selected: false,
      executing: false,
      inputs,
      outputs: [],
      subgraphId
    },
    widgetIds,
    graphId: GRAPH_ID,
    showAdvanced,
    isGraphReady: false,
    rootGraph,
    ui: noopUi
  })
}

describe('widget visibility', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function visibilityOf(
    options: IBaseWidget['options'],
    { showAdvanced = false, linked = false } = {}
  ): boolean | undefined {
    const nodeId = toNodeId(1)
    const id = widgetId(GRAPH_ID, nodeId, 'w')
    registerWidgetState(id, { type: 'text', options })
    const inputs: INodeInputSlot[] = linked
      ? [
          {
            name: 'w',
            type: 'STRING',
            link: toLinkId(1),
            boundingRect: [0, 0, 0, 0]
          }
        ]
      : []
    if (linked) {
      useLinkStore().registerLink(GRAPH_ID, {
        id: toLinkId(1),
        originNodeId: toNodeId(2),
        originSlot: 0,
        targetNodeId: nodeId,
        targetSlot: 0,
        type: 'STRING'
      })
    }
    return processWidgets({ widgetIds: [id], showAdvanced, inputs })[0]?.visible
  }

  it('shows normal widgets', () => {
    expect(visibilityOf({})).toBe(true)
  })

  it('hides hidden widgets', () => {
    expect(visibilityOf({ hidden: true })).toBe(false)
  })

  it('hides advanced widgets unless advanced widgets are shown', () => {
    expect(visibilityOf({ advanced: true })).toBe(false)
    expect(visibilityOf({ advanced: true }, { showAdvanced: true })).toBe(true)
  })

  it('shows advanced widgets when linked even if advanced widgets are hidden', () => {
    expect(visibilityOf({ advanced: true }, { linked: true })).toBe(true)
  })

  it('keeps hidden widgets hidden even when linked', () => {
    expect(visibilityOf({ hidden: true }, { linked: true })).toBe(false)
  })
})

describe('widget error state', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function processWidgetNamed(name: string) {
    const id = widgetId(GRAPH_ID, toNodeId(1), name)
    registerWidgetState(id, { type: 'combo' })
    return processWidgets({ widgetIds: [id] })[0]
  }

  it('reports no error when the node has none', () => {
    expect(processWidgetNamed('test_widget').hasError).toBe(false)
  })

  it('reports an error when the node has a matching input error', () => {
    useExecutionErrorStore().lastNodeErrors = {
      [createNodeExecutionId([toNodeId(1)])]: {
        errors: [
          {
            type: 'required_input_missing',
            message: 'seed is required',
            details: '',
            extra_info: { input_name: 'seed' }
          }
        ],
        class_type: 'TestNode',
        dependent_outputs: []
      }
    }
    expect(processWidgetNamed('seed').hasError).toBe(true)
  })

  it('reports an error when the widget is a missing model', () => {
    vi.spyOn(useMissingModelStore(), 'isWidgetMissingModel').mockReturnValue(
      true
    )
    expect(processWidgetNamed('ckpt_name').hasError).toBe(true)
  })
})

describe('computeProcessedWidgets', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('applies advanced border styling to advanced widgets', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'text')
    registerWidgetState(id, { type: 'text', options: { advanced: true } })

    const result = processWidgets({ widgetIds: [id], showAdvanced: true })

    expect(result[0].simplified.borderStyle).toBe(
      'ring ring-component-node-widget-advanced'
    )
  })

  it('reads widget identity, value, label, and options from widgetId state', () => {
    const id = widgetId(GRAPH_ID, toNodeId('host'), 'text')
    registerWidgetState(id, {
      type: 'combo',
      value: 'state value',
      label: 'State Label',
      options: { values: ['state value'] }
    })

    const result = processWidgets({
      widgetIds: [id],
      nodeId: toNodeId('host'),
      nodeType: 'SubgraphNode'
    })

    expect(result[0]).toMatchObject({
      widgetId: id,
      renderKey: `${id}:combo`,
      simplified: {
        name: 'text',
        value: 'state value',
        label: 'State Label',
        options: { values: ['state value'] }
      }
    })
  })

  it('preserves null values from widgetId state', () => {
    const id = widgetId(GRAPH_ID, toNodeId('host'), 'text')
    registerWidgetState(id, {
      type: 'combo',
      value: null,
      options: {}
    })

    const result = processWidgets({
      widgetIds: [id],
      nodeId: toNodeId('host')
    })

    expect(result[0].simplified.value).toBeNull()
  })

  it('uses widget state nodeId for simplified widget locator', () => {
    const subgraphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const id = widgetId(GRAPH_ID, toNodeId('inner-node'), 'text')
    registerWidgetState(id, { type: 'combo', value: 'a', options: {} })

    const result = processWidgets({
      widgetIds: [id],
      nodeId: toNodeId('host-node'),
      nodeType: 'SubgraphNode',
      subgraphId
    })

    expect(result[0].simplified.nodeLocatorId).toBe(
      createNodeLocatorId(subgraphId, toNodeId('inner-node'))
    )
  })

  it('deduplicates repeated widget ids', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'text')
    registerWidgetState(id, { type: 'text' })

    const result = processWidgets({ widgetIds: [id, id] })

    expect(result).toHaveLength(1)
    expect(result[0].simplified.name).toBe('text')
  })

  it('keeps distinct widget ids separate even when names match', () => {
    const firstId = widgetId(GRAPH_ID, toNodeId('outer-subgraph:1'), 'text')
    const secondId = widgetId(GRAPH_ID, toNodeId('outer-subgraph:2'), 'text')
    registerWidgetState(firstId, { type: 'text' })
    registerWidgetState(secondId, { type: 'text' })

    const result = processWidgets({
      widgetIds: [firstId, secondId],
      nodeType: 'SubgraphNode'
    })

    expect(result).toHaveLength(2)
    expect(result.map((widget) => widget.widgetId)).toStrictEqual([
      firstId,
      secondId
    ])
  })

  it('reads render-only metadata from widgetValueStore render state', () => {
    const id = widgetId(GRAPH_ID, toNodeId('host'), 'display_slot')
    registerWidgetState(
      id,
      {
        type: 'unknown',
        value: 'model.safetensors',
        options: {}
      },
      {
        advanced: true,
        hasLayoutSize: true,
        isDOMWidget: true,
        tooltip: 'Choose checkpoint'
      }
    )

    const result = processWidgets({
      widgetIds: [id],
      nodeId: toNodeId('host'),
      showAdvanced: true
    })

    expect(result[0]).toMatchObject({
      hasLayoutSize: true,
      simplified: {
        name: 'display_slot',
        borderStyle: 'ring ring-component-node-widget-advanced'
      }
    })
    expect(result[0].vueComponent).toBe(WidgetDOM)
  })

  it('treats explicit isDOMWidget false as authoritative', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'custom')
    registerWidgetState(id, { type: 'unknown' }, { isDOMWidget: false })

    const result = processWidgets({ widgetIds: [id] })

    expect(result[0].vueComponent).toBe(WidgetLegacy)
    expect(result[0].vueComponent).not.toBe(WidgetDOM)
  })
})

describe('createWidgetUpdateHandler (via computeProcessedWidgets)', () => {
  const NODE_ID = toNodeId(1)

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function processUpdateWidgets(widgets: IBaseWidget[]) {
    const { graph } = createGraphWithNode(widgets, NODE_ID)
    const ids = widgets
      .map((widget) => widget.widgetId)
      .filter((id): id is WidgetId => id !== undefined)
    return processWidgets({ widgetIds: ids, nodeId: NODE_ID, rootGraph: graph })
  }

  it('calls widget.callback with the new value when a live widget exists', () => {
    const callback = vi.fn()
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    const widget = createMockWidget({ name: 'seed', widgetId: id, callback })
    registerWidgetState(id, { type: 'combo', value: 0 })

    const [processed] = processUpdateWidgets([widget])
    processed.updateHandler(42)

    expect(callback).toHaveBeenCalledWith(42, undefined, expect.any(LGraphNode))
  })

  it('updates widgetState.value when store entry exists', () => {
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    registerWidgetState(id, { type: 'combo', value: 0 })

    const [processed] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })
    processed.updateHandler(99)

    expect(useWidgetValueStore().getWidget(id)?.value).toBe(99)
  })

  function seedSeedError() {
    useExecutionErrorStore().lastNodeErrors = {
      [createNodeExecutionId([NODE_ID])]: {
        errors: [
          {
            type: 'required_input_missing',
            message: 'seed is required',
            details: '',
            extra_info: { input_name: 'seed' }
          }
        ],
        class_type: 'TestNode',
        dependent_outputs: []
      }
    }
  }

  it('clears execution errors on update', () => {
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    registerWidgetState(id, { type: 'combo', value: 'bad-value' })
    seedSeedError()

    const [processed] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })
    expect(processed.hasError).toBe(true)

    processed.updateHandler('fixed-value')

    const [afterUpdate] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })
    expect(afterUpdate.hasError).toBe(false)
  })

  it('clears execution errors from simplified callback without a live widget', () => {
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    registerWidgetState(id, { type: 'combo', value: 'bad-value' })
    seedSeedError()

    const [processed] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })
    expect(processed.simplified.callback).toBe(processed.updateHandler)

    processed.simplified.callback?.('fixed-value')

    expect(useWidgetValueStore().getWidget(id)?.value).toBe('fixed-value')
    const [afterUpdate] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })
    expect(afterUpdate.hasError).toBe(false)
  })
})

describe('live widget update handler', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('forwards null (not undefined) to both the live widget value and callback', () => {
    const callback = vi.fn()
    const id = widgetId(GRAPH_ID, toNodeId(1), 'test_widget')
    const liveWidget = createMockWidget({
      widgetId: id,
      name: 'test_widget',
      callback
    })
    const { graph } = createGraphWithNode([liveWidget], toNodeId(1))
    registerWidgetState(id, {
      type: 'combo',
      value: 'x',
      options: { values: ['x'] }
    })

    const [processed] = processWidgets({
      widgetIds: [id],
      nodeId: toNodeId(1),
      rootGraph: graph
    })

    processed.updateHandler(null)

    expect(liveWidget.value).toBeNull()
    expect(callback).toHaveBeenCalledTimes(1)
    expect(callback.mock.calls[0][0]).toBeNull()
  })
})
