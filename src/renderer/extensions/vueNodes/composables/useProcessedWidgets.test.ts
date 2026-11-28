import { fromAny } from '@total-typescript/shoehorn'
import { assert, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, effectScope, watchSyncEffect } from 'vue'
import { reportError } from '@comfyorg/telemetry/reportError'

import { LGraph, LGraphNode, SubgraphNode } from '@/lib/litegraph/src/litegraph'
import {
  cleanupComplexPromotionFixtureNodeType,
  createTestSubgraph,
  resetSubgraphFixtureState,
  setupComplexPromotionFixture
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import type { INodeInputSlot } from '@comfyorg/graph-model/slots'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { useMissingMediaStore } from '@/platform/workflowErrors/missingMedia/missingMediaStore'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { computeProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import WidgetDOM from '@/renderer/extensions/vueNodes/widgets/components/WidgetDOM.vue'
import WidgetLegacy from '@/renderer/extensions/vueNodes/widgets/components/WidgetLegacy.vue'
import { getComponent } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import { createPromotedMultilineWidget } from '@/renderer/extensions/vueNodes/widgets/utils/multilineTextarea'
import { ComponentWidgetImpl, addWidget } from '@/scripts/domWidget'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useWidgetFolderLockStore } from '@/stores/widgetFolderLockStore'
import type { WidgetRenderState } from '@/stores/widgetValueStore'
import {
  createNodeExecutionId,
  createNodeLocatorId
} from '@comfyorg/graph-model/nodeIdentification'
import {
  toOwningGraphId,
  toRootGraphId
} from '@comfyorg/graph-model/graphScopeId'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

const GRAPH_ID = 'graph-test'

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
  const node = new LGraphNode(type, type)
  node.id = id
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
  getTooltipText: () => '',
  handleNodeRightClick: () => {}
}

function registerWidgetState(
  id: WidgetId,
  init: {
    type?: string
    value?: IBaseWidget['value']
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
      graphId: subgraphId ?? GRAPH_ID,
      type: nodeType,
      title: 'Test',
      mode: 0,
      flags: {},
      inputs: [],
      outputs: [],
      properties: {}
    },
    widgetIds,
    graphId: GRAPH_ID,
    showAdvanced,
    isGraphReady: rootGraph !== null,
    rootGraph,
    ui: noopUi
  })
}

