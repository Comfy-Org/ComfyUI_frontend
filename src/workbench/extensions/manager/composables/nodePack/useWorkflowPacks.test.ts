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

/**
 * What `ComfyApp.setup()` publishes: an empty `LGraph`, well before the
 * workflow's nodes are deserialized into it. `events` is real so tests can
 * dispatch `configured` the same way `LGraph.configure()` does in
 * production.
 */
function installEmptyRootGraph(): LGraph {
  const graph = fromPartial<LGraph>({
    nodes: [],
    events: new CustomEventTarget<LGraphEventMap>()
  })
  vi.mocked(app).rootGraph = graph
  return graph
}

/**
 * What production does once the workflow is actually deserialized into the
 * graph `ComfyApp.setup()` installed: the nodes land, then
 * `LGraph.configure()` dispatches `configured`.
 */
function deserializeWorkflow(graph: LGraph, cnrId: string) {
  graph.nodes.push(makePackedNode(cnrId))
  graph.events.dispatch('configured')
}

/** A root graph that already has the workflow's node loaded. */
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

    // The startup state CLOUD-FRONTEND-PROD-1YN was reported from: the workflow
    // is known to the app, the root graph is not installed yet.
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

    // Mirrors the production race: a caller (e.g. useMissingNodes' watch on
    // activeWorkflow) requests a fetch before the canvas has finished setup.
    await startFetchWorkflowPacks()
    expect(isReady.value).toBe(false)

    mockListAllPacks.mockResolvedValue({
      nodes: [fromPartial<NodePack>({ id: 'pack-1', name: 'Pack 1' })]
    })

    // `ComfyApp.setup()` installs the graph object -- still empty -- well
    // before the workflow's nodes are deserialized into it. This is the
    // exact state the Cursor review's finding #2 flagged: gating the retry
    // on `app.isGraphReady` alone fired right here, on zero nodes, and
    // reproduced the terminal-empty-state bug this retry exists to fix.
    const graph = installEmptyRootGraph()
    await nextTick()
    await flushPromises()
    await flushPromises()

    expect(isReady.value).toBe(false)
    expect(mockListAllPacks).not.toHaveBeenCalled()

    // Only once the workflow's node actually lands and `configure()` fires
    // `configured` does the deferred fetch retry and resolve.
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

  // The retry is owed only to a fetch that was actually deferred; a
  // `configured` event on its own is not a reason to go to the registry.
  it('does not fetch on the configured event when nothing was deferred', async () => {
    useWorkflowPacks()

    finishSetup('pack-1')
    await nextTick()
    await flushPromises()

    expect(mockListAllPacks).not.toHaveBeenCalled()
  })

  // Finding #3 on PR #19736's Cursor review: `inferPack` dereferenced
  // `nodeDefsByName[nodeName].isCoreNode` with no nil check, which throws for
  // exactly the unregistered-node case this feature targets.
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

    // No `cnr_id`/`aux_id`, so `workflowNodeToPack` falls through to
    // `inferPack`, whose `nodeDefsByName` lookup misses for an unregistered
    // node type.
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

  // Finding #3: a rejection in the deferred retry must surface through the
  // composable's own `error` state rather than becoming an unhandled
  // rejection that silently loses the deferred-fetch flag. `useCachedRequest`
  // swallows a rejecting registry call itself (resolves `null`), so this
  // drives the rejection from the registry lookup call directly, the same
  // way a bug in that call path (sync throw, bad response shape, etc) would.
  it('surfaces a retry rejection through the error state instead of losing it silently', async () => {
    const { startFetchWorkflowPacks, error } = useWorkflowPacks()

    // Defer a fetch (root graph not ready yet) so the `configured` retry
    // below actually fires.
    await startFetchWorkflowPacks()

    vi.spyOn(
      useComfyRegistryStore().inferPackFromNodeName,
      'call'
    ).mockRejectedValue(new Error('registry down'))

    // No `cnr_id`/`aux_id` and no local node def, so the retry's pack
    // resolution falls through to the rejecting registry lookup.
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

  // Finding #5 on PR #19736's Cursor review: `getWorkflowPacks` awaits a
  // per-node registry lookup, then unconditionally overwrote `workflowPacks`
  // with no in-flight guard, so an older, slower call finishing after a
  // newer one could publish a stale result over it.
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

    const { startFetchWorkflowPacks, workflowPacks, isReady } =
      useWorkflowPacks()

    // Call A starts resolving the slow node and is left awaiting the
    // registry lookup below.
    const callA = startFetchWorkflowPacks()
    await flushPromises()

    // The workflow switches before call A resolves (e.g. the manager tab
    // trigger and this retry racing), and a newer call B starts and
    // finishes first.
    vi.mocked(app).rootGraph = fromPartial<LGraph>({
      nodes: [createMockLGraphNode({ type: 'FastNode', properties: {} })],
      events: new CustomEventTarget<LGraphEventMap>()
    })
    await startFetchWorkflowPacks()

    expect(isReady.value).toBe(true)
    expect(workflowPacks.value).toEqual([
      fromPartial<NodePack>({ id: 'pack-fast', name: 'pack-fast' })
    ])

    // Call A's slow registry lookup finally resolves. Its stale result must
    // not overwrite call B's fresher one.
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
  })
})
