import { fromAny } from '@total-typescript/shoehorn'
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
import {
  createMissingMediaCandidate,
  createPromotedMediaRuntime,
  createPromotedMissingMediaCandidate,
  deferMediaVerification
} from '@/platform/missingMedia/__fixtures__/promotedMedia'
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

function stubRootGraph(graph: LGraph | undefined) {
  const rootGraph = vi.spyOn(app, 'rootGraph', 'get')
  if (graph) {
    rootGraph.mockReturnValue(graph)
  } else {
    rootGraph.mockImplementation(() => {
      throw new Error('rootGraph accessed before initialization')
    })
  }
  vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(!!graph)
}

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

  return {
    rootGraph,
    outerSubgraph,
    innerSubgraph,
    leafNode,
    innerSubgraphNode,
    outerSubgraphNode
  }
}

function setNodeMode(
  graph: LGraph,
  node: LGraphNode,
  newMode: LGraphEventMode
): void {
  const oldMode = node.mode
  node.mode = newMode
  graph.onTrigger?.({
    type: 'node:property:changed',
    nodeId: node.id,
    property: 'mode',
    oldValue: oldMode,
    newValue: newMode
  })
}

async function startPendingPromotedMediaVerification() {
  const {
    rootGraph,
    hosts: [outerHost],
    sourceNodes: [leafNode]
  } = createPromotedMediaRuntime({ depth: 2, hostValue: 'pending.png' })
  outerHost.mode = LGraphEventMode.BYPASS
  stubRootGraph(rootGraph)

  const pendingCandidate = {
    ...createPromotedMissingMediaCandidate(outerHost),
    isMissing: undefined
  }
  vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([])
  vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockImplementation(
    (_rootGraph, node) => (node === outerHost ? [pendingCandidate] : [])
  )
  const { verifySpy, resolveVerification } = deferMediaVerification()

  installErrorClearingHooks(rootGraph)
  setNodeMode(rootGraph, outerHost, LGraphEventMode.ALWAYS)
  await vi.waitFor(() => expect(verifySpy).toHaveBeenCalled())

  return {
    rootGraph,
    outerHost,
    leafNode,
    pendingCandidate,
    resolveVerification
  }
}