describe('widget slot ownership', () => {
  beforeEach(() => {})

  it('does not assign a non-widget input socket to a same-named custom widget', () => {
    const { graph, node } = createGraphWithNode([])
    node.addInput('model', 'MODEL')
    node.addWidget('custom', 'model', null, () => {})

    const [processedWidget] = computeProcessedWidgets({
      nodeData: node._state,
      widgetIds: undefined,
      graphId: GRAPH_ID,
      showAdvanced: false,
      isGraphReady: true,
      rootGraph: graph,
      ui: noopUi
    })

    expect(processedWidget.slotMetadata).toBeUndefined()
  })

  it.for(['none', 'widget', 'widgetId'] as const)(
    'respects explicit widget ownership on linked same-name sockets (%s)',
    (ownership) => {
      const nodeId = toNodeId(1)
      const { graph, node } = createGraphWithNode([], nodeId)
      node.addInput('model', 'MODEL')
      node.addWidget('custom', 'model', null, () => {})
      if (ownership === 'widget') node.inputs[0].widget = { name: 'model' }
      if (ownership === 'widgetId') {
        node.inputs[0].widgetId = widgetId(GRAPH_ID, nodeId, 'model')
      }
      useLinkStore().registerLink(
        {
          rootGraphId: toRootGraphId(GRAPH_ID),
          owningGraphId: toOwningGraphId(GRAPH_ID)
        },
        {
          id: toLinkId(1),
          graphId: toOwningGraphId(GRAPH_ID),
          originNodeId: toNodeId(2),
          originSlot: 0,
          targetNodeId: nodeId,
          targetSlot: 0,
          type: 'MODEL'
        }
      )

      const [processedWidget] = computeProcessedWidgets({
        nodeData: node._state,
        widgetIds: undefined,
        graphId: GRAPH_ID,
        showAdvanced: false,
        isGraphReady: true,
        rootGraph: graph,
        ui: noopUi
      })

      if (ownership !== 'none') {
        expect(processedWidget.slotMetadata?.linked).toBe(true)
        expect(processedWidget.simplified.options?.disabled).toBe(true)
      } else {
        expect(processedWidget.slotMetadata).toBeUndefined()
        expect(processedWidget.simplified.options?.disabled).not.toBe(true)
      }
    }
  )

  it('uses the first same-named widget input slot', () => {
    const nodeId = toNodeId(1)
    const { graph, node } = createGraphWithNode([], nodeId)
    const widget = node.addWidget('text', 'value', '', () => {})
    node.inputs = [
      {
        name: 'value',
        type: 'STRING',
        widget: { name: 'value' },
        boundingRect: [0, 0, 0, 0]
      },
      {
        name: 'value',
        type: 'STRING',
        widget: { name: 'value' },
        boundingRect: [0, 0, 0, 0]
      }
    ]
    useLinkStore().registerLink(
      {
        rootGraphId: toRootGraphId(GRAPH_ID),
        owningGraphId: toOwningGraphId(GRAPH_ID)
      },
      {
        id: toLinkId(1),
        graphId: toOwningGraphId(GRAPH_ID),
        originNodeId: toNodeId(2),
        originSlot: 0,
        targetNodeId: nodeId,
        targetSlot: 1,
        type: 'STRING'
      }
    )
    const id = widget.widgetId
    if (!id) throw new Error('Missing widget ID')

    const [processedWidget] = computeProcessedWidgets({
      nodeData: node._state,
      widgetIds: [id],
      graphId: GRAPH_ID,
      showAdvanced: false,
      isGraphReady: true,
      rootGraph: graph,
      ui: noopUi
    })

    expect(processedWidget.slotMetadata).toMatchObject({
      index: 0,
      linked: false
    })
  })
})

