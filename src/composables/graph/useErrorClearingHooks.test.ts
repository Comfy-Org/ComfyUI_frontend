import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { app } from '@/scripts/app'
import { useExecutionErrorStore } from '@/stores/executionErrorStore'

function seedSimpleError(
  store: ReturnType<typeof useExecutionErrorStore>,
  executionId: string,
  inputName: string
) {
  store.lastNodeErrors = {
    [executionId]: {
      errors: [
        {
          type: 'required_input_missing',
          message: 'Missing',
          details: '',
          extra_info: { input_name: inputName }
        }
      ],
      dependent_outputs: [],
      class_type: 'TestNode'
    }
  }
}

describe('Connection error clearing via onConnectionsChange', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  function createGraphWithInput() {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('string', 'prompt', 'hello', () => undefined, {})
    node.addInput('clip', 'CLIP')
    graph.add(node)
    return { graph, node }
  }

  it('clears simple node error when INPUT is connected', () => {
    const { graph, node } = createGraphWithInput()
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    seedSimpleError(store, String(node.id), 'clip')

    node.onConnectionsChange!(NodeSlotType.INPUT, 0, true, null, node.inputs[0])

    expect(store.lastNodeErrors).toBeNull()
  })

  it('does not clear errors on disconnection', () => {
    const { graph, node } = createGraphWithInput()
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    seedSimpleError(store, String(node.id), 'clip')

    node.onConnectionsChange!(
      NodeSlotType.INPUT,
      0,
      false,
      null,
      node.inputs[0]
    )

    expect(store.lastNodeErrors).not.toBeNull()
  })

  it('does not clear errors on OUTPUT connection', () => {
    const { graph, node } = createGraphWithInput()
    node.addOutput('out', 'CLIP')
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    seedSimpleError(store, String(node.id), 'clip')

    node.onConnectionsChange!(
      NodeSlotType.OUTPUT,
      0,
      true,
      null,
      node.outputs[0]
    )

    expect(store.lastNodeErrors).not.toBeNull()
  })

  it('clears errors for pure input slots without widget property', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('model', 'MODEL')
    graph.add(node)
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    seedSimpleError(store, String(node.id), 'model')

    node.onConnectionsChange!(NodeSlotType.INPUT, 0, true, null, node.inputs[0])

    expect(store.lastNodeErrors).toBeNull()
  })
})

describe('Widget change error clearing via onWidgetChanged', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('clears simple error when widget value changes to valid range', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'steps', 20, () => undefined, {
      min: 1,
      max: 100
    })
    graph.add(node)
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    store.lastNodeErrors = {
      [String(node.id)]: {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Too big',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'TestNode'
      }
    }

    node.onWidgetChanged!.call(node, 'steps', 50, 20, node.widgets![0])

    expect(store.lastNodeErrors).toBeNull()
  })

  it('retains error when widget value is still out of range', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'steps', 20, () => undefined, {
      min: 1,
      max: 100
    })
    graph.add(node)
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    store.lastNodeErrors = {
      [String(node.id)]: {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Too big',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'TestNode'
      }
    }

    node.onWidgetChanged!.call(node, 'steps', 150, 20, node.widgets![0])

    expect(store.lastNodeErrors).not.toBeNull()
  })

  it('does not clear errors when rootGraph is unavailable', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addWidget('number', 'steps', 20, () => undefined, {})
    graph.add(node)
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(
      undefined as unknown as LGraph
    )
    store.lastNodeErrors = {
      [String(node.id)]: {
        errors: [
          {
            type: 'value_bigger_than_max',
            message: 'Too big',
            details: '',
            extra_info: { input_name: 'steps' }
          }
        ],
        dependent_outputs: [],
        class_type: 'TestNode'
      }
    }

    node.onWidgetChanged!.call(node, 'steps', 50, 20, node.widgets![0])

    expect(store.lastNodeErrors).not.toBeNull()
  })

  it('uses interior node execution ID for promoted widget error clearing', () => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'ckpt_input', type: '*' }]
    })
    const interiorNode = new LGraphNode('CheckpointLoaderSimple')
    const interiorInput = interiorNode.addInput('ckpt_input', '*')
    interiorNode.addWidget(
      'combo',
      'ckpt_name',
      'model.safetensors',
      () => undefined,
      { values: ['model.safetensors'] }
    )
    interiorInput.widget = { name: 'ckpt_name' }
    subgraph.add(interiorNode)
    subgraph.inputNode.slots[0].connect(interiorInput, interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    subgraphNode._internalConfigureAfterSlots()
    const graph = subgraphNode.graph as LGraph
    graph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    const interiorExecId = `${subgraphNode.id}:${interiorNode.id}`

    const promotedWidget = subgraphNode.widgets?.find(
      (w) => 'sourceWidgetName' in w && w.sourceWidgetName === 'ckpt_name'
    )
    expect(promotedWidget).toBeDefined()

    // PromotedWidgetView.name returns displayName ("ckpt_input"), which is
    // passed as errorInputName to clearSimpleNodeErrors. Seed the error
    // with that name so the slot-name filter matches.
    seedSimpleError(store, interiorExecId, promotedWidget!.name)

    subgraphNode.onWidgetChanged!.call(
      subgraphNode,
      'ckpt_name',
      'other_model.safetensors',
      'model.safetensors',
      promotedWidget!
    )

    expect(store.lastNodeErrors).toBeNull()
  })
})

