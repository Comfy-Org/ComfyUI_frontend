import type { TooltipOptions } from 'primevue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import type * as GraphTraversalUtil from '@/utils/graphTraversalUtil'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import {
  computeProcessedWidgets,
  getWidgetIdentity,
  hasWidgetError,
  isWidgetVisible
} from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@/types/nodeIdentification'
import { widgetId } from '@/types/widgetId'
import { validationError } from '@/utils/__tests__/nodeErrorHelpers'

const GRAPH_ID = 'graph-test'

const { executionIdToNodeLocatorId } = vi.hoisted(() => ({
  executionIdToNodeLocatorId: vi.fn()
}))

vi.mock('@/utils/graphTraversalUtil', async (importActual) => {
  const actual = await importActual<typeof GraphTraversalUtil>()
  return {
    ...actual,
    executionIdToNodeLocatorId
  }
})

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      graph: {
        rootGraph: {
          id: toNodeId('graph-test')
        }
      }
    }
  })
}))

const createMockWidget = (
  overrides: Partial<SafeWidgetData> = {}
): SafeWidgetData => ({
  nodeId: toNodeId('test_node'),
  name: 'test_widget',
  type: 'combo',
  options: undefined,
  callback: undefined,
  spec: undefined,
  isDOMWidget: false,
  slotMetadata: undefined,
  ...overrides
})

