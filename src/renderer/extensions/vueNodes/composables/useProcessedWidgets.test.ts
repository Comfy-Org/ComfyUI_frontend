import type { TooltipOptions } from 'primevue'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { SafeWidgetData } from '@/composables/graph/useGraphNodeManager'
import {
  computeProcessedWidgets,
  getWidgetIdentity,
  hasWidgetError,
  isWidgetVisible
} from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { usePromotionStore } from '@/stores/promotionStore'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    canvas: {
      graph: {
        rootGraph: {
          id: 'graph-test'
        }
      }
    }
  })
}))

const createMockWidget = (
  overrides: Partial<SafeWidgetData> = {}
): SafeWidgetData => ({
  nodeId: 'test_node',
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
  it('returns stable dedupeIdentity for widgets with storeNodeId', () => {
    const widget = createMockWidget({
      storeNodeId: 'subgraph:19',
      storeName: 'text',
      slotName: 'text',
      type: 'text'
    })
    const { dedupeIdentity, renderKey } = getWidgetIdentity(widget, '1', 0)
    expect(dedupeIdentity).toBe('node:19:text:text:text')
    expect(renderKey).toBe(dedupeIdentity)
  })

  it('returns transient renderKey for widgets without stable identity', () => {
    const widget = createMockWidget({
      nodeId: undefined,
      storeNodeId: undefined,
      sourceExecutionId: undefined
    })
    const { dedupeIdentity, renderKey } = getWidgetIdentity(widget, '5', 3)
    expect(dedupeIdentity).toBeUndefined()
    expect(renderKey).toBe('transient:5:test_widget:test_widget:combo:3')
  })

  it('uses sourceExecutionId for identity when no nodeId', () => {
    const widget = createMockWidget({
      nodeId: undefined,
      storeNodeId: undefined,
      sourceExecutionId: '65:18'
    })
    const { dedupeIdentity } = getWidgetIdentity(widget, '1', 0)
    expect(dedupeIdentity).toBe('exec:65:18:test_widget:test_widget:combo')
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
        '1',
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(false)
  })

  it('returns true when node has matching input error', () => {
    const widget = createMockWidget({ name: 'seed' })
    const nodeErrors = {
      errors: [{ extra_info: { input_name: 'seed' } }]
    }
    expect(
      hasWidgetError(
        widget,
        '1',
        nodeErrors,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('returns true via sourceExecutionId when execution store has matching error', () => {
    const widget = createMockWidget({
      name: 'seed',
      sourceExecutionId: '65:18'
    })
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
        widget,
        '1',
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
        '1',
        undefined,
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)
  })

  it('uses slotName for error matching when present', () => {
    const widget = createMockWidget({
      name: 'internal_name',
      slotName: 'display_slot'
    })
    const nodeErrors = {
      errors: [{ extra_info: { input_name: 'display_slot' } }]
    }
    expect(
      hasWidgetError(
        widget,
        '1',
        nodeErrors,
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

  it('applies promoted border styling to intermediate promoted widgets', () => {
    const promotedWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: 'inner-subgraph:1',
      storeNodeId: 'inner-subgraph:1',
      storeName: 'text',
      slotName: 'text'
    })

    usePromotionStore().promote('graph-test', '4', {
      sourceNodeId: '3',
      sourceWidgetName: 'text',
      disambiguatingSourceNodeId: '1'
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: '3',
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

    expect(
      result.some((w) => w.simplified.borderStyle?.includes('promoted'))
    ).toBe(true)
  })

  it('uses slotName when ancestor promotion keeps the host widget alias', () => {
    const promotedWidget = createMockWidget({
      name: 'string_a',
      type: 'combo',
      nodeId: 'inner-subgraph:10',
      storeNodeId: 'inner-subgraph:10',
      storeName: 'string_a',
      slotName: 'value_1'
    })

    usePromotionStore().promote('graph-test', '5', {
      sourceNodeId: '6',
      sourceWidgetName: 'value_1',
      disambiguatingSourceNodeId: '10'
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: '6',
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

    expect(
      result.some((w) => w.simplified.borderStyle?.includes('promoted'))
    ).toBe(true)
  })

  it('does not apply promoted border styling to outermost widgets', () => {
    const promotedWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: 'inner-subgraph:1',
      storeNodeId: 'inner-subgraph:1',
      storeName: 'text',
      slotName: 'text'
    })

    usePromotionStore().promote('graph-test', '4', {
      sourceNodeId: '3',
      sourceWidgetName: 'text',
      disambiguatingSourceNodeId: '1'
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: '4',
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
        id: '1',
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

  it('deduplication keeps visible widget over hidden duplicate', () => {
    const hiddenWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: '1',
      storeNodeId: '1',
      storeName: 'text',
      slotName: 'text',
      options: { hidden: true }
    })

    const visibleWidget = createMockWidget({
      name: 'text',
      type: 'combo',
      nodeId: '1',
      storeNodeId: '1',
      storeName: 'text',
      slotName: 'text'
    })

    const result = computeProcessedWidgets({
      nodeData: {
        id: '1',
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
})

describe('createWidgetUpdateHandler (via computeProcessedWidgets)', () => {
  const GRAPH_ID = 'graph-test'
  const NODE_ID = '1'

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

    useWidgetValueStore().registerWidget(GRAPH_ID, {
      nodeId: NODE_ID,
      name: 'seed',
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

    useWidgetValueStore().registerWidget(GRAPH_ID, {
      nodeId: NODE_ID,
      name: 'seed',
      type: 'combo',
      value: 0,
      options: {}
    })

    const [processed] = processWidgets([widget])
    processed.updateHandler(99)

    const state = useWidgetValueStore().getWidget(GRAPH_ID, NODE_ID, 'seed')
    expect(state?.value).toBe(99)
  })

  it('clears execution errors on update', () => {
    const widget = createMockWidget({
      name: 'seed',
      nodeId: NODE_ID
    })

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

    const [processed] = processWidgets([widget])

    expect(
      hasWidgetError(
        widget,
        NODE_ID,
        executionErrorStore.lastNodeErrors[NODE_ID],
        executionErrorStore,
        missingModelStore
      )
    ).toBe(true)

    processed.updateHandler('fixed-value')

    expect(
      hasWidgetError(
        widget,
        NODE_ID,
        executionErrorStore.lastNodeErrors?.[NODE_ID],
        executionErrorStore,
        missingModelStore
      )
    ).toBe(false)
  })
})
