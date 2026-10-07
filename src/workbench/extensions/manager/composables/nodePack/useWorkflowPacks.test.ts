import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'

import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { app } from '@/scripts/app'
import { useComfyRegistryService } from '@/services/comfyRegistryService'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'
import { useWorkflowPacks as useSharedWorkflowPacks } from '@/workbench/extensions/manager/composables/nodePack/useWorkflowPacks'

type NodePack = components['schemas']['Node']

vi.mock(import('@/scripts/app'))

vi.mock(import('@/services/comfyRegistryService'), () => ({
  useComfyRegistryService: vi.fn()
}))

const mockUseComfyRegistryService = vi.mocked(useComfyRegistryService)
const mockListAllPacks =
  vi.fn<(params: { node_id: string[] }) => Promise<{ nodes: NodePack[] }>>()
const mockInferPackFromNodeName = vi.fn()

function useWorkflowPacks() {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  return scope.run(useSharedWorkflowPacks)!
}

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0))

const makePackedNode = (cnrId: string): LGraphNode =>
  createMockLGraphNode({
    type: 'SomeNode',
    properties: { cnr_id: cnrId }
  })

function installEmptyRootGraph(): LGraph {
  const graph = fromPartial<LGraph>({
    nodes: [],
    events: new CustomEventTarget<LGraphEventMap>()
  })
  vi.mocked(app).rootGraph = graph
  return graph
}

function deserializeWorkflow(graph: LGraph, cnrId: string) {
  graph.nodes.push(makePackedNode(cnrId))
  graph.events.dispatch('configured')
}

function finishSetup(cnrId: string) {
  const graph = installEmptyRootGraph()
  deserializeWorkflow(graph, cnrId)
  return graph
}