describe('widget visibility', () => {
  beforeEach(() => {})

  function visibilityOf(
    options: IBaseWidget['options'],
    { showAdvanced = false, linked = false } = {}
  ): boolean | undefined {
    const nodeId = toNodeId(1)
    const id = widgetId(GRAPH_ID, nodeId, 'w')
    registerWidgetState(id, { type: 'text', options })
    if (!linked) {
      return processWidgets({ widgetIds: [id], showAdvanced })[0]?.visible
    }

    // A linked widget slot lives on the host node; build one so the widget's
    // slot metadata resolves as connected.
    const widget = createMockWidget({
      name: 'w',
      type: 'text',
      options,
      widgetId: id
    })
    const { graph, node } = createGraphWithNode([widget], nodeId)
    node.inputs = [
      {
        name: 'w',
        type: 'STRING',
        widget: { name: 'w' },
        link: toLinkId(1),
        boundingRect: [0, 0, 0, 0]
      }
    ]
    useLinkStore().registerLink(
      {
        rootGraphId: toRootGraphId(GRAPH_ID),
        owningGraphId: toOwningGraphId(GRAPH_ID)
      },
      {
        id: toLinkId(1),
        graphId: toOwningGraphId(GRAPH_ID),
        originNodeId: toNodeId(2),
        originSlot: 0,
        targetNodeId: nodeId,
        targetSlot: 0,
        type: 'STRING'
      }
    )
    return processWidgets({
      widgetIds: [id],
      showAdvanced,
      nodeId,
      rootGraph: graph
    })[0]?.visible
  }

  it('shows normal widgets', () => {
    expect(visibilityOf({})).toBe(true)
  })

  describe('runtime type swaps on a widget that owns an input slot', () => {
    function registerSlotOwningWidget(name = 'points_store') {
      const nodeId = toNodeId(1)
      const { graph, node } = createGraphWithNode([], nodeId)
      const widget = node.addWidget('number', name, 0, () => {})
      node.inputs = [
        {
          name,
          type: 'INT',
          widget: { name },
          boundingRect: [0, 0, 0, 0]
        }
      ]
      const id = widget.widgetId
      if (!id) throw new Error('Expected widget registration to succeed')
      return {
        widget,
        process: () =>
          processWidgets({ widgetIds: [id], nodeId, rootGraph: graph })[0]
      }
    }

    it('suppresses a widget an extension hides by type', () => {
      const { widget, process } = registerSlotOwningWidget()
      expect(process().visible).toBe(true)

      widget.type = fromAny('hidden')

      const processed = process()
      expect(processed.slotMetadata).toEqual({
        index: 0,
        type: 'INT',
        linked: false,
        promoted: false
      })
      expect(processed.visible).toBe(false)
      expect(processed.suppressedByConnection).toBe(false)
    })

    it('restores the widget when the extension puts the original type back', () => {
      const { widget, process } = registerSlotOwningWidget()

      widget.type = fromAny('hidden')
      widget.type = fromAny('number')

      expect(process().visible).toBe(true)
    })

    it('keeps a socket-only row for a converted widget', () => {
      const { widget, process } = registerSlotOwningWidget()

      widget.type = fromAny('converted-widget')

      const processed = process()
      expect(processed.simplified.type).toBe('converted-widget')
      expect(processed.slotMetadata).toEqual({
        index: 0,
        type: 'INT',
        linked: false,
        promoted: false
      })
    })
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

  it('hides canvas-only widgets', () => {
    expect(visibilityOf({ canvasOnly: true })).toBe(false)
  })

  it('re-shows a canvas-only widget once its vueNode tier is restored', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'w')
    registerWidgetState(id, { type: 'text', options: { canvasOnly: true } })
    const visibility = useWidgetValueStore().getWidgetVisibility(id)
    if (!visibility) throw new Error('Missing visibility component')
    const visible = computed(
      () => processWidgets({ widgetIds: [id] })[0]?.visible
    )

    expect(visible.value).toBe(false)
    visibility.surfaces.vueNode = 'shown'
    expect(visible.value).toBe(true)
  })

  it('hides connection-suppressed widgets and flags them for socket-only rows', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'w')
    registerWidgetState(id, { type: 'text' })
    const visibility = useWidgetValueStore().getWidgetVisibility(id)
    if (!visibility) throw new Error('Missing visibility component')
    visibility.suppression.byConnection = true

    const [processed] = processWidgets({ widgetIds: [id] })
    expect(processed.visible).toBe(false)
    expect(processed.suppressedByConnection).toBe(true)
  })
})

