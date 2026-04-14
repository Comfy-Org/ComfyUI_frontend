import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  LGraphEventMode,
  NodeSlotType
} from '@/lib/litegraph/src/types/globalEnums'
import * as missingMediaScan from '@/platform/missingMedia/missingMediaScan'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'
import * as missingModelScan from '@/platform/missingModel/missingModelScan'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/nodeReplacement/missingNodesErrorStore'
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
      fromAny<LGraph, unknown>(undefined)
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

describe('onNodeRemoved clears missing asset errors by execution ID', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('removes root-level node missing model error using its local id', () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    graph.add(node)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    installErrorClearingHooks(graph)

    const modelStore = useMissingModelStore()
    modelStore.setMissingModels([
      fromAny<
        Parameters<typeof modelStore.setMissingModels>[0][number],
        unknown
      >({
        nodeId: String(node.id),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'model.safetensors',
        isMissing: true
      })
    ])

    graph.remove(node)

    expect(modelStore.missingModelCandidates).toBeNull()
  })

  it('removes subgraph interior node missing model error using parentId:nodeId', () => {
    // Regression: node.graph is nulled before onNodeRemoved fires, so
    // getExecutionIdByNode returned null and removal fell back to the
    // local node id. Errors stored under "parentId:nodeId" were never
    // removed for subgraph interior nodes.
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('CheckpointLoaderSimple')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    const rootGraph = subgraphNode.graph as LGraph
    rootGraph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    // Hooks are installed on whichever graph is currently active in
    // the canvas; when the user is inside the subgraph, that is the
    // graph whose onNodeRemoved fires for interior deletions.
    installErrorClearingHooks(subgraph)

    const interiorExecId = `${subgraphNode.id}:${interiorNode.id}`
    const modelStore = useMissingModelStore()
    modelStore.setMissingModels([
      fromAny<
        Parameters<typeof modelStore.setMissingModels>[0][number],
        unknown
      >({
        nodeId: interiorExecId,
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'model.safetensors',
        isMissing: true
      })
    ])

    subgraph.remove(interiorNode)

    expect(modelStore.missingModelCandidates).toBeNull()
  })

  it('removes subgraph interior node missing media and missing node errors', () => {
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('LoadImage')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    const rootGraph = subgraphNode.graph as LGraph
    rootGraph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    installErrorClearingHooks(subgraph)

    const interiorExecId = `${subgraphNode.id}:${interiorNode.id}`

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([
      fromAny<
        Parameters<typeof mediaStore.setMissingMedia>[0][number],
        unknown
      >({
        nodeId: interiorExecId,
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'cat.png',
        isMissing: true
      })
    ])

    const nodesStore = useMissingNodesErrorStore()
    nodesStore.surfaceMissingNodes([
      {
        type: 'LoadImage',
        nodeId: interiorExecId,
        cnrId: undefined,
        isReplaceable: false,
        replacement: undefined
      }
    ])

    subgraph.remove(interiorNode)

    expect(mediaStore.missingMediaCandidates).toBeNull()
    expect(nodesStore.missingNodesError).toBeNull()
  })
})

describe('realtime scan verifies pending cloud candidates', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('un-bypass path surfaces pending model candidates after verification', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    graph.add(node)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    // Cloud mode returns candidates with isMissing: undefined until
    // verifyAssetSupportedCandidates resolves them against the assets store.
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      {
        nodeId: String(node.id),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: true,
        name: 'cloud_model.safetensors',
        isMissing: undefined
      }
    ])
    const verifySpy = vi
      .spyOn(missingModelScan, 'verifyAssetSupportedCandidates')
      .mockImplementation(async (candidates) => {
        for (const c of candidates) c.isMissing = true
      })
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])

    installErrorClearingHooks(graph)

    // Simulate un-bypass (BYPASS → NEVER_BY_USER is not active; use 0 = active)
    node.mode = LGraphEventMode.ALWAYS
    graph.onTrigger?.({
      type: 'node:property:changed',
      nodeId: node.id,
      property: 'mode',
      oldValue: LGraphEventMode.BYPASS,
      newValue: LGraphEventMode.ALWAYS
    })

    await vi.waitFor(() => {
      expect(verifySpy).toHaveBeenCalledOnce()
    })
    await vi.waitFor(() => {
      const store = useMissingModelStore()
      expect(store.missingModelCandidates).toHaveLength(1)
      expect(store.missingModelCandidates![0].name).toBe(
        'cloud_model.safetensors'
      )
    })
  })

  it('un-bypass path surfaces pending media candidates after verification', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('LoadImage')
    graph.add(node)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([
      {
        nodeId: String(node.id),
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'cloud_image.png',
        isMissing: undefined
      }
    ])
    const verifySpy = vi
      .spyOn(missingMediaScan, 'verifyCloudMediaCandidates')
      .mockImplementation(async (candidates) => {
        for (const c of candidates) c.isMissing = true
      })

    installErrorClearingHooks(graph)

    node.mode = LGraphEventMode.ALWAYS
    graph.onTrigger?.({
      type: 'node:property:changed',
      nodeId: node.id,
      property: 'mode',
      oldValue: LGraphEventMode.BYPASS,
      newValue: LGraphEventMode.ALWAYS
    })

    await vi.waitFor(() => {
      expect(verifySpy).toHaveBeenCalledOnce()
    })
    await vi.waitFor(() => {
      const store = useMissingMediaStore()
      expect(store.missingMediaCandidates).toHaveLength(1)
      expect(store.missingMediaCandidates![0].name).toBe('cloud_image.png')
    })
  })

  it('does not add candidates that remain confirmed-present after verification', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    graph.add(node)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      {
        nodeId: String(node.id),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: true,
        name: 'present.safetensors',
        isMissing: undefined
      }
    ])
    vi.spyOn(
      missingModelScan,
      'verifyAssetSupportedCandidates'
    ).mockImplementation(async (candidates) => {
      for (const c of candidates) c.isMissing = false
    })
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])

    installErrorClearingHooks(graph)

    node.mode = LGraphEventMode.ALWAYS
    graph.onTrigger?.({
      type: 'node:property:changed',
      nodeId: node.id,
      property: 'mode',
      oldValue: LGraphEventMode.BYPASS,
      newValue: LGraphEventMode.ALWAYS
    })

    await new Promise((r) => setTimeout(r, 0))
    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })
})