describe('Connection error clearing via onConnectionsChange', () => {
  beforeEach(() => {
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
    stubRootGraph(graph)
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
    stubRootGraph(graph)
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
    stubRootGraph(graph)
    store.recordNodeErrors({
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
    })

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
    stubRootGraph(graph)
    store.recordNodeErrors({
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
    })

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
    stubRootGraph(undefined)
    store.recordNodeErrors({
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
    })

    node.onWidgetChanged!.call(node, 'steps', 50, 20, node.widgets![0])

    expect(store.lastNodeErrors).not.toBeNull()
  })

  it('clears missing media when an upload emits onWidgetChanged', () => {
    const graph = new LGraph()
    const node = new LGraphNode('LoadImage', 'LoadImage')
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
    stubRootGraph(graph)
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
    stubRootGraph(graph)
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

  it('stops hooking added nodes after cleanup, leaving onNodeAdded alone', () => {
    const graph = new LGraph()
    const originalHook = vi.fn()
    graph.onNodeAdded = originalHook

    const cleanup = installErrorClearingHooks(graph)
    expect(graph.onNodeAdded).toBe(originalHook)

    const hooked = new LGraphNode('hooked')
    hooked.onConnectionsChange = vi.fn()
    graph.add(hooked)
    expect(graph.onNodeAdded).toBe(originalHook)

    cleanup()

    const afterCleanup = new LGraphNode('after-cleanup')
    const untouched = vi.fn()
    afterCleanup.onConnectionsChange = untouched
    graph.add(afterCleanup)

    expect(afterCleanup.onConnectionsChange).toBe(untouched)
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

    graph.remove(node)

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
    stubRootGraph(graph)
    installErrorClearingHooks(graph)

    const node = new LGraphNode(
      'CheckpointLoaderSimple',
      'CheckpointLoaderSimple'
    )
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
    stubRootGraph(graph)
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

    const node = new LGraphNode(
      'CheckpointLoaderSimple',
      'CheckpointLoaderSimple'
    )
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
    stubRootGraph(graph)
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([])
    const mediaScan = vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates')
    installErrorClearingHooks(graph)

    const node = new LGraphNode('LoadVideo', 'LoadVideo')
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

  it('keeps an added-node scan pending until async verification settles', async () => {
    const graph = new LGraph()
    stubRootGraph(graph)
    const candidate = fromAny<MissingModelCandidate, unknown>({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'pending.safetensors',
      isMissing: undefined
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      candidate
    ])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])
    let resolveVerification: () => void = () => undefined
    vi.spyOn(
      missingModelScan,
      'verifyAssetSupportedCandidates'
    ).mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        resolveVerification = resolve
      })
      candidate.isMissing = true
    })
    installErrorClearingHooks(graph)

    const node = new LGraphNode('CheckpointLoaderSimple')
    node.id = toNodeId(1)
    node.addWidget(
      'combo',
      'ckpt_name',
      'pending.safetensors',
      () => undefined,
      { values: [] }
    )
    graph.add(node)

    const store = useExecutionErrorStore()
    const executionId = createNodeExecutionId([node.id])
    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(true)

    await vi.waitFor(() =>
      expect(
        missingModelScan.verifyAssetSupportedCandidates
      ).toHaveBeenCalledOnce()
    )
    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(true)

    resolveVerification()
    await vi.waitFor(() =>
      expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(false)
    )
    expect(useMissingModelStore().missingModelCandidates).toEqual([candidate])
  })

  it('waits for started verification when a later scan stage fails', async () => {
    const graph = new LGraph()
    stubRootGraph(graph)
    const candidate = fromAny<MissingModelCandidate, unknown>({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'pending.safetensors',
      isMissing: undefined
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      candidate
    ])
    const scanError = new Error('Malformed media widget')
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockImplementation(
      () => {
        throw scanError
      }
    )
    let resolveVerification: () => void = () => undefined
    vi.spyOn(
      missingModelScan,
      'verifyAssetSupportedCandidates'
    ).mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        resolveVerification = resolve
      })
    })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    installErrorClearingHooks(graph)

    const node = new LGraphNode('CheckpointLoaderSimple')
    node.id = toNodeId(1)
    graph.add(node)
    const store = useExecutionErrorStore()
    const executionId = createNodeExecutionId([node.id])

    await vi.waitFor(() =>
      expect(
        missingModelScan.verifyAssetSupportedCandidates
      ).toHaveBeenCalledOnce()
    )
    await Promise.resolve()
    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(true)
    expect(warn).not.toHaveBeenCalledWith(
      '[useErrorClearingHooks] added-node scan failed:',
      scanError
    )

    resolveVerification()
    await vi.waitFor(() =>
      expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(false)
    )
    expect(warn).toHaveBeenCalledWith(
      '[useErrorClearingHooks] added-node scan failed:',
      scanError
    )
  })

  it('releases a pending added-node scan when hooks are disposed', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    const cleanup = installErrorClearingHooks(graph)
    const node = new LGraphNode('test')
    graph.add(node)

    const store = useExecutionErrorStore()
    const executionId = createNodeExecutionId([node.id])
    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(true)

    cleanup()

    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(false)
  })

  it('continues async verification after hooks are disposed', async () => {
    const graph = new LGraph()
    stubRootGraph(graph)
    const candidate = fromAny<MissingModelCandidate, unknown>({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'pending.safetensors',
      isMissing: undefined
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      candidate
    ])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])
    let resolveVerification: () => void = () => undefined
    vi.spyOn(
      missingModelScan,
      'verifyAssetSupportedCandidates'
    ).mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        resolveVerification = resolve
      })
      candidate.isMissing = true
    })
    const cleanup = installErrorClearingHooks(graph)
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.id = toNodeId(1)
    node.addWidget(
      'combo',
      'ckpt_name',
      'pending.safetensors',
      () => undefined,
      { values: [] }
    )
    graph.add(node)

    await vi.waitFor(() =>
      expect(
        missingModelScan.verifyAssetSupportedCandidates
      ).toHaveBeenCalledOnce()
    )
    cleanup()
    resolveVerification()
    await vi.waitFor(() => expect(candidate.isMissing).toBe(true))

    expect(
      useExecutionErrorStore().hasPendingAddedNodeErrorScan(
        graph,
        createNodeExecutionId([node.id])
      )
    ).toBe(false)
    expect(useMissingModelStore().missingModelCandidates).toEqual([candidate])
  })

  it('does not scan a disposed workflow after the root graph changes', async () => {
    const graphA = new LGraph()
    const graphB = new LGraph()
    let currentRoot = graphA
    vi.spyOn(app, 'rootGraph', 'get').mockImplementation(() => currentRoot)
    const modelScan = vi.spyOn(missingModelScan, 'scanNodeModelCandidates')
    const cleanup = installErrorClearingHooks(graphA)
    const nodeA = new LGraphNode('CheckpointLoaderSimple')
    nodeA.id = toNodeId(1)
    const nodeB = new LGraphNode('CheckpointLoaderSimple')
    nodeB.id = toNodeId(1)
    graphB.add(nodeB)

    graphA.add(nodeA)
    cleanup()
    currentRoot = graphB
    await Promise.resolve()

    expect(modelScan).not.toHaveBeenCalled()
    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })

  it('does not surface verification from replaced nodes in the same root graph', async () => {
    const graph = new LGraph()
    stubRootGraph(graph)
    const candidate = fromAny<MissingModelCandidate, unknown>({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'same.safetensors',
      isMissing: undefined
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      candidate
    ])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])
    let resolveVerification: () => void = () => undefined
    const verifySpy = vi
      .spyOn(missingModelScan, 'verifyAssetSupportedCandidates')
      .mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          resolveVerification = resolve
        })
        candidate.isMissing = true
      })
    const cleanup = installErrorClearingHooks(graph)
    const oldNode = new LGraphNode('CheckpointLoaderSimple')
    oldNode.id = toNodeId(1)
    oldNode.addWidget(
      'combo',
      'ckpt_name',
      'same.safetensors',
      () => undefined,
      { values: [] }
    )
    graph.add(oldNode)
    await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())

    cleanup()
    graph.remove(oldNode)
    const replacement = new LGraphNode('CheckpointLoaderSimple')
    replacement.id = toNodeId(1)
    replacement.addWidget(
      'combo',
      'ckpt_name',
      'same.safetensors',
      () => undefined,
      { values: [] }
    )
    graph.add(replacement)
    resolveVerification()

    await vi.waitFor(() => expect(candidate.isMissing).toBe(true))
    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })

  it('does not surface a model value changed during verification', async () => {
    const graph = new LGraph()
    stubRootGraph(graph)
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.id = toNodeId(1)
    const widget = node.addWidget(
      'combo',
      'ckpt_name',
      'old.safetensors',
      () => undefined,
      { values: [] }
    )
    const candidate = fromAny<MissingModelCandidate, unknown>({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'old.safetensors',
      isMissing: undefined
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      candidate
    ])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])
    let resolveVerification: () => void = () => undefined
    const verifySpy = vi
      .spyOn(missingModelScan, 'verifyAssetSupportedCandidates')
      .mockImplementation(async () => {
        await new Promise<void>((resolve) => {
          resolveVerification = resolve
        })
        candidate.isMissing = true
      })
    installErrorClearingHooks(graph)

    graph.add(node)
    await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())
    widget.value = 'new.safetensors'
    resolveVerification()

    await vi.waitFor(() => expect(candidate.isMissing).toBe(true))
    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })

  it('cancels an added-node model scan when its node is removed', async () => {
    const graph = new LGraph()
    stubRootGraph(graph)
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.id = toNodeId(1)
    const candidate = fromAny<MissingModelCandidate, unknown>({
      nodeId: '1',
      nodeType: 'CheckpointLoaderSimple',
      widgetName: 'ckpt_name',
      name: 'pending.safetensors',
      isMissing: undefined
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([
      candidate
    ])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([])
    let resolveVerification: () => void = () => undefined
    const verifySpy = vi
      .spyOn(missingModelScan, 'verifyAssetSupportedCandidates')
      .mockImplementation(async (_candidates, signal) => {
        await new Promise<void>((resolve) => {
          resolveVerification = resolve
        })
        if (!signal?.aborted) candidate.isMissing = true
      })
    installErrorClearingHooks(graph)

    graph.add(node)
    await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())
    const store = useExecutionErrorStore()
    const executionId = createNodeExecutionId([node.id])

    graph.remove(node)

    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(false)
    expect(verifySpy.mock.calls[0][1]?.aborted).toBe(true)
    resolveVerification()
    await Promise.resolve()
    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })

  it('cancels an added-node media scan when its node is removed', async () => {
    const graph = new LGraph()
    stubRootGraph(graph)
    const node = new LGraphNode('LoadImage')
    node.id = toNodeId(1)
    const candidate = createMissingMediaCandidate([node.id], {
      isMissing: undefined
    })
    vi.spyOn(missingModelScan, 'scanNodeModelCandidates').mockReturnValue([])
    vi.spyOn(missingMediaScan, 'scanNodeMediaCandidates').mockReturnValue([
      candidate
    ])
    const { verifySpy, resolveVerification } = deferMediaVerification()
    installErrorClearingHooks(graph)

    graph.add(node)
    await vi.waitFor(() => expect(verifySpy).toHaveBeenCalledOnce())
    const store = useExecutionErrorStore()
    const executionId = createNodeExecutionId([node.id])
    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(true)

    graph.remove(node)

    expect(store.hasPendingAddedNodeErrorScan(graph, executionId)).toBe(false)
    expect(verifySpy.mock.calls[0][1]?.signal?.aborted).toBe(true)

    resolveVerification()
    await vi.waitFor(() => expect(candidate.isMissing).toBe(true))
    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })

  it('does not schedule scans through a retained disposed callback', () => {
    const graph = new LGraph()
    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    const cleanup = installErrorClearingHooks(graph)
    const disposedOnNodeAdded = graph.onNodeAdded
    cleanup()

    const node = new LGraphNode('test')
    node.id = toNodeId(1)
    graph.add(node, true)
    disposedOnNodeAdded?.(node)

    expect(
      useExecutionErrorStore().hasPendingAddedNodeErrorScan(
        graph,
        createNodeExecutionId([node.id])
      )
    ).toBe(false)
  })
})