describe('widget error state', () => {
  beforeEach(() => {})

  function processWidgetNamed(name: string) {
    const id = widgetId(GRAPH_ID, toNodeId(1), name)
    registerWidgetState(id, { type: 'combo' })
    return processWidgets({ widgetIds: [id] })[0]
  }

  it.for([
    {
      kind: 'model',
      setMissing: () =>
        useMissingModelStore().setMissingModels([
          {
            nodeId: 1,
            nodeType: 'TestNode',
            widgetName: 'file',
            name: 'missing.safetensors',
            isAssetSupported: false,
            isMissing: true
          }
        ]),
      clear: () => useMissingModelStore().clearMissingModels()
    },
    {
      kind: 'media',
      setMissing: () =>
        useMissingMediaStore().setMissingMedia([
          {
            nodeId: createNodeExecutionId([1]),
            nodeType: 'TestNode',
            widgetName: 'file',
            name: 'missing.png',
            mediaType: 'image',
            isMissing: true
          }
        ]),
      clear: () => useMissingMediaStore().clearMissingMedia()
    }
  ])(
    'updates $kind errors without rebuilding widget arrays or notifying unrelated readers',
    ({ setMissing, clear }, { onTestFinished }) => {
      const firstId = widgetId(GRAPH_ID, toNodeId(1), 'file')
      const secondId = widgetId(GRAPH_ID, toNodeId(2), 'file')
      registerWidgetState(firstId)
      registerWidgetState(secondId)
      processWidgets({ widgetIds: [firstId] })
      processWidgets({ widgetIds: [secondId], nodeId: toNodeId(2) })
      const first = computed(() => processWidgets({ widgetIds: [firstId] }))
      const second = computed(() =>
        processWidgets({ widgetIds: [secondId], nodeId: toNodeId(2) })
      )
      const initialFirst = first.value
      const initialSecond = second.value
      const firstErrors: boolean[][] = []
      const secondErrors: boolean[][] = []
      const scope = effectScope()
      onTestFinished(() => scope.stop())
      scope.run(() => {
        watchSyncEffect(() =>
          firstErrors.push(first.value.map((widget) => widget.hasError))
        )
        watchSyncEffect(() =>
          secondErrors.push(second.value.map((widget) => widget.hasError))
        )
      })

      setMissing()

      expect(firstErrors).toEqual([[false], [true]])
      expect(secondErrors).toEqual([[false]])
      expect(first.value).toBe(initialFirst)
      expect(second.value).toBe(initialSecond)

      clear()

      expect(firstErrors).toEqual([[false], [true], [false]])
      expect(secondErrors).toEqual([[false]])
      expect(first.value).toBe(initialFirst)
      expect(second.value).toBe(initialSecond)
    }
  )

  it('reports no error when the node has none', () => {
    expect(processWidgetNamed('test_widget').hasError).toBe(false)
  })

  it('reports an error when the node has a matching input error', () => {
    useExecutionErrorStore().recordNodeErrors({
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
    })
    expect(processWidgetNamed('seed').hasError).toBe(true)
  })

  it('reports an error when the widget is a missing model', () => {
    vi.spyOn(useMissingModelStore(), 'isWidgetMissingModel').mockReturnValue(
      true
    )
    expect(processWidgetNamed('ckpt_name').hasError).toBe(true)
  })
})

