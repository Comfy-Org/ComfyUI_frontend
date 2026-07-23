import { createTestingPinia } from '@pinia/testing'
import { fromAny } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { installErrorClearingHooks } from '@/composables/graph/useErrorClearingHooks'
import { promoteValueWidgetViaSubgraphInput } from '@/core/graph/subgraph/promotionUtils'
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
import { createNodeExecutionId } from '@/types/nodeIdentification'
import { toNodeId } from '@/types/nodeId'
import { seedRequiredInputMissingNodeError } from '@/utils/__tests__/executionErrorTestUtils'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingModelCandidate } from '@/platform/missingModel/types'

beforeEach(() => {
  vi.restoreAllMocks()
})

function createNestedSubgraphRuntime() {
  const rootGraph = new LGraph()
  const outerSubgraph = createTestSubgraph({ rootGraph })
  const innerSubgraph = createTestSubgraph({ rootGraph })
  const leafNode = new LGraphNode('CheckpointLoaderSimple')
  innerSubgraph.add(leafNode)

  const innerSubgraphNode = createTestSubgraphNode(innerSubgraph, {
    parentGraph: outerSubgraph,
    id: 77
  })
  outerSubgraph.add(innerSubgraphNode)

  const outerSubgraphNode = createTestSubgraphNode(outerSubgraph, {
    parentGraph: rootGraph,
    id: 65
  })
  rootGraph.add(outerSubgraphNode)

  return { rootGraph, outerSubgraph, innerSubgraphNode, outerSubgraphNode }
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
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([node.id]),
      'clip'
    )

    node.onConnectionsChange!(NodeSlotType.INPUT, 0, true, null, node.inputs[0])

    expect(store.lastNodeErrors).toBeNull()
  })

  it('does not clear errors on disconnection', () => {
    const { graph, node } = createGraphWithInput()
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([node.id]),
      'clip'
    )

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
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([node.id]),
      'clip'
    )

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
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([node.id]),
      'model'
    )

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

  it('clears missing media when an upload emits onWidgetChanged', () => {
    const graph = new LGraph()
    const node = new LGraphNode('LoadImage')
    node._state.type = 'LoadImage'
    const widget = node.addWidget(
      'combo',
      'image',
      'missing.png',
      () => undefined,
      { values: [] }
    )
    graph.add(node)
    installErrorClearingHooks(graph)

    const store = useExecutionErrorStore()
    const mediaStore = useMissingMediaStore()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([node.id]),
      'image'
    )
    mediaStore.setMissingMedia([
      {
        nodeId: String(node.id),
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'missing.png',
        isMissing: true
      } satisfies MissingMediaCandidate
    ])

    node.onWidgetChanged!.call(
      node,
      'image',
      'uploaded.png',
      'missing.png',
      widget
    )

    expect(store.lastNodeErrors).toBeNull()
    expect(mediaStore.missingMediaCandidates).toBeNull()
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
    seedRequiredInputMissingNodeError(
      store,
      createNodeExecutionId([lateNode.id]),
      'value'
    )

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

  it('scans added-node missing models after widget values are restored', async () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    installErrorClearingHooks(graph)

    const node = new LGraphNode('CheckpointLoaderSimple')
    node._state.type = 'CheckpointLoaderSimple'
    const widget = node.addWidget('combo', 'ckpt_name', '', () => undefined, {
      values: []
    })

    graph.add(node)
    widget.value = 'fake_model.safetensors'

    await Promise.resolve()

    expect(useMissingModelStore().missingModelCandidates).toEqual([
      expect.objectContaining({ name: 'fake_model.safetensors' })
    ])
  })

  it('scans added-node missing models before the deferred media scan', async () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    const modelScan = vi
      .spyOn(missingModelScan, 'scanNodeModelCandidates')
      .mockImplementation((_rootGraph, node) => [
        {
          nodeId: String(node.id),
          nodeType: node.type,
          widgetName: 'ckpt_name',
          isAssetSupported: false,
          name: 'fake_model.safetensors',
          directory: 'checkpoints',
          isMissing: true
        } satisfies MissingModelCandidate
      ])
    const mediaScan = vi
      .spyOn(missingMediaScan, 'scanNodeMediaCandidates')
      .mockReturnValue([])
    installErrorClearingHooks(graph)

    const node = new LGraphNode('CheckpointLoaderSimple')
    node._state.type = 'CheckpointLoaderSimple'
    graph.add(node)

    await Promise.resolve()

    expect(modelScan).toHaveBeenCalledOnce()
    expect(useMissingModelStore().missingModelCandidates).toEqual([
      expect.objectContaining({ name: 'fake_model.safetensors' })
    ])
    expect(mediaScan).not.toHaveBeenCalled()

    await Promise.resolve()

    expect(mediaScan).toHaveBeenCalledTimes(1)
    expect(modelScan.mock.invocationCallOrder[0]).toBeLessThan(
      mediaScan.mock.invocationCallOrder[0]
    )
  })

  it('does not surface added-node missing media when upload state is marked between deferred scans', async () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([])
    const mediaScan = vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates')
    installErrorClearingHooks(graph)

    const node = new LGraphNode('LoadVideo')
    node._state.type = 'LoadVideo'
    node.addWidget('combo', 'file', 'uploading.mp4', () => undefined, {
      values: []
    })

    graph.add(node)
    await Promise.resolve()
    node.isUploading = true
    await Promise.resolve()

    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
    expect(mediaScan).toHaveBeenCalledOnce()
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
      .spyOn(missingMediaScan, 'verifyMediaCandidates')
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
      .spyOn(missingMediaScan, 'verifyMediaCandidates')
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

  it('skips adding verified model when rootGraph switched before verification resolved', async () => {
    // Workflow A has a pending candidate on node id=1. A is replaced
    // by workflow B (fresh LGraph, potentially has a node with the
    // same id). Late verification from A must not leak into B.
    const graphA = new LGraph()
    const nodeA = new LGraphNode('CheckpointLoaderSimple')
    graphA.add(nodeA)
    const rootSpy = vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graphA)

    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      {
        nodeId: String(nodeA.id),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: true,
        name: 'stale_from_A.safetensors',
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

    installErrorClearingHooks(graphA)

    nodeA.mode = LGraphEventMode.ALWAYS
    graphA.onTrigger?.({
      type: 'node:property:changed',
      nodeId: nodeA.id,
      property: 'mode',
      oldValue: LGraphEventMode.BYPASS,
      newValue: LGraphEventMode.ALWAYS
    })
    await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

    // Workflow swap: app.rootGraph now points at graphB.
    const graphB = new LGraph()
    const nodeB = new LGraphNode('CheckpointLoaderSimple')
    graphB.add(nodeB)
    rootSpy.mockReturnValue(graphB)

    resolveVerify!()
    await new Promise((r) => setTimeout(r, 0))

    // A's verification finished but rootGraph is now B — the late
    // result must not be added to the store.
    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })
})