describe('getWidgetIdentity', () => {
  it('keys dedupeIdentity by widgetId and widget type', () => {
    const id = widgetId(GRAPH_ID, toNodeId('subgraph:19'), 'text')
    const widget = createMockWidget({
      widgetId: id,
      name: 'text',
      type: 'text'
    })
    const { dedupeIdentity, renderKey } = getWidgetIdentity(
      widget,
      toNodeId('1'),
      0
    )
    expect(dedupeIdentity).toBe(`${id}:text`)
    expect(renderKey).toBe(dedupeIdentity)
  })

  it('falls back to host nodeId so duplicate normal widgets dedupe', () => {
    const widget = createMockWidget({
      nodeId: undefined,
      sourceExecutionId: undefined
    })
    const { dedupeIdentity, renderKey } = getWidgetIdentity(
      widget,
      toNodeId('5'),
      3
    )
    expect(dedupeIdentity).toBe('node:5:test_widget:combo')
    expect(renderKey).toBe(dedupeIdentity)
  })

  it('returns transient renderKey when no nodeId is available at all', () => {
    const widget = createMockWidget({
      nodeId: undefined,
      sourceExecutionId: undefined
    })
    const { dedupeIdentity, renderKey } = getWidgetIdentity(
      widget,
      undefined,
      3
    )
    expect(dedupeIdentity).toBeUndefined()
    expect(renderKey).toBe('transient::test_widget:combo:3')
  })

  it('uses sourceExecutionId for identity when no nodeId', () => {
    const widget = createMockWidget({
      nodeId: undefined,
      sourceExecutionId: createNodeExecutionId([toNodeId(65), toNodeId(18)])
    })
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
    const widget = createMockWidget()
    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(false)
  })

  it('returns true when node has matching input error', () => {
    const widget = createMockWidget({ name: 'seed' })
    const nodeErrors = {
      errors: [validationError('required_input_missing', 'seed')]
    }
    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([toNodeId(1)]),
        nodeErrors,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('returns true via sourceExecutionId when execution store has matching error', () => {
    const widget = createMockWidget({
      name: 'seed',
      sourceExecutionId: createNodeExecutionId([toNodeId(65), toNodeId(18)])
    })
    executionErrorStore.recordNodeErrors({
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
    })
    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('returns true when widget has missing model', () => {
    const widget = createMockWidget({ name: 'ckpt_name' })
    vi.spyOn(missingModelStore, 'isWidgetMissingModel').mockReturnValue(true)
    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('matches errors by the slot name (widget.name) for promoted widgets', () => {
    const widget = createMockWidget({
      name: 'display_slot',
      sourceWidgetName: 'internal_name'
    })
    const nodeErrors = {
      errors: [validationError('required_input_missing', 'display_slot')]
    }
    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([toNodeId(1)]),
        nodeErrors,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('matches missing models by the host widget name', () => {
    const widget = createMockWidget({
      name: 'display_slot',
      sourceExecutionId: createNodeExecutionId([toNodeId(65), toNodeId(18)]),
      sourceWidgetName: 'ckpt_name'
    })
    const spy = vi
      .spyOn(missingModelStore, 'isWidgetMissingModel')
      .mockReturnValue(true)
    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
    expect(spy).toHaveBeenCalledWith('1', 'display_slot')
  })

  it('matches raw interior errors by the source widget name for promoted widgets', () => {
    const sourceExecutionId = createNodeExecutionId([
      toNodeId(65),
      toNodeId(18)
    ])
    const widget = createMockWidget({
      name: 'display_slot',
      sourceExecutionId,
      sourceWidgetName: 'ckpt_name'
    })
    executionErrorStore.recordNodeErrors({
      [sourceExecutionId]: {
        errors: [
          {
            type: 'value_not_in_list',
            message: 'Invalid model',
            details: '',
            extra_info: { input_name: 'ckpt_name' }
          }
        ],
        class_type: 'CheckpointLoaderSimple',
        dependent_outputs: []
      }
    })
    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([toNodeId(1)]),
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })
})

const noopUi = {
  getTooltipConfig: () => ({}) as TooltipOptions,
  handleNodeRightClick: () => {}
}

describe('computeProcessedWidgets borderStyle', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('does not apply border styling to promoted widgets', () => {
    const id = widgetId(GRAPH_ID, toNodeId('inner-subgraph:1'), 'text')
    useWidgetValueStore().registerWidget(id, {
      type: 'combo',
      value: 'a',
      options: {},
      label: 'Text'
    })
    const promotedWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: toNodeId('inner-subgraph:1'),
      widgetId: id
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('3'),
        type: 'SubgraphNode',
        widgets: [promotedWidget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: 'graph-test',
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
    })

    expect(result[0].simplified.borderStyle).toBeUndefined()
    expect(result[0].simplified.label).toBe('Text')
  })

  it('does not apply border styling to regular widgets', () => {
    const widget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: toNodeId('inner-subgraph:1'),
      widgetId: widgetId(GRAPH_ID, toNodeId('inner-subgraph:1'), 'text')
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('4'),
        type: 'SubgraphNode',
        widgets: [widget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: 'graph-test',
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
    })

    expect(
      result.some((w) => w.simplified.borderStyle?.includes('promoted'))
    ).toBe(false)
  })

  it('applies advanced border styling to advanced widgets', () => {
    const advancedWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      options: { advanced: true }
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('1'),
        type: 'TestNode',
        widgets: [advancedWidget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: 'graph-test',
      showAdvanced: true,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
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
      nodeId: toNodeId('host'),
      name: 'stale name',
      type: 'combo',
      options: { values: ['stale value'] }
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('3'),
        type: 'SubgraphNode',
        widgets: [widget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: GRAPH_ID,
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
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

  it('uses widget nodeId for simplified widget locator when present', () => {
    const subgraphId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
    const widget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: toNodeId('inner-node')
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('host-node'),
        type: 'SubgraphNode',
        widgets: [widget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: [],
        subgraphId
      },
      graphId: GRAPH_ID,
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
    })

    expect(result[0].simplified.nodeLocatorId).toBe(
      createNodeLocatorId(subgraphId, toNodeId('inner-node'))
    )
  })

  it('resolves a promoted widget locator from its source execution id', () => {
    const sourceExecutionId = createNodeExecutionId([
      toNodeId('host-node'),
      toNodeId('inner-node')
    ])
    executionIdToNodeLocatorId.mockImplementationOnce((_graph, executionId) =>
      executionId === sourceExecutionId ? 'source:inner-node' : undefined
    )
    const widget = createMockWidget({
      name: 'curve',
      type: 'curve',
      nodeId: toNodeId('host-node'),
      sourceExecutionId
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('host-node'),
        type: 'SubgraphNode',
        widgets: [widget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: [],
        subgraphId: null
      },
      graphId: GRAPH_ID,
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: fromAny<LGraph, unknown>({}),
      ui: noopUi
    })

    expect(result[0].simplified.nodeLocatorId).toBe('source:inner-node')
    expect(executionIdToNodeLocatorId).toHaveBeenCalledWith(
      expect.anything(),
      sourceExecutionId
    )
  })

  it('deduplication keeps visible widget over hidden duplicate', () => {
    const sharedWidgetId = widgetId(GRAPH_ID, toNodeId('1'), 'text')
    const hiddenWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: toNodeId('1'),
      widgetId: sharedWidgetId,
      options: { hidden: true }
    })

    const visibleWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: toNodeId('1'),
      widgetId: sharedWidgetId
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('1'),
        type: 'TestNode',
        widgets: [hiddenWidget, visibleWidget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: 'graph-test',
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
    })

    expect(result).toHaveLength(1)
    expect(result[0].hidden).toBe(false)
  })

  it('collapses duplicate normal widgets on the same node to one render', () => {
    const colorA = createMockWidget({
      name: 'color',
      type: 'color',
      nodeId: undefined,
      sourceExecutionId: undefined
    })
    const colorB = createMockWidget({
      name: 'color',
      type: 'color',
      nodeId: undefined,
      sourceExecutionId: undefined
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('1'),
        type: 'ColorToRGBInt',
        widgets: [colorA, colorB],
        title: 'Color to RGB Int',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: 'graph-test',
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
    })

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('color')
    expect(result[0].renderKey).toBe('node:1:color:color')
  })

  it('omits the processed widget id when node id normalization fails', () => {
    const widget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: toNodeId('')
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: toNodeId('1'),
        type: 'TestNode',
        widgets: [widget],
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: 'graph-test',
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
    })

    expect(result[0].id).toBeUndefined()
  })
})

describe('createWidgetUpdateHandler (via computeProcessedWidgets)', () => {
  const GRAPH_ID = 'graph-test'
  const NODE_ID = toNodeId(1)

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  function processWidgets(widgets: SafeWidgetData[]) {
    return computeProcessedWidgets({
      nodeData: {
        id: NODE_ID,
        type: 'TestNode',
        widgets,
        title: 'Test',
        mode: 0,
        selected: false,
        executing: false,
        inputs: [],
        outputs: []
      },
      graphId: GRAPH_ID,
      showAdvanced: false,
      isGraphReady: false,
      rootGraph: null,
      ui: noopUi
    })
  }

  it('calls widget.callback with the new value when widgetState exists', () => {
    const callback = vi.fn()
    const widget = createMockWidget({
      name: 'seed',
      nodeId: NODE_ID,
      callback
    })

    useWidgetValueStore().registerWidget(widgetId(GRAPH_ID, NODE_ID, 'seed'), {
      type: 'combo',
      value: 0,
      options: {}
    })

    const [processed] = processWidgets([widget])
    processed.updateHandler(42)

    expect(callback).toHaveBeenCalledWith(42)
  })

  it('calls widget.callback even when widgetState is undefined (no store entry)', () => {
    const callback = vi.fn()
    const widget = createMockWidget({
      name: 'unregistered_widget',
      nodeId: NODE_ID,
      callback
    })

    const [processed] = processWidgets([widget])
    processed.updateHandler('new-value')

    expect(callback).toHaveBeenCalledWith('new-value')
  })

  it('updates widgetState.value when store entry exists', () => {
    const widget = createMockWidget({
      name: 'seed',
      nodeId: NODE_ID
    })

    useWidgetValueStore().registerWidget(widgetId(GRAPH_ID, NODE_ID, 'seed'), {
      type: 'combo',
      value: 0,
      options: {}
    })

    const [processed] = processWidgets([widget])
    processed.updateHandler(99)

    const state = useWidgetValueStore().getWidget(
      widgetId(GRAPH_ID, NODE_ID, 'seed')
    )
    expect(state?.value).toBe(99)
  })

  it('clears promoted missing models through the host widget identity', () => {
    const widget = createMockWidget({
      name: 'display_slot',
      nodeId: NODE_ID,
      sourceExecutionId: createNodeExecutionId([65, 18]),
      sourceWidgetName: 'ckpt_name'
    })

    const executionErrorStore = useExecutionErrorStore()
    const clearSpy = vi.spyOn(executionErrorStore, 'clearWidgetRelatedErrors')

    const [processed] = processWidgets([widget])
    processed.updateHandler('real_model.safetensors')

    expect(clearSpy).toHaveBeenCalledWith(
      createNodeExecutionId([65, 18]),
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

  it('clears raw interior errors through widget.sourceExecutionId, which boundary lift relies on', () => {
    const sourceExecutionId = createNodeExecutionId([65, 18])
    const widget = createMockWidget({
      name: 'display_slot',
      nodeId: NODE_ID,
      sourceExecutionId,
      sourceWidgetName: 'ckpt_name'
    })
    const executionErrorStore = useExecutionErrorStore()
    executionErrorStore.recordNodeErrors({
      [sourceExecutionId]: {
        errors: [
          {
            type: 'value_not_in_list',
            message: 'Invalid model',
            details: '',
            extra_info: { input_name: 'ckpt_name' }
          }
        ],
        class_type: 'CheckpointLoaderSimple',
        dependent_outputs: []
      }
    })

    const [processed] = processWidgets([widget])
    processed.updateHandler('real_model.safetensors')

    expect(executionErrorStore.lastNodeErrors).toBeNull()
  })

  it('clears execution errors on update', () => {
    const widget = createMockWidget({
      name: 'seed',
      nodeId: NODE_ID
    })

    const executionErrorStore = useExecutionErrorStore()
    const missingModelStore = useMissingModelStore()

    executionErrorStore.recordNodeErrors({
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
    })

    const [processed] = processWidgets([widget])

    expect(
      hasWidgetError(
        widget,
        createNodeExecutionId([NODE_ID]),
        executionErrorStore.lastNodeErrors?.[NODE_ID],
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