describe('promoted subgraph widgets', () => {
  const HOST_ID = toNodeId(21)
  const INTERIOR_ID = toNodeId(20)
  const HOST_EXECUTION_ID = createNodeExecutionId([HOST_ID])
  const SOURCE_EXECUTION_ID = createNodeExecutionId([HOST_ID, INTERIOR_ID])

  class DomHostSubgraphNode extends SubgraphNode {
    protected override createPromotedHostWidget(
      input: INodeInputSlot,
      id: WidgetId,
      sourceWidget: Readonly<IBaseWidget>
    ): IBaseWidget | undefined {
      return createPromotedMultilineWidget({
        subgraphNode: this,
        input,
        widgetId: id,
        sourceWidget
      })
    }
  }

  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  afterEach(() => {
    cleanupComplexPromotionFixtureNodeType()
  })

  function processHostWidget(
    graph: LGraph,
    hostNode: SubgraphNode,
    explicitWidgetIds = true
  ) {
    const id = hostNode.widgets[0]?.widgetId ?? hostNode.inputs[0]?.widgetId
    if (!id) throw new Error('Expected the promoted host widget to be keyed')
    return computeProcessedWidgets({
      nodeData: hostNode._state,
      widgetIds: explicitWidgetIds ? [id] : undefined,
      graphId: graph.id,
      showAdvanced: false,
      isGraphReady: true,
      rootGraph: graph,
      ui: noopUi
    })[0]
  }

  function setHostWidgetOptions(
    hostNode: SubgraphNode,
    options: IBaseWidget['options']
  ) {
    const id = hostNode.widgets[0]?.widgetId
    if (!id) throw new Error('Expected the promoted host widget to be keyed')
    if (!useWidgetValueStore().updateOptions(id, options)) {
      throw new Error('Expected promoted host widget state')
    }
  }

  function recordInteriorError() {
    useExecutionErrorStore().recordNodeErrors({
      [SOURCE_EXECUTION_ID]: {
        errors: [
          {
            type: 'value_not_in_list',
            message: 'Invalid value',
            details: '',
            extra_info: { input_name: 'string_a' }
          }
        ],
        class_type: 'StringConcatenate',
        dependent_outputs: []
      }
    })
  }

  it.for([
    { tagName: 'div', expected: getComponent('string') },
    { tagName: 'textarea', expected: getComponent('customtext') }
  ] as const)(
    'keeps a promoted string widget with a source $tagName on its native editor',
    ({ tagName, expected }) => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'text', type: 'STRING' }]
      })
      const graph = subgraph.rootGraph
      const sourceNode = new LGraphNode('Extension text')
      const input = sourceNode.addInput('text', 'STRING')
      input.widget = { name: 'text' }
      subgraph.add(sourceNode)
      sourceNode.addDOMWidget(
        'text',
        'string',
        document.createElement(tagName),
        {
          getValue: () => 'promoted text'
        }
      )
      const hostNode = new DomHostSubgraphNode(graph, subgraph, {
        id: graph.state.lastNodeId + 1,
        type: subgraph.id,
        pos: [100, 100],
        size: [200, 100],
        inputs: [],
        outputs: [],
        properties: {},
        flags: {},
        mode: 0,
        order: 0
      })
      graph.add(hostNode)
      subgraph.inputNode.slots[0].connect(input, sourceNode)

      const result = processHostWidget(graph, hostNode)

      expect(result.vueComponent).toBe(expected)
      expect(result.simplified.value).toBe('promoted text')
    }
  )

  it('surfaces raw interior errors on the host widget', () => {
    const { graph, hostNode } = setupComplexPromotionFixture()
    recordInteriorError()

    expect(processHostWidget(graph, hostNode).hasError).toBe(true)
  })

  it('resolves the widget locator to the interior source node', () => {
    const { graph, subgraph, hostNode } = setupComplexPromotionFixture()

    expect(processHostWidget(graph, hostNode).simplified.nodeLocatorId).toBe(
      createNodeLocatorId(subgraph.id, INTERIOR_ID)
    )
  })

  it('derives promoted sizing from the current concrete source without re-registering the host', () => {
    const { graph, subgraph, hostNode } = setupComplexPromotionFixture()
    const sourceNode = subgraph.getNodeById(INTERIOR_ID)
    const sourceWidget = sourceNode?.widgets?.find(
      (widget) => widget.name === 'string_a'
    )
    assert.exists(sourceNode)
    assert.exists(sourceWidget)
    sourceWidget.computeLayoutSize = (node) => ({
      minHeight: node.size[0] / 3,
      minWidth: 0
    })
    sourceNode.size = [183, 100]
    const processed = processHostWidget(graph, hostNode)

    expect(processed.sizing).toMatchObject({
      kind: 'growable',
      minHeight: 61
    })

    sourceNode.size = [249, 100]

    expect(processed.sizing).toMatchObject({
      kind: 'growable',
      minHeight: 83
    })
  })

  it.for(['computeSize', 'computeLayoutSize'] as const)(
    'drops the sizing when %s throws, reports it once, and recovers without re-registration',
    (callback) => {
      const { graph, subgraph, hostNode } = setupComplexPromotionFixture()
      const sourceWidget = subgraph
        .getNodeById(INTERIOR_ID)
        ?.widgets?.find((widget) => widget.name === 'string_a')
      assert.exists(sourceWidget)
      const value = sourceWidget.value
      sourceWidget.type = `throws-in-${callback}`
      sourceWidget.computeSize = undefined
      const cause = new Error('Extension sizing failed')
      sourceWidget[callback] = () => {
        throw cause
      }
      const processed = processHostWidget(graph, hostNode)

      expect([processed.sizing, processed.sizing]).toEqual([
        undefined,
        undefined
      ])
      expect(reportError).toHaveBeenCalledExactlyOnceWith(
        cause,
        expect.objectContaining({
          errorType: 'error_measuring_widget',
          surface: 'graph',
          tags: { outcome: 'degraded' }
        })
      )

      sourceWidget.computeSize = undefined
      sourceWidget.computeLayoutSize = () => ({ minWidth: 0, minHeight: 67 })

      expect(processed.sizing).toEqual({
        kind: 'growable',
        minWidth: 0,
        minHeight: 67
      })
      expect(sourceWidget.value).toEqual(value)
    }
  )

  it.for([
    ['shows on the node canvas', { advanced: true }, false, true],
    ['shows when selected in App Mode', { advanced: true }, true, true],
    [
      'stays hidden when explicitly hidden',
      { advanced: true, hidden: true },
      true,
      false
    ]
  ] as const)('%s', ([, options, explicitWidgetIds, visible]) => {
    const { graph, hostNode } = setupComplexPromotionFixture()
    setHostWidgetOptions(hostNode, options)

    expect(processHostWidget(graph, hostNode, explicitWidgetIds).visible).toBe(
      visible
    )
  })

  it('clears errors on both the interior source and the host', () => {
    const { graph, hostNode } = setupComplexPromotionFixture()
    recordInteriorError()
    const clearSpy = vi.spyOn(
      useExecutionErrorStore(),
      'clearWidgetRelatedErrors'
    )

    processHostWidget(graph, hostNode).updateHandler('fixed')

    expect(clearSpy.mock.calls.map((call) => call[0])).toStrictEqual([
      SOURCE_EXECUTION_ID,
      HOST_EXECUTION_ID
    ])
    expect(useExecutionErrorStore().lastNodeErrors).toBeNull()
  })
})