describe('scan skips interior of bypassed subgraph containers', () => {
  beforeEach(() => {
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

  it('scans nested subgraph containers during parent subgraph replay scan', async () => {
    const rootGraph = new LGraph()
    const outerSubgraph = createTestSubgraph({ rootGraph })
    const innerSubgraph = createTestSubgraph({ rootGraph })
    const leafNode = new LGraphNode('UNETLoader')
    innerSubgraph.add(leafNode)

    const innerSubgraphNode = createTestSubgraphNode(innerSubgraph, {
      parentGraph: outerSubgraph,
      id: 76
    })
    outerSubgraph.add(innerSubgraphNode)

    const outerSubgraphNode = createTestSubgraphNode(outerSubgraph, {
      parentGraph: rootGraph,
      id: 205
    })
    rootGraph.add(outerSubgraphNode)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    const modelScanSpy = vi
      .spyOn(missingModelScan, 'scanNodeModelCandidates')
      .mockReturnValue([])
    const mediaScanSpy = vi
      .spyOn(missingMediaScan, 'scanNodeMediaCandidates')
      .mockReturnValue([])

    installErrorClearingHooks(rootGraph)

    rootGraph.onNodeAdded?.(outerSubgraphNode)
    await new Promise((r) => setTimeout(r, 0))

    expect(modelScanSpy).toHaveBeenCalledWith(
      rootGraph,
      outerSubgraphNode,
      expect.any(Function),
      expect.any(Function)
    )
    expect(modelScanSpy).toHaveBeenCalledWith(
      rootGraph,
      leafNode,
      expect.any(Function),
      expect.any(Function)
    )
    expect(modelScanSpy).toHaveBeenCalledWith(
      rootGraph,
      innerSubgraphNode,
      expect.any(Function),
      expect.any(Function)
    )
    expect(mediaScanSpy).toHaveBeenCalledWith(
      rootGraph,
      outerSubgraphNode,
      false
    )
    expect(mediaScanSpy).toHaveBeenCalledWith(rootGraph, leafNode, false)
    expect(mediaScanSpy).toHaveBeenCalledWith(
      rootGraph,
      innerSubgraphNode,
      false
    )
  })

  it('removes host-keyed promoted missing models when a source ancestor is bypassed', () => {
    const { rootGraph, outerSubgraph, innerSubgraphNode } =
      createNestedSubgraphRuntime()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    installErrorClearingHooks(outerSubgraph)

    const modelStore = useMissingModelStore()
    modelStore.setMissingModels([
      fromAny<MissingModelCandidate, unknown>({
        nodeId: '65',
        sourceExecutionId: createNodeExecutionId([65, 77, 1]),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'outer_ckpt',
        isAssetSupported: false,
        name: 'fake.safetensors',
        isMissing: true
      })
    ])

    innerSubgraphNode.mode = LGraphEventMode.BYPASS
    outerSubgraph.onTrigger?.({
      type: 'node:property:changed',
      nodeId: innerSubgraphNode.id,
      property: 'mode',
      oldValue: LGraphEventMode.ALWAYS,
      newValue: LGraphEventMode.BYPASS
    })

    expect(modelStore.missingModelCandidates).toBeNull()
  })

  it('rescans ancestor hosts when a promoted source ancestor is un-bypassed', () => {
    const { rootGraph, outerSubgraph, innerSubgraphNode, outerSubgraphNode } =
      createNestedSubgraphRuntime()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(rootGraph)
    const hostCandidate = fromAny<MissingModelCandidate, unknown>({
      nodeId: '65',
      sourceExecutionId: createNodeExecutionId([65, 77, 1]),
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'outer_ckpt',
      isAssetSupported: false,
      name: 'fake.safetensors',
      isMissing: true
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockImplementation(
      (_rootGraph, node) => (node === outerSubgraphNode ? [hostCandidate] : [])
    )
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])
    installErrorClearingHooks(outerSubgraph)

    innerSubgraphNode.mode = LGraphEventMode.ALWAYS
    outerSubgraph.onTrigger?.({
      type: 'node:property:changed',
      nodeId: innerSubgraphNode.id,
      property: 'mode',
      oldValue: LGraphEventMode.BYPASS,
      newValue: LGraphEventMode.ALWAYS
    })

    expect(useMissingModelStore().missingModelCandidates).toEqual([
      hostCandidate
    ])
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

  it('clears promoted widget errors by host execution id', () => {
    const subgraph = createTestSubgraph()
    const graph = subgraph.rootGraph
    const host = createTestSubgraphNode(subgraph, { id: 2 })
    graph.add(host)

    const interiorNode = new LGraphNode('CheckpointLoaderSimple')
    interiorNode.id = toNodeId(1)
    subgraph.add(interiorNode)
    const input = interiorNode.addInput('ckpt_name', 'COMBO')
    const widget = interiorNode.addWidget(
      'combo',
      'ckpt_name',
      'fake_model.safetensors',
      () => undefined,
      { values: ['fake_model.safetensors', 'real_model.safetensors'] }
    )
    input.widget = { name: widget.name }

    expect(
      promoteValueWidgetViaSubgraphInput(host, interiorNode, widget).ok
    ).toBe(true)
    installErrorClearingHooks(graph)

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    const missingModelStore = useMissingModelStore()
    missingModelStore.setMissingModels([
      {
        nodeId: '2',
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'fake_model.safetensors',
        directory: 'checkpoints',
        isMissing: true
      }
    ])

    const promotedWidget = host.widgets[0]
    host.onWidgetChanged!.call(
      host,
      promotedWidget.name,
      'real_model.safetensors',
      'fake_model.safetensors',
      promotedWidget
    )

    expect(missingModelStore.hasMissingModels).toBe(false)
  })
})
