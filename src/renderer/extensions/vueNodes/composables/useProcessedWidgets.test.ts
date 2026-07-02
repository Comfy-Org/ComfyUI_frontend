import type { TooltipOptions } from 'primevue'
import { fromPartial } from '@total-typescript/shoehorn'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import {
  computeProcessedWidgets,
  getWidgetIdentity,
  hasWidgetError,
  isWidgetVisible
} from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import type { WidgetId } from '@/types/widgetId'

const GRAPH_ID = 'graph-test'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      graph: {
        rootGraph: {
          id: GRAPH_ID
        }
      }
    }
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
  } = {}
) {
  return useWidgetValueStore().registerWidget(id, {
    type: init.type ?? 'combo',
    value: 'value' in init ? init.value : 'value',
    label: init.label,
    options: init.options ?? {}
  })
}

function processWidgets({
  widgetIds,
  nodeId = toNodeId(1),
  nodeType = 'TestNode',
  showAdvanced = false,
  subgraphId,
  rootGraph = null
}: {
  widgetIds: readonly WidgetId[]
  nodeId?: NodeId
  nodeType?: string
  showAdvanced?: boolean
  subgraphId?: string | null
  rootGraph?: LGraph | null
}) {
  return computeProcessedWidgets({
    nodeData: {
      id: nodeId,
      type: nodeType,
      title: 'Test',
      mode: 0,
      selected: false,
      executing: false,
      inputs: [],
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

describe('getWidgetIdentity', () => {
  it('keys render identity by widgetId and widget type', () => {
    const id = widgetId(GRAPH_ID, toNodeId('subgraph:19'), 'text')
    const { dedupeIdentity, renderKey } = getWidgetIdentity(
      { widgetId: id, type: 'text' },
      toNodeId('1'),
      0
    )

    expect(dedupeIdentity).toBe(`${id}:text`)
    expect(renderKey).toBe(dedupeIdentity)
  })
})

describe('isWidgetVisible', () => {
  it('returns true for normal widgets', () => {
    expect(isWidgetVisible({}, false)).toBe(true)
  })

  it('returns false for hidden widgets', () => {
    expect(isWidgetVisible({ hidden: true }, false)).toBe(false)
  })

  it('returns false for advanced widgets when showAdvanced is false', () => {
    expect(isWidgetVisible({ advanced: true }, false)).toBe(false)
  })

  it('returns true for advanced widgets when showAdvanced is true', () => {
    expect(isWidgetVisible({ advanced: true }, true)).toBe(true)
  })

  it('keeps advanced widgets visible when linked and showAdvanced is false', () => {
    expect(isWidgetVisible({ advanced: true }, false, true)).toBe(true)
  })

  it('keeps hidden widgets hidden when linked', () => {
    expect(isWidgetVisible({ hidden: true }, false, true)).toBe(false)
  })
})

describe('hasWidgetError', () => {
  let executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  let missingModelStore: ReturnType<typeof useMissingModelStore>

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    executionErrorStore = useExecutionErrorStore()
    missingModelStore = useMissingModelStore()
  })

  it('returns false when no errors', () => {
    expect(
      hasWidgetError(
        { name: 'test_widget' },
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(false)
  })

  it('returns true when node has matching input error', () => {
    const nodeErrors = {
      errors: [{ extra_info: { input_name: 'seed' } }]
    }
    expect(
      hasWidgetError(
        { name: 'seed' },
        createNodeExecutionId([toNodeId(1)]),
        nodeErrors,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('returns true when the resolved source target has a matching error', () => {
    const sourceExecutionId = createNodeExecutionId([
      toNodeId(65),
      toNodeId(18)
    ])
    executionErrorStore.lastNodeErrors = {
      [sourceExecutionId]: {
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

    expect(
      hasWidgetError(
        {
          name: 'display_seed',
          errorTarget: {
            executionId: sourceExecutionId,
            widgetName: 'seed'
          }
        },
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('returns true when widget has missing model', () => {
    vi.spyOn(missingModelStore, 'isWidgetMissingModel').mockReturnValue(true)
    expect(
      hasWidgetError(
        { name: 'ckpt_name' },
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('matches missing models by the host widget name', () => {
    const spy = vi
      .spyOn(missingModelStore, 'isWidgetMissingModel')
      .mockReturnValue(true)
    expect(
      hasWidgetError(
        { name: 'display_slot' },
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
    expect(spy).toHaveBeenCalledWith('1', 'display_slot')
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
      value: 'state value',
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

    expect(result[0].value).toBeNull()
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
    expect(result[0].name).toBe('text')
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
    registerWidgetState(id, {
      type: 'unknown',
      value: 'model.safetensors',
      options: {}
    })
    useWidgetValueStore().registerWidgetRenderState(id, {
      advanced: true,
      hasLayoutSize: true,
      isDOMWidget: true,
      tooltip: 'Choose checkpoint'
    })

    const result = processWidgets({
      widgetIds: [id],
      nodeId: toNodeId('host'),
      showAdvanced: true
    })

    expect(result[0]).toMatchObject({
      advanced: true,
      hasLayoutSize: true,
      simplified: {
        name: 'display_slot'
      }
    })
    expect(result[0].vueComponent).toBe(WidgetDOM)
  })

  it('passes input spec to simplified widgets', () => {
    const id = widgetId(GRAPH_ID, toNodeId('host'), 'prompt')
    const spec = {
      type: 'STRING',
      name: 'prompt',
      socketless: true
    } satisfies InputSpec
    registerWidgetState(id, { type: 'text', value: 'hello' })
    useWidgetValueStore().registerWidgetSpec(id, spec)

    const result = processWidgets({ widgetIds: [id], nodeId: toNodeId('host') })

    expect(result[0].simplified.spec).toStrictEqual(spec)
  })

  it('treats explicit isDOMWidget false as authoritative', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'custom')
    registerWidgetState(id, { type: 'unknown' })
    useWidgetValueStore().registerWidgetRenderState(id, {
      isDOMWidget: false
    })

    const result = processWidgets({ widgetIds: [id] })

    expect(result[0].vueComponent).toBe(WidgetLegacy)
    expect(result[0].vueComponent).not.toBe(WidgetDOM)
  })
})

describe('widget disabled state (via computeProcessedWidgets)', () => {
  const NODE_ID = toNodeId(1)

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function processWithInputLink(link: number | null) {
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    const widget = createMockWidget({ name: 'seed', widgetId: id })
    registerWidgetState(id, { type: 'combo', value: 0 })

    const { graph, node } = createGraphWithNode([widget], NODE_ID)
    node.inputs = [
      fromPartial<INodeInputSlot>({
        name: 'seed',
        type: 'COMBO',
        link,
        widget: { name: 'seed' }
      })
    ]

    return processWidgets({
      widgetIds: [id],
      nodeId: NODE_ID,
      rootGraph: graph
    })
  }

  it('disables a widget whose input slot has a connecting link', () => {
    const [processed] = processWithInputLink(1)

    expect(processed.simplified.options?.disabled).toBe(true)
    expect(processed.slotMetadata?.linked).toBe(true)
  })

  it('keeps a widget enabled when its input slot has no link', () => {
    const [processed] = processWithInputLink(null)

    expect(processed.simplified.options?.disabled).toBeFalsy()
    expect(processed.slotMetadata?.linked).toBe(false)
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

  it('clears execution errors on update', () => {
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    registerWidgetState(id, { type: 'combo', value: 'bad-value' })

    const executionErrorStore = useExecutionErrorStore()
    const missingModelStore = useMissingModelStore()

    executionErrorStore.lastNodeErrors = {
      [NODE_ID]: {
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

    const [processed] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })

    expect(
      hasWidgetError(
        { name: 'seed' },
        createNodeExecutionId([NODE_ID]),
        executionErrorStore.lastNodeErrors[NODE_ID],
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)

    processed.updateHandler('fixed-value')

    expect(
      hasWidgetError(
        { name: 'seed' },
        createNodeExecutionId([NODE_ID]),
        executionErrorStore.lastNodeErrors?.[NODE_ID],
        executionErrorStore,
        missingModelStore
      )
    ).toBe(false)
  })

  it('clears execution errors from simplified callback without a live widget', () => {
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    registerWidgetState(id, { type: 'combo', value: 'bad-value' })

    const executionErrorStore = useExecutionErrorStore()
    const missingModelStore = useMissingModelStore()
    executionErrorStore.lastNodeErrors = {
      [NODE_ID]: {
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

    const [processed] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })

    expect(processed.simplified.callback).toBe(processed.updateHandler)

    processed.simplified.callback?.('fixed-value')

    expect(useWidgetValueStore().getWidget(id)?.value).toBe('fixed-value')
    expect(
      hasWidgetError(
        { name: 'seed' },
        createNodeExecutionId([NODE_ID]),
        executionErrorStore.lastNodeErrors?.[NODE_ID],
        executionErrorStore,
        missingModelStore
      )
    ).toBe(false)
  })
})