describe('computeProcessedWidgets', () => {
  it('renders an opaque-ID widget before its graph is ready', () => {
    const nodeId = toNodeId('insert:abc123:root:node:5')
    const id = widgetId(GRAPH_ID, nodeId, 'text')
    registerWidgetState(id, { type: 'text', value: 'before' })
    const missingModelSpy = vi.spyOn(
      useMissingModelStore(),
      'isWidgetMissingModel'
    )
    const missingMediaSpy = vi.spyOn(
      useMissingMediaStore(),
      'isWidgetMissingMedia'
    )
    const clearErrorSpy = vi.spyOn(
      useExecutionErrorStore(),
      'clearWidgetRelatedErrors'
    )

    const [processed] = processWidgets({ widgetIds: [id], nodeId })

    expect(processed.simplified.value).toBe('before')
    expect(processed.hasError).toBe(false)
    expect(missingModelSpy).not.toHaveBeenCalled()
    expect(missingMediaSpy).not.toHaveBeenCalled()

    processed.updateHandler('after')

    expect(useWidgetValueStore().getWidget(id)?.value).toBe('after')
    expect(clearErrorSpy).not.toHaveBeenCalled()
  })

  it('applies advanced border styling to advanced widgets', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'text')
    registerWidgetState(id, { type: 'text', options: { advanced: true } })

    const result = processWidgets({ widgetIds: [id], showAdvanced: true })

    expect(result[0].simplified.borderStyle).toBe('ring ring-primary')
  })

  it('serializes folder locks per input without changing widget values or sibling metadata', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'model')
    registerWidgetState(id, { type: 'combo', value: 'Other/model.safetensors' })
    const { node } = createGraphWithNode([
      createMockWidget({
        widgetId: id,
        name: 'model',
        value: 'Other/model.safetensors'
      })
    ])
    node.serialize_widgets = true
    const store = useWidgetValueStore()
    const sibling = widgetId(GRAPH_ID, node.id, 'sibling')
    useWidgetFolderLockStore().set(sibling, { directory: ['SDXL'] })

    useWidgetFolderLockStore().set(id, { directory: ['MOSS', 'image'] })
    const saved = node.serialize()
    expect(saved).toMatchObject({
      properties: {
        widget_folder_locks: { model: ['MOSS', 'image'], sibling: ['SDXL'] }
      },
      widgets_values: ['Other/model.safetensors']
    })
    store.clearNode(GRAPH_ID, node.id)
    node.configure(saved)
    expect(useWidgetFolderLockStore().get(id)?.directory).toEqual([
      'MOSS',
      'image'
    ])
    expect(node.properties).not.toHaveProperty('widget_folder_locks')
    useWidgetFolderLockStore().set(id, undefined)
    expect(node.serialize().properties?.widget_folder_locks).toEqual({
      sibling: ['SDXL']
    })
    expect(useWidgetFolderLockStore().get(id)).toBeUndefined()
  })

  it('restores a detached copy under its new node identity without sharing the lock', () => {
    const { graph, node } = createGraphWithNode([])
    const originalId = widgetId(GRAPH_ID, node.id, 'model')
    useWidgetFolderLockStore().set(originalId, { directory: ['MOSS', 'image'] })
    const saved = node.serialize()
    const copy = createNode([])

    copy.configure(saved)
    expect(copy.serialize().properties?.widget_folder_locks).toEqual({
      model: ['MOSS', 'image']
    })
    graph.add(copy)
    const copyId = widgetId(GRAPH_ID, copy.id, 'model')

    expect(copyId).not.toBe(originalId)
    expect(useWidgetFolderLockStore().get(copyId)).toEqual({
      directory: ['MOSS', 'image']
    })
    expect(copy.properties).not.toHaveProperty('widget_folder_locks')
    graph.remove(copy)
    expect(copy.serialize().properties?.widget_folder_locks).toEqual({
      model: ['MOSS', 'image']
    })
    graph.add(copy)
    useWidgetFolderLockStore().set(copyId, undefined)
    expect(copy.serialize().properties).not.toHaveProperty(
      'widget_folder_locks'
    )
    expect(useWidgetFolderLockStore().get(originalId)).toEqual({
      directory: ['MOSS', 'image']
    })
  })

  it('does not resurrect a detached lock when configuring an unlocked snapshot', () => {
    const { graph, node } = createGraphWithNode([])
    const id = widgetId(GRAPH_ID, node.id, 'model')
    const unlocked = node.serialize()
    useWidgetFolderLockStore().set(id, { directory: ['MOSS', 'image'] })
    graph.remove(node)

    node.configure(unlocked)
    graph.add(node)

    expect(useWidgetFolderLockStore().get(id)).toBeUndefined()
    expect(node.serialize().properties).not.toHaveProperty(
      'widget_folder_locks'
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

  it('uses the live widget type after runtime changes', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'text')
    registerWidgetState(id, { type: 'combo' })
    const widget = createMockWidget({ widgetId: id, name: 'text', type: '' })
    const { graph } = createGraphWithNode([widget])

    const result = processWidgets({ widgetIds: [id], rootGraph: graph })

    expect(result).toEqual([])
  })

  it('uses the legacy renderer for a customized draw method', () => {
    const id = widgetId(GRAPH_ID, toNodeId(1), 'stack_data')
    registerWidgetState(id, { type: 'text' })
    const widget = createMockWidget({
      widgetId: id,
      name: 'stack_data',
      type: 'text',
      computeSize: () => [0, -4],
      draw: () => undefined
    })
    const { graph } = createGraphWithNode([widget])

    const [result] = processWidgets({ widgetIds: [id], rootGraph: graph })

    expect(result.vueComponent).toBe(WidgetLegacy)
  })

  it.for([
    { type: 'string', options: {}, expected: WidgetDOM },
    {
      type: 'string',
      options: { vueNodeRenderer: 'native' },
      expected: getComponent('string')
    },
    {
      type: 'HTML',
      options: { vueNodeRenderer: 'native' },
      expected: WidgetDOM
    }
  ] as const)(
    'renders DOM type $type with options $options using its declared renderer',
    ({ type, options, expected }) => {
      const { graph, node } = createGraphWithNode([])
      node.addDOMWidget(
        'custom_ui',
        type,
        document.createElement('div'),
        options
      )
      const id = widgetId(GRAPH_ID, node.id, 'custom_ui')

      const [result] = processWidgets({ widgetIds: [id], rootGraph: graph })

      expect(result.vueComponent).toBe(expected)
    }
  )

  it('keeps component-backed widgets on their native renderer', () => {
    const { graph, node } = createGraphWithNode([])
    const widget = new ComponentWidgetImpl({
      node,
      name: 'viewport',
      type: 'load3D',
      component: { template: '<div />' },
      inputSpec: { name: 'viewport', type: 'LOAD_3D' },
      options: {}
    })
    addWidget(node, widget)
    const id = widgetId(GRAPH_ID, node.id, 'viewport')

    const [result] = processWidgets({ widgetIds: [id], rootGraph: graph })

    expect(result.vueComponent).toBe(getComponent('load3D'))
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
        options: { advanced: true }
      },
      {
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
      simplified: {
        name: 'display_slot',
        borderStyle: 'ring ring-primary'
      }
    })
    expect(result[0].vueComponent).toBe(WidgetDOM)
    expect(result[0].sizing).toBeUndefined()
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

  beforeEach(() => {})

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

  it('fires the live widget callback for a node id carrying a colon that is not a subgraph-scope prefix (insert_workflow remap, PM-1580)', () => {
    // comfy-multi-player's insert_workflow remaps every inserted node's id
    // to a derived string with colons unrelated to subgraph scoping
    // (insert:<opId>:root:node:<originalId>). A colon-rejecting locator-id
    // path resolves no host LGraphNode for such a node, so the stored
    // widget value updates but the widget's own callback is silently
    // skipped.
    const nodeId = toNodeId('insert:abc123:root:node:5')
    const callback = vi.fn()
    const id = widgetId(GRAPH_ID, nodeId, 'seed')
    const widget = createMockWidget({ name: 'seed', widgetId: id, callback })
    registerWidgetState(id, { type: 'combo', value: 0 })
    const { graph } = createGraphWithNode([widget], nodeId)

    const [processed] = processWidgets({
      widgetIds: [id],
      nodeId,
      rootGraph: graph
    })
    processed.updateHandler(42)

    expect(useWidgetValueStore().getWidget(id)?.value).toBe(42)
    expect(callback).toHaveBeenCalledWith(42, undefined, expect.any(LGraphNode))
  })

  it('calls a clicked button callback with its own value and leaves that value unchanged', () => {
    const callback = vi.fn()
    const id = widgetId(GRAPH_ID, NODE_ID, 'clear')
    const widget = createMockWidget({
      name: 'clear',
      type: 'button',
      value: 'clear',
      widgetId: id,
      callback
    })
    registerWidgetState(id, { type: 'button', value: 'clear' })

    const [processed] = processUpdateWidgets([widget])
    processed.simplified.callback?.(undefined)

    expect(callback).toHaveBeenCalledExactlyOnceWith(
      'clear',
      undefined,
      expect.any(LGraphNode),
      undefined,
      undefined
    )
    expect(widget.value).toBe('clear')
    expect(useWidgetValueStore().getWidget(id)?.value).toBe('clear')
  })

  it('updates widgetState.value when store entry exists', () => {
    const id = widgetId(GRAPH_ID, NODE_ID, 'seed')
    registerWidgetState(id, { type: 'combo', value: 0 })

    const [processed] = processWidgets({ widgetIds: [id], nodeId: NODE_ID })
    processed.updateHandler(99)

    expect(useWidgetValueStore().getWidget(id)?.value).toBe(99)
  })

  function seedSeedError() {
    useExecutionErrorStore().recordNodeErrors({
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
    })
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
  beforeEach(() => {})

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