describe('realtime verification staleness guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('skips adding verified model when node was bypassed before verification resolved', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    graph.add(node)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      {
        nodeId: String(node.id),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: true,
        name: 'stale_model.safetensors',
        isMissing: undefined
      }
    ])
    let resolveVerify: (() => void) | undefined
    const verifyPromise = new Promise<void>((r) => (resolveVerify = r))
    const verifySpy = vi
      .spyOn(missingModelScan, 'verifyAssetSupportedCandidates')
      .mockImplementation(async (candidates) => {
        await verifyPromise
        for (const c of candidates) c.isMissing = true
      })
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])

    installErrorClearingHooks(graph)

    // Un-bypass: kicks off verification (still pending)
    node.mode = LGraphEventMode.ALWAYS
    graph.onTrigger?.({
      type: 'node:property:changed',
      nodeId: node.id,
      property: 'mode',
      oldValue: LGraphEventMode.BYPASS,
      newValue: LGraphEventMode.ALWAYS
    })
    await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

    // Bypass again before verification resolves
    node.mode = LGraphEventMode.BYPASS

    // Verification now resolves with isMissing: true, but staleness
    // check must drop the add because node is currently bypassed.
    resolveVerify!()
    await new Promise((r) => setTimeout(r, 0))

    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })

  it('skips adding verified media when node is deleted before verification resolved', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('LoadImage')
    graph.add(node)
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)

    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([
      {
        nodeId: String(node.id),
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'deleted_image.png',
        isMissing: undefined
      }
    ])
    let resolveVerify: (() => void) | undefined
    const verifyPromise = new Promise<void>((r) => (resolveVerify = r))
    const verifySpy = vi
      .spyOn(missingMediaScan, 'verifyCloudMediaCandidates')
      .mockImplementation(async (candidates) => {
        await verifyPromise
        for (const c of candidates) c.isMissing = true
      })

    installErrorClearingHooks(graph)

    node.mode = LGraphEventMode.ALWAYS
    graph.onTrigger?.({
      type: 'node:property:changed',
      nodeId: node.id,
      property: 'mode',
      oldValue: LGraphEventMode.BYPASS,
      newValue: LGraphEventMode.ALWAYS
    })
    await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

    // Delete the node before verification completes
    graph.remove(node)

    resolveVerify!()
    await new Promise((r) => setTimeout(r, 0))

    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })
})

describe('scan skips interior of bypassed subgraph containers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('does not surface interior missing model when entering a bypassed subgraph', async () => {
    // Repro: root has a bypassed subgraph container, interior node is
    // itself active. useGraphNodeManager replays `onNodeAdded` for each
    // interior node on subgraph entry, which previously reached
    // scanSingleNodeErrors without an ancestor check and resurfaced the
    // error that the initial pipeline post-filter had correctly dropped.
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('CheckpointLoaderSimple')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    subgraphNode.mode = LGraphEventMode.BYPASS
    const rootGraph = subgraphNode.graph as LGraph
    rootGraph.add(subgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    // Any scanner output would surface the error if the ancestor guard
    // didn't short-circuit first — return a concrete missing candidate.
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      {
        nodeId: `${subgraphNode.id}:${interiorNode.id}`,
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'fake.safetensors',
        isMissing: true
      }
    ])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])

    installErrorClearingHooks(subgraph)

    // Simulate useGraphNodeManager replaying onNodeAdded for existing
    // interior nodes after Vue node manager init on subgraph entry.
    subgraph.onNodeAdded?.(interiorNode)
    await new Promise((r) => setTimeout(r, 0))

    expect(useMissingModelStore().missingModelCandidates).toBeNull()
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