describe('useWorkflowPacks', () => {
  beforeEach(() => {
    mockListAllPacks.mockReset().mockResolvedValue({ nodes: [] })
    mockInferPackFromNodeName.mockReset()
    mockUseComfyRegistryService.mockReturnValue(
      fromPartial({
        listAllPacks: mockListAllPacks,
        inferPackFromNodeName: mockInferPackFromNodeName
      })
    )

    vi.mocked(app).rootGraphOrUndefined = undefined
  })

  it('resolves packs immediately when the root graph is already ready', async () => {
    finishSetup('pack-1')
    mockListAllPacks.mockResolvedValue({
      nodes: [fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })]
    })

    const { startFetchWorkflowPacks, isReady, workflowPacks } =
      useWorkflowPacks()
    await startFetchWorkflowPacks()

    expect(isReady.value).toBe(true)
    expect(workflowPacks.value).toEqual([
      fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })
    ])
    expect(mockListAllPacks).toHaveBeenCalledWith(
      { node_id: ['pack-1'] },
      expect.anything()
    )
  })

  // The crash guard alone is not enough: letting the fetch through on an
  // unready graph resolves an empty pack-ID list and flips `isReady` to true,
  // which is terminal. The manager-tab trigger only fires while `!isReady` and
  // the missing-node trigger only fires when the active workflow changes, so a
  // readiness flip here leaves the Workflow and Missing tabs permanently empty
  // for the workflow that lost the race.
  it('skips the registry fetch and stays unready when the root graph is not ready yet', async () => {
    const { startFetchWorkflowPacks, isReady, isLoading } = useWorkflowPacks()
    await startFetchWorkflowPacks()

    expect(isReady.value).toBe(false)
    expect(isLoading.value).toBe(false)
    expect(mockListAllPacks).not.toHaveBeenCalled()
  })

  it('does not retry on the empty graph `setup()` installs, and resolves once the workflow is actually deserialized into it', async () => {
    const { startFetchWorkflowPacks, isReady, workflowPacks } =
      useWorkflowPacks()

    await startFetchWorkflowPacks()
    expect(isReady.value).toBe(false)

    mockListAllPacks.mockResolvedValue({
      nodes: [fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })]
    })

    const graph = installEmptyRootGraph()
    await nextTick()
    await flushPromises()
    await flushPromises()

    expect(isReady.value).toBe(false)
    expect(mockListAllPacks).not.toHaveBeenCalled()

    deserializeWorkflow(graph, 'pack-1')
    await nextTick()
    await flushPromises()
    await flushPromises()

    expect(isReady.value).toBe(true)
    expect(workflowPacks.value).toEqual([
      fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })
    ])
    expect(mockListAllPacks).toHaveBeenCalledWith(
      { node_id: ['pack-1'] },
      expect.anything()
    )
  })

  it('does not fetch on the configured event when nothing was deferred', async () => {
    useWorkflowPacks()

    const graph = installEmptyRootGraph()
    await nextTick()
    deserializeWorkflow(graph, 'pack-1')
    await nextTick()
    await flushPromises()

    expect(mockListAllPacks).not.toHaveBeenCalled()
  })

  it('falls back to the registry instead of throwing when the node has no local def', async () => {
    mockInferPackFromNodeName.mockResolvedValue(
      fromPartial<NodePack>({
        id: 'pack-1',
        latest_version: { version: '1.0.0' }
      })
    )
    mockListAllPacks.mockResolvedValue({
      nodes: [fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })]
    })

    vi.mocked(app).rootGraph = fromPartial<LGraph>({
      nodes: [
        createMockLGraphNode({ type: 'UnregisteredNode', properties: {} })
      ],
      events: new CustomEventTarget<LGraphEventMap>()
    })

    const { startFetchWorkflowPacks, isReady } = useWorkflowPacks()
    await expect(startFetchWorkflowPacks()).resolves.toBeUndefined()

    expect(isReady.value).toBe(true)
    expect(mockInferPackFromNodeName).toHaveBeenCalledWith(
      'UnregisteredNode',
      expect.anything()
    )
  })

  it('surfaces a retry rejection through the error state instead of losing it silently', async () => {
    const { startFetchWorkflowPacks, error } = useWorkflowPacks()

    await startFetchWorkflowPacks()

    vi.spyOn(
      useComfyRegistryStore().inferPackFromNodeName,
      'call'
    ).mockRejectedValue(new Error('registry down'))

    const graph = installEmptyRootGraph()
    await nextTick() // let `useEventListener` attach to the new graph.events
    graph.nodes.push(
      createMockLGraphNode({ type: 'UnregisteredNode', properties: {} })
    )
    graph.events.dispatch('configured')

    await flushPromises()
    await flushPromises()

    expect(error.value).toBeInstanceOf(Error)
  })

  it('does not let a stale, slower fetch overwrite a newer fetch that already resolved', async () => {
    let resolveSlowLookup: ((pack: NodePack) => void) | undefined
    mockInferPackFromNodeName.mockImplementation((nodeName: string) => {
      if (nodeName === 'SlowNode') {
        return new Promise<NodePack>((resolve) => {
          resolveSlowLookup = resolve
        })
      }
      return Promise.resolve(
        fromPartial<NodePack>({
          id: 'pack-fast',
          latest_version: { version: '1.0.0' }
        })
      )
    })
    mockListAllPacks.mockImplementation(
      async (params: { node_id: string[] }) => ({
        nodes: params.node_id.map((id) =>
          fromPartial<NodePack>({ id, name: id })
        )
      })
    )

    vi.mocked(app).rootGraph = fromPartial<LGraph>({
      nodes: [createMockLGraphNode({ type: 'SlowNode', properties: {} })],
      events: new CustomEventTarget<LGraphEventMap>()
    })

    const {
      startFetchWorkflowPacks,
      workflowPacks,
      isReady,
      filterWorkflowPack
    } = useWorkflowPacks()

    const callA = startFetchWorkflowPacks()
    await flushPromises()

    vi.mocked(app).rootGraph = fromPartial<LGraph>({
      nodes: [createMockLGraphNode({ type: 'FastNode', properties: {} })],
      events: new CustomEventTarget<LGraphEventMap>()
    })
    await startFetchWorkflowPacks()

    expect(isReady.value).toBe(true)
    expect(workflowPacks.value).toEqual([
      fromPartial<NodePack>({ id: 'pack-fast', name: 'pack-fast' })
    ])

    resolveSlowLookup?.(
      fromPartial<NodePack>({
        id: 'pack-slow',
        latest_version: { version: '1.0.0' }
      })
    )
    await callA
    await flushPromises()

    expect(workflowPacks.value).toEqual([
      fromPartial<NodePack>({ id: 'pack-fast', name: 'pack-fast' })
    ])
    expect(
      filterWorkflowPack([
        fromPartial<NodePack>({ id: 'pack-fast' }),
        fromPartial<NodePack>({ id: 'pack-slow' })
      ])
    ).toEqual([fromPartial<NodePack>({ id: 'pack-fast' })])
  })
})