describe('installErrorClearingHooks lifecycle', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('propagates hooks to nodes added after installation', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('value', 'INT')
    graph.add(node)
    installErrorClearingHooks(graph)

    // Add a new node after hooks are installed
    const lateNode = new LGraphNode('late')
    lateNode.addInput('value', 'INT')
    graph.add(lateNode)

    // The late-added node should have error-clearing hooks
    expect(lateNode.onConnectionsChange).toBeDefined()
    expect(lateNode.onWidgetChanged).toBeDefined()

    // Verify the hooks actually work
    const store = useExecutionErrorStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    seedSimpleError(store, String(lateNode.id), 'value')

    lateNode.onConnectionsChange!(
      NodeSlotType.INPUT,
      0,
      true,
      null,
      lateNode.inputs[0]
    )

    expect(store.lastNodeErrors).toBeNull()
  })

  it('restores original onNodeAdded when cleanup is called', () => {
    const graph = new LGraph()
    const originalHook = vi.fn()
    graph.onNodeAdded = originalHook

    const cleanup = installErrorClearingHooks(graph)
    expect(graph.onNodeAdded).not.toBe(originalHook)

    cleanup()
    expect(graph.onNodeAdded).toBe(originalHook)
  })

  it('restores original node callbacks when a node is removed', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('clip', 'CLIP')
    node.addWidget('number', 'steps', 20, () => undefined, {})
    const originalOnConnectionsChange = vi.fn()
    const originalOnWidgetChanged = vi.fn()
    node.onConnectionsChange = originalOnConnectionsChange
    node.onWidgetChanged = originalOnWidgetChanged
    graph.add(node)

    installErrorClearingHooks(graph)

    // Callbacks should be chained (not the originals)
    expect(node.onConnectionsChange).not.toBe(originalOnConnectionsChange)
    expect(node.onWidgetChanged).not.toBe(originalOnWidgetChanged)

    // Simulate node removal via the graph hook
    graph.onNodeRemoved!(node)

    // Original callbacks should be restored
    expect(node.onConnectionsChange).toBe(originalOnConnectionsChange)
    expect(node.onWidgetChanged).toBe(originalOnWidgetChanged)
  })

  it('does not double-wrap callbacks when installErrorClearingHooks is called twice', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    node.addInput('clip', 'CLIP')
    graph.add(node)

    installErrorClearingHooks(graph)
    const chainedAfterFirst = node.onConnectionsChange

    // Install again on the same graph — should be a no-op for existing nodes
    installErrorClearingHooks(graph)
    expect(node.onConnectionsChange).toBe(chainedAfterFirst)
  })
})

describe('clearWidgetRelatedErrors parameter routing', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('passes widgetName (not errorInputName) for model lookup', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    const widget = node.addWidget('number', 'steps', 42, () => undefined, {
      min: 0,
      max: 100
    })
    graph.add(node)
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    const clearSpy = vi.spyOn(store, 'clearWidgetRelatedErrors')

    node.onWidgetChanged!.call(node, 'steps', 42, 0, widget)

    expect(clearSpy).toHaveBeenCalledWith(
      String(node.id),
      'steps',
      'steps',
      42,
      { min: 0, max: 100 }
    )

    clearSpy.mockRestore()
  })
})
