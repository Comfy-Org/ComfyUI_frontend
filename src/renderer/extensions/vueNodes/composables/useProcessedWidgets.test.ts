import type { TooltipOptions } from 'primevue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
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

const noopUi = {
  getTooltipConfig: () => ({}) as TooltipOptions,
  handleNodeRightClick: () => {}
}

function processWidgets({
  widgets,
  nodeId = toNodeId(1),
  nodeType = 'TestNode',
  showAdvanced = false,
  subgraphId
}: {
  widgets: IBaseWidget[]
  nodeId?: NodeId
  nodeType?: string
  showAdvanced?: boolean
  subgraphId?: string | null
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
    node: createNode(widgets, nodeId, nodeType),
    graphId: GRAPH_ID,
    showAdvanced,
    isGraphReady: false,
    rootGraph: null,
    ui: noopUi
  })
}

describe('getWidgetIdentity', () => {
  it('keys dedupeIdentity by widgetId and widget type', () => {
    const id = widgetId(GRAPH_ID, toNodeId('subgraph:19'), 'text')
    const widget = {
      widgetId: id,
      name: 'text',
      type: 'text'
    }
    const { dedupeIdentity, renderKey } = getWidgetIdentity(
      widget,
      toNodeId('1'),
      0
    )
    expect(dedupeIdentity).toBe(`${id}:text`)
    expect(renderKey).toBe(dedupeIdentity)
  })

  it('falls back to host nodeId so duplicate normal widgets dedupe', () => {
    const widget = { name: 'test_widget', type: 'combo' }
    const { dedupeIdentity, renderKey } = getWidgetIdentity(
      widget,
      toNodeId('5'),
      3
    )
    expect(dedupeIdentity).toBe('node:5:test_widget:combo')
    expect(renderKey).toBe(dedupeIdentity)
  })

  it('returns transient renderKey when no nodeId is available at all', () => {
    const widget = { name: 'test_widget', type: 'combo' }
    const { dedupeIdentity, renderKey } = getWidgetIdentity(
      widget,
      undefined,
      3
    )
    expect(dedupeIdentity).toBeUndefined()
    expect(renderKey).toBe('transient::test_widget:combo:3')
  })

  it('uses sourceExecutionId for identity when no nodeId', () => {
    const widget = {
      name: 'test_widget',
      type: 'combo',
      sourceExecutionId: createNodeExecutionId([toNodeId(65), toNodeId(18)])
    }
    const { dedupeIdentity } = getWidgetIdentity(widget, toNodeId('1'), 0)
    expect(dedupeIdentity).toBe('exec:65:18:test_widget:combo')
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

  it('returns true via sourceExecutionId when execution store has matching error', () => {
    executionErrorStore.lastNodeErrors = {
      '65:18': {
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
          name: 'seed',
          sourceExecutionId: createNodeExecutionId([toNodeId(65), toNodeId(18)])
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
        {
          name: 'display_slot',
          sourceExecutionId: createNodeExecutionId([toNodeId(65), toNodeId(18)])
        },
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
    const result = processWidgets({
      widgets: [
        createMockWidget({ name: 'text', options: { advanced: true } })
      ],
      showAdvanced: true
    })

    expect(result[0].simplified.borderStyle).toBe(
      'ring ring-component-node-widget-advanced'
    )
  })

  it('reads widget identity, value, label, and options from widgetId state', () => {
    const id = widgetId(GRAPH_ID, toNodeId('host'), 'text')
    useWidgetValueStore().registerWidget(id, {
      type: 'combo',
      value: 'state value',
      label: 'State Label',
      options: { values: ['state value'] }
    })
    const widget = createMockWidget({
      widgetId: id,
      name: 'stale name',
      options: { values: ['stale value'] }
    })

    const result = processWidgets({
      widgets: [widget],
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
    useWidgetValueStore().registerWidget(id, {
      type: 'combo',
      value: null,
      options: {}
    })

    const result = processWidgets({
      widgets: [
        createMockWidget({
          widgetId: id,
          name: 'text',
          value: 'stale value'
        })
      ],
      nodeId: toNodeId('host')
    })

    expect(result[0].value).toBeNull()
    expect(result[0].simplified.value).toBeNull()
  })

  it('uses widget state nodeId for simplified widget locator', () => {
    const subgraphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const id = widgetId(GRAPH_ID, toNodeId('inner-node'), 'text')
    useWidgetValueStore().registerWidget(id, {
      type: 'combo',
      value: 'a',
      options: {}
    })

    const result = processWidgets({
      widgets: [createMockWidget({ widgetId: id, name: 'text' })],
      nodeId: toNodeId('host-node'),
      nodeType: 'SubgraphNode',
      subgraphId
    })

    expect(result[0].simplified.nodeLocatorId).toBe(
      createNodeLocatorId(subgraphId, toNodeId('inner-node'))
    )
  })

  it('deduplication keeps visible widget over hidden duplicate', () => {
    const sharedWidgetId = widgetId(GRAPH_ID, toNodeId('1'), 'text')
    const hiddenWidget = createMockWidget({
      name: 'text',
      widgetId: sharedWidgetId,
      options: { hidden: true }
    })
    const visibleWidget = createMockWidget({
      name: 'text',
      widgetId: sharedWidgetId
    })

    const result = processWidgets({ widgets: [hiddenWidget, visibleWidget] })

    expect(result).toHaveLength(1)
    expect(result[0].hidden).toBe(false)
  })

  it('collapses duplicate normal widgets on the same node to one render', () => {
    const colorA = createMockWidget({ name: 'color', type: 'color' })
    const colorB = createMockWidget({ name: 'color', type: 'color' })

    const result = processWidgets({
      widgets: [colorA, colorB],
      nodeType: 'ColorToRGBInt'
    })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('color')
    expect(result[0].renderKey).toBe('graph-test:1:color:color')
  })

  it('reads render-only metadata from widgetValueStore render state', () => {
    const id = widgetId(GRAPH_ID, toNodeId('host'), 'display_slot')
    const sourceExecutionId = createNodeExecutionId([
      toNodeId(65),
      toNodeId(18)
    ])
    useWidgetValueStore().registerWidget(id, {
      type: 'combo',
      value: 'model.safetensors',
      options: {}
    })
    useWidgetValueStore().registerWidgetRenderState(id, {
      advanced: true,
      hasLayoutSize: true,
      isDOMWidget: true,
      sourceExecutionId,
      sourceWidgetName: 'ckpt_name',
      tooltip: 'Choose checkpoint'
    })

    const result = processWidgets({
      widgets: [createMockWidget({ widgetId: id, name: 'display_slot' })],
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
  })

  it('treats explicit isDOMWidget false as authoritative', () => {
    const widget = createMockWidget({ name: 'custom', type: 'unknown' })
    Object.assign(widget, { component: {}, isDOMWidget: false })

    const result = processWidgets({ widgets: [widget] })

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
    return processWidgets({ widgets, nodeId: NODE_ID })
  }

  it('calls widget.callback with the new value when widgetState exists', () => {
    const callback = vi.fn()
    const widget = createMockWidget({ name: 'seed', callback })

    useWidgetValueStore().registerWidget(widgetId(GRAPH_ID, NODE_ID, 'seed'), {
      type: 'combo',
      value: 0,
      options: {}
    })

    const [processed] = processUpdateWidgets([widget])
    processed.updateHandler(42)

    expect(callback).toHaveBeenCalledWith(42, undefined, expect.any(LGraphNode))
  })

  it('calls widget.callback even when widgetState is undefined', () => {
    const callback = vi.fn()
    const widget = createMockWidget({
      name: 'unregistered_widget',
      callback
    })

    const [processed] = processUpdateWidgets([widget])
    processed.updateHandler('new-value')

    expect(callback).toHaveBeenCalledWith(
      'new-value',
      undefined,
      expect.any(LGraphNode)
    )
  })

  it('updates widgetState.value when store entry exists', () => {
    const widget = createMockWidget({ name: 'seed' })

    useWidgetValueStore().registerWidget(widgetId(GRAPH_ID, NODE_ID, 'seed'), {
      type: 'combo',
      value: 0,
      options: {}
    })

    const [processed] = processUpdateWidgets([widget])
    processed.updateHandler(99)

    const state = useWidgetValueStore().getWidget(
      widgetId(GRAPH_ID, NODE_ID, 'seed')
    )
    expect(state?.value).toBe(99)
  })

  it('clears promoted missing models through the host widget identity', () => {
    const id = widgetId(GRAPH_ID, NODE_ID, 'display_slot')
    const sourceExecutionId = createNodeExecutionId([65, 18])
    const widget = createMockWidget({ name: 'display_slot', widgetId: id })
    useWidgetValueStore().registerWidget(id, {
      type: 'combo',
      value: 'missing.safetensors',
      options: {}
    })
    useWidgetValueStore().registerWidgetRenderState(id, {
      sourceExecutionId,
      sourceWidgetName: 'ckpt_name'
    })

    const executionErrorStore = useExecutionErrorStore()
    const clearSpy = vi.spyOn(executionErrorStore, 'clearWidgetRelatedErrors')

    const [processed] = processUpdateWidgets([widget])
    processed.updateHandler('real_model.safetensors')

    expect(clearSpy).toHaveBeenCalledWith(
      sourceExecutionId,
      'ckpt_name',
      'ckpt_name',
      'real_model.safetensors',
      { min: undefined, max: undefined }
    )
    expect(clearSpy).toHaveBeenCalledWith(
      createNodeExecutionId([NODE_ID]),
      'display_slot',
      'display_slot',
      'real_model.safetensors',
      { min: undefined, max: undefined }
    )
  })

  it('clears execution errors on update', () => {
    const widget = createMockWidget({ name: 'seed' })

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

    const [processed] = processUpdateWidgets([widget])

    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([NODE_ID]),
        executionErrorStore.lastNodeErrors[NODE_ID],
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)

    processed.updateHandler('fixed-value')

    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([NODE_ID]),
        executionErrorStore.lastNodeErrors?.[NODE_ID],
        executionErrorStore,
        missingModelStore
      )
    ).toBe(false)
  })
})