describe('onNodeRemoved clears missing asset errors by execution ID', () => {
  beforeEach(() => {
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('removes root-level node missing model error using its local id', () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    graph.add(node)

    stubRootGraph(graph)
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

  it('preserves same-id successor missing model errors', () => {
    const graph = new LGraph()
    const orphan = new LGraphNode('CheckpointLoaderSimple')
    graph.add(orphan)
    const successor = new LGraphNode('CheckpointLoaderSimple')
    successor.id = orphan.id
    graph._nodes.push(successor)
    graph._nodes_by_id[orphan.id] = successor

    vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
    installErrorClearingHooks(graph)

    const modelStore = useMissingModelStore()
    modelStore.setMissingModels([
      fromAny<
        Parameters<typeof modelStore.setMissingModels>[0][number],
        unknown
      >({
        nodeId: String(successor.id),
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'model.safetensors',
        isMissing: true
      })
    ])

    graph.remove(orphan, { preserveCanonicalState: true })

    expect(graph.getNodeById(successor.id)).toBe(successor)
    expect(modelStore.missingModelCandidates).toHaveLength(1)
  })

  it('removes missing model errors when the graph is cleared', () => {
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

    graph.clear()

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

    stubRootGraph(rootGraph)
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

    stubRootGraph(rootGraph)
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

  it('reconciles missing media once for a burst of removals', async () => {
    const subgraph = createTestSubgraph()
    const addInteriorNode = (id: number) => {
      const node = new LGraphNode('LoadImage')
      node.id = toNodeId(id)
      subgraph.add(node)
      return node
    }
    const removedNodes = [1, 2, 3].map(addInteriorNode)
    const survivingNodes = [4, 5].map(addInteriorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    const rootGraph = subgraphNode.graph as LGraph
    rootGraph.add(subgraphNode)

    stubRootGraph(rootGraph)
    installErrorClearingHooks(subgraph)

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia(
      survivingNodes.map((node) =>
        createMissingMediaCandidate([toNodeId(65), node.id], {
          name: `cat-${node.id}.png`
        })
      )
    )

    const scopeSpy = vi.spyOn(
      missingMediaScan,
      'isMissingMediaCandidateScopeActive'
    )

    for (const node of removedNodes) subgraph.remove(node)

    expect.soft(scopeSpy).not.toHaveBeenCalled()

    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(scopeSpy).toHaveBeenCalledTimes(survivingNodes.length)
  })

  it('removes host-keyed missing media when its sole promoted consumer is deleted', () => {
    const {
      rootGraph,
      subgraph,
      hosts: [host],
      sourceNodes
    } = createPromotedMediaRuntime()
    stubRootGraph(rootGraph)
    installErrorClearingHooks(subgraph)

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([createPromotedMissingMediaCandidate(host)])

    expect(host.widgets).toHaveLength(1)
    subgraph.remove(sourceNodes[0])

    expect(host.widgets).toHaveLength(0)
    expect(mediaStore.missingMediaCandidates).toBeNull()
  })

  it('keeps promoted missing media until the last fanout consumer is deleted', () => {
    const {
      rootGraph,
      subgraph,
      hosts: [host],
      sourceNodes
    } = createPromotedMediaRuntime({ sourceIds: [42, 43, 44] })
    stubRootGraph(rootGraph)
    installErrorClearingHooks(subgraph)

    const candidate = createPromotedMissingMediaCandidate(host)
    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([candidate])

    subgraph.remove(sourceNodes[0])
    expect(host.widgets).toHaveLength(1)
    expect(mediaStore.missingMediaCandidates).toEqual([candidate])

    subgraph.remove(sourceNodes[2])
    expect(host.widgets).toHaveLength(1)
    expect(mediaStore.missingMediaCandidates).toEqual([candidate])

    subgraph.remove(sourceNodes[1])
    expect(host.widgets).toHaveLength(0)
    expect(mediaStore.missingMediaCandidates).toBeNull()
  })
})

describe('realtime scan verifies pending cloud candidates', () => {
  beforeEach(() => {
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('un-bypass path surfaces pending model candidates after verification', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    node.addWidget(
      'combo',
      'ckpt_name',
      'cloud_model.safetensors',
      () => undefined,
      { values: [] }
    )
    graph.add(node)
    stubRootGraph(graph)

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
    node.addWidget('combo', 'image', 'cloud_image.png', () => undefined, {
      values: []
    })
    graph.add(node)
    stubRootGraph(graph)

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
    stubRootGraph(graph)

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
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('skips adding verified model when node was bypassed before verification resolved', async () => {
    const graph = new LGraph()
    const node = new LGraphNode('CheckpointLoaderSimple')
    graph.add(node)
    stubRootGraph(graph)

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
    stubRootGraph(graph)

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

  it('surfaces verified media while its promoted consumer remains active', async () => {
    const { pendingCandidate, resolveVerification } =
      await startPendingPromotedMediaVerification()
    resolveVerification()

    await vi.waitFor(() => {
      expect(useMissingMediaStore().missingMediaCandidates).toEqual([
        pendingCandidate
      ])
    })
  })

  it('skips verified media whose host widget value changed while verification was pending', async () => {
    const { outerHost, resolveVerification } =
      await startPendingPromotedMediaVerification()
    const hostWidget = outerHost.widgets?.[0]
    if (!hostWidget) throw new Error('Expected promoted image host widget')

    hostWidget.value = 'corrected.png'
    resolveVerification()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })

  it('skips verified media when its sole promoted consumer becomes bypassed', async () => {
    const { leafNode, resolveVerification } =
      await startPendingPromotedMediaVerification()

    leafNode.mode = LGraphEventMode.BYPASS
    resolveVerification()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(useMissingMediaStore().missingMediaCandidates).toBeNull()
  })

  it('skips adding verified model when rootGraph switched before verification resolved', async () => {
    // Workflow A has a pending candidate on node id=1. A is replaced
    // by workflow B (fresh LGraph, potentially has a node with the
    // same id). Late verification from A must not leak into B.
    const graphA = new LGraph()
    const nodeA = new LGraphNode('CheckpointLoaderSimple')
    graphA.add(nodeA)
    stubRootGraph(graphA)

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
    stubRootGraph(graphB)

    resolveVerify!()
    await new Promise((r) => setTimeout(r, 0))

    // A's verification finished but rootGraph is now B — the late
    // result must not be added to the store.
    expect(useMissingModelStore().missingModelCandidates).toBeNull()
  })
})

describe('scan skips interior of bypassed subgraph containers', () => {
  beforeEach(() => {
    vi.spyOn(app, 'isGraphReady', 'get').mockReturnValue(false)
  })

  it('does not surface interior missing model when entering a bypassed subgraph', async () => {
    // Repro: root has a bypassed subgraph container, interior node is
    // itself active. An interior add previously reached
    // scanSingleNodeErrors without an ancestor check and resurfaced the
    // error that the initial pipeline post-filter had correctly dropped.
    const subgraph = createTestSubgraph()
    const interiorNode = new LGraphNode('CheckpointLoaderSimple')
    subgraph.add(interiorNode)

    const subgraphNode = createTestSubgraphNode(subgraph, { id: 65 })
    subgraphNode.mode = LGraphEventMode.BYPASS
    const rootGraph = subgraphNode.graph as LGraph
    rootGraph.add(subgraphNode)

    stubRootGraph(rootGraph)
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

    // An add inside the bypassed subgraph's interior.
    subgraph.events.dispatch('node:added', { node: interiorNode })
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

    stubRootGraph(rootGraph)
    const modelScanSpy = vi
      .spyOn(missingModelScan, 'scanNodeModelCandidates')
      .mockReturnValue([])
    const mediaScanSpy = vi
      .spyOn(missingMediaScan, 'scanNodeMediaCandidates')
      .mockReturnValue([])

    installErrorClearingHooks(rootGraph)

    rootGraph.events.dispatch('node:added', { node: outerSubgraphNode })
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
    stubRootGraph(rootGraph)
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

  it('keeps only unaffected missing media after its sole promoted consumer is bypassed', () => {
    const {
      rootGraph,
      hosts: [outerHost],
      sourceGraphs: [innerSubgraph],
      sourceNodes: [leafNode]
    } = createPromotedMediaRuntime({ depth: 2 })
    const unaffectedNode = new LGraphNode('LoadImage', 'LoadImage')
    unaffectedNode.id = toNodeId(80)
    unaffectedNode.addWidget('combo', 'image', 'other.png', () => undefined, {
      values: []
    })
    rootGraph.add(unaffectedNode)
    stubRootGraph(rootGraph)
    installErrorClearingHooks(innerSubgraph)

    const mediaStore = useMissingMediaStore()
    const affectedCandidate = createPromotedMissingMediaCandidate(outerHost)
    const unaffectedCandidate = createMissingMediaCandidate(
      [unaffectedNode.id],
      { name: 'other.png' }
    )
    mediaStore.setMissingMedia([affectedCandidate, unaffectedCandidate])

    setNodeMode(innerSubgraph, leafNode, LGraphEventMode.BYPASS)

    expect(mediaStore.missingMediaCandidates).toEqual([unaffectedCandidate])
  })

  it('keeps promoted missing media until the last fanout consumer is bypassed', () => {
    const {
      rootGraph,
      subgraph,
      hosts: [host],
      sourceNodes
    } = createPromotedMediaRuntime({ sourceIds: [42, 43, 44] })
    stubRootGraph(rootGraph)
    installErrorClearingHooks(subgraph)

    const candidate = createPromotedMissingMediaCandidate(host)
    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([candidate])

    setNodeMode(subgraph, sourceNodes[0], LGraphEventMode.BYPASS)
    expect(mediaStore.missingMediaCandidates).toEqual([candidate])

    setNodeMode(subgraph, sourceNodes[2], LGraphEventMode.BYPASS)
    expect(mediaStore.missingMediaCandidates).toEqual([candidate])

    setNodeMode(subgraph, sourceNodes[1], LGraphEventMode.BYPASS)
    expect(mediaStore.missingMediaCandidates).toBeNull()
  })

  it('removes promoted missing media when an intermediate host is bypassed', () => {
    const {
      rootGraph,
      subgraph: outerSubgraph,
      hosts: [outerHost],
      intermediateHosts: [innerHost]
    } = createPromotedMediaRuntime({ depth: 2 })
    if (!innerHost) throw new Error('Expected nested promoted image host')
    stubRootGraph(rootGraph)
    installErrorClearingHooks(outerSubgraph)

    const mediaStore = useMissingMediaStore()
    mediaStore.setMissingMedia([createPromotedMissingMediaCandidate(outerHost)])

    setNodeMode(outerSubgraph, innerHost, LGraphEventMode.BYPASS)

    expect(mediaStore.missingMediaCandidates).toBeNull()
  })

  it('rescans ancestor hosts when a promoted source ancestor is un-bypassed', () => {
    const { rootGraph, outerSubgraph, innerSubgraphNode, outerSubgraphNode } =
      createNestedSubgraphRuntime()
    stubRootGraph(rootGraph)
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

    innerSubgraphNode.mode = LGraphEventMode.BYPASS
    setNodeMode(outerSubgraph, innerSubgraphNode, LGraphEventMode.ALWAYS)

    expect(useMissingModelStore().missingModelCandidates).toEqual([
      hostCandidate
    ])
  })
})

describe('clearWidgetRelatedErrors parameter routing', () => {
  beforeEach(() => {
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
    stubRootGraph(graph)
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

    stubRootGraph(graph)
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
