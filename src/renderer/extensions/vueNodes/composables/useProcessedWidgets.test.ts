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
})

describe('computeProcessedWidgets borderStyle', () => {
  let promotionStore: ReturnType<typeof usePromotionStore>
  let executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  let missingModelStore: ReturnType<typeof useMissingModelStore>
  let widgetValueStore: ReturnType<typeof useWidgetValueStore>

  const noopTooltip = () => ''
  const noopTooltipConfig = () => ({}) as never
  const noopRightClick = () => {}

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    promotionStore = usePromotionStore()
    executionErrorStore = useExecutionErrorStore()
    missingModelStore = useMissingModelStore()
    widgetValueStore = useWidgetValueStore()
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

    promotionStore.promote('graph-test', '4', {
      sourceNodeId: '3',
      sourceWidgetName: 'text',
      disambiguatingSourceNodeId: '1'
    })

    const nodeData = {
      id: '3',
      type: 'SubgraphNode',
      widgets: [promotedWidget],
      title: 'Test',
      mode: 0,
      selected: false,
      executing: false,
      inputs: [],
      outputs: []
    }

    const result = computeProcessedWidgets(
      nodeData,
      'graph-test',
      false,
      false,
      null,
      promotionStore,
      executionErrorStore,
      missingModelStore,
      widgetValueStore,
      noopTooltip,
      noopTooltipConfig,
      noopRightClick
    )

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

    promotionStore.promote('graph-test', '4', {
      sourceNodeId: '3',
      sourceWidgetName: 'text',
      disambiguatingSourceNodeId: '1'
    })

    const nodeData = {
      id: '4',
      type: 'SubgraphNode',
      widgets: [promotedWidget],
      title: 'Test',
      mode: 0,
      selected: false,
      executing: false,
      inputs: [],
      outputs: []
    }

    const result = computeProcessedWidgets(
      nodeData,
      'graph-test',
      false,
      false,
      null,
      promotionStore,
      executionErrorStore,
      missingModelStore,
      widgetValueStore,
      noopTooltip,
      noopTooltipConfig,
      noopRightClick
    )

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

    const nodeData = {
      id: '1',
      type: 'TestNode',
      widgets: [advancedWidget],
      title: 'Test',
      mode: 0,
      selected: false,
      executing: false,
      inputs: [],
      outputs: []
    }

    const result = computeProcessedWidgets(
      nodeData,
      'graph-test',
      true,
      false,
      null,
      promotionStore,
      executionErrorStore,
      missingModelStore,
      widgetValueStore,
      noopTooltip,
      noopTooltipConfig,
      noopRightClick
    )

    expect(result[0].simplified.borderStyle).toBe(
      'ring ring-component-node-widget-advanced'
    )
  })
})

describe('createWidgetUpdateHandler (via computeProcessedWidgets)', () => {
  let promotionStore: ReturnType<typeof usePromotionStore>
  let executionErrorStore: ReturnType<typeof useExecutionErrorStore>
  let missingModelStore: ReturnType<typeof useMissingModelStore>
  let widgetValueStore: ReturnType<typeof useWidgetValueStore>

  const noopTooltip = () => ''
  const noopTooltipConfig = () => ({}) as never
  const noopRightClick = () => {}

  const GRAPH_ID = 'graph-test'
  const NODE_ID = '1'

  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    promotionStore = usePromotionStore()
    executionErrorStore = useExecutionErrorStore()
    missingModelStore = useMissingModelStore()
    widgetValueStore = useWidgetValueStore()
  })

  function makeNodeData(widgets: SafeWidgetData[]) {
    return {
      id: NODE_ID,
      type: 'TestNode',
      widgets,
      title: 'Test',
      mode: 0,
      selected: false,
      executing: false,
      inputs: [],
      outputs: []
    }
  }

  function processWidgets(widgets: SafeWidgetData[]) {
    return computeProcessedWidgets(
      makeNodeData(widgets),
      GRAPH_ID,
      false,
      false,
      null,
      promotionStore,
      executionErrorStore,
      missingModelStore,
      widgetValueStore,
      noopTooltip,
      noopTooltipConfig,
      noopRightClick
    )
  }

  it('calls widget.callback with the new value when widgetState exists', () => {
    const callback = vi.fn()
    const widget = createMockWidget({
      name: 'seed',
      nodeId: NODE_ID,
      callback
    })

    widgetValueStore.registerWidget(GRAPH_ID, {
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

    widgetValueStore.registerWidget(GRAPH_ID, {
      nodeId: NODE_ID,
      name: 'seed',
      type: 'combo',
      value: 0,
      options: {}
    })

    const [processed] = processWidgets([widget])
    processed.updateHandler(99)

    const state = widgetValueStore.getWidget(GRAPH_ID, NODE_ID, 'seed')
    expect(state?.value).toBe(99)
  })

  it('clears execution errors on update', () => {
    const widget = createMockWidget({
      name: 'seed',
      nodeId: NODE_ID
    })

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
