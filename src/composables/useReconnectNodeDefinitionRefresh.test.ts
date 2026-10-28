import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  createMockChangeTracker,
  createMockLoadedWorkflow
} from '@/utils/__tests__/litegraphTestUtils'

import { useReconnectNodeDefinitionRefresh } from './useReconnectNodeDefinitionRefresh'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => distribution)
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/platform/telemetry/reportError'))

function nodeDef(name: string): ComfyNodeDef {
  return {
    name,
    display_name: name,
    category: 'test',
    python_module: 'custom_nodes.test',
    description: '',
    input: { required: {}, optional: {} },
    output: [],
    output_name: [],
    output_is_list: [],
    output_node: false
  }
}

function serverHas(...names: string[]) {
  const defs = Object.fromEntries(names.map((name) => [name, nodeDef(name)]))
  return vi
    .spyOn(api, 'fetchNodeDefs')
    .mockImplementation(async () => Response.json(defs))
}

function pageKnows(...names: string[]) {
  useNodeDefStore().updateNodeDefs(names.map(nodeDef))
}

function node(type: string, { missing = false } = {}): LGraphNode {
  const node = new LGraphNode('', type)
  if (missing) node.last_serialization = node.serialize()
  return node
}

function showCanvas(...nodes: LGraphNode[]): LGraph {
  const graph = createTestRootGraph()
  for (const each of nodes) graph.add(each)
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
  return graph
}

function registerRefreshCommand(
  refresh = vi.fn<() => Promise<void>>(async () => {})
) {
  useCommandStore().registerCommand({
    id: 'Comfy.RefreshNodeDefinitions',
    function: refresh
  })
  return refresh
}

describe('useReconnectNodeDefinitionRefresh', () => {
  beforeEach(() => {
    distribution.isCloud = false
    showCanvas()
    useWorkflowStore().activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/open.json',
      changeTracker: createMockChangeTracker({ changeCount: 0 })
    })
    vi.mocked(useWorkflowService().openWorkflow).mockResolvedValue(true)
  })

  it('refreshes node definitions and reloads the open workflow when the server came back with a node the canvas shows as missing', async () => {
    const order: string[] = []
    registerRefreshCommand(
      vi.fn(async () => {
        pageKnows('KSampler', 'NewPackNode')
        order.push('refresh')
      })
    )
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async () => {
        order.push('reload')
        return true
      }
    )
    pageKnows('KSampler')
    showCanvas(node('KSampler'), node('NewPackNode', { missing: true }))
    serverHas('KSampler', 'NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(order).toEqual(['refresh', 'reload'])
  })

  it('refreshes node definitions but keeps the open workflow when the new node is not on the canvas', async () => {
    const refresh = registerRefreshCommand()
    pageKnows('KSampler')
    showCanvas(node('KSampler'))
    serverHas('KSampler', 'NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it('does nothing when the server reconnects with the node types the page already has', async () => {
    const refresh = registerRefreshCommand()
    pageKnows('KSampler', 'CLIPTextEncode')
    showCanvas(node('KSampler'))
    serverHas('KSampler', 'CLIPTextEncode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).not.toHaveBeenCalled()
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it('rebuilds a missing node inside a subgraph', async () => {
    const refresh = registerRefreshCommand(
      vi.fn(async () => pageKnows('NewPackNode'))
    )
    const rootGraph = showCanvas()
    const subgraph = createTestSubgraph({ rootGraph })
    subgraph.add(node('NewPackNode', { missing: true }))
    rootGraph.add(createTestSubgraphNode(subgraph))
    serverHas('NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
  })

  it('keeps the open workflow when another refresh already rebuilt its missing nodes', async () => {
    const graph = showCanvas(node('NewPackNode', { missing: true }))
    registerRefreshCommand(
      vi.fn(async () => {
        pageKnows('NewPackNode')
        graph.clear()
        graph.add(node('NewPackNode'))
      })
    )
    serverHas('NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it('counts a type LiteGraph registered outside the node definition store as known', async () => {
    const refresh = registerRefreshCommand()
    LiteGraph.registerNodeType('FrontendOnlyNode', class extends LGraphNode {})
    serverHas('FrontendOnlyNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).not.toHaveBeenCalled()
  })

  it('keeps the open workflow when the refresh resolves without registering the new type', async () => {
    const refresh = registerRefreshCommand()
    showCanvas(node('NewPackNode', { missing: true }))
    serverHas('NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it('reloads the checked workflow only while it is still the active one', async () => {
    registerRefreshCommand(vi.fn(async () => pageKnows('NewPackNode')))
    showCanvas(node('NewPackNode', { missing: true }))
    serverHas('NewPackNode')
    const checked = useWorkflowStore().activeWorkflow

    await useReconnectNodeDefinitionRefresh()()

    const [workflow, options] = vi.mocked(useWorkflowService().openWorkflow)
      .mock.calls[0]
    expect(workflow).toBe(checked)
    expect(options).toMatchObject({ force: true })
    expect(options?.isCurrent?.()).toBe(true)
    useWorkflowStore().activeWorkflow = createMockLoadedWorkflow({
      path: 'workflows/other.json'
    })
    expect(options?.isCurrent?.()).toBe(false)
  })

  it('does not fetch node definitions on cloud', async () => {
    distribution.isCloud = true
    const refresh = registerRefreshCommand()
    const fetchDefs = serverHas('NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(fetchDefs).not.toHaveBeenCalled()
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does nothing when the server refuses the node definitions', async () => {
    const refresh = registerRefreshCommand()
    vi.spyOn(api, 'fetchNodeDefs').mockResolvedValue(
      new Response('down', { status: 503 })
    )

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports a failed refresh and keeps the open workflow', async () => {
    const failure = new Error('refresh failed')
    registerRefreshCommand(
      vi.fn<() => Promise<void>>().mockRejectedValue(failure)
    )
    showCanvas(node('NewPackNode', { missing: true }))
    serverHas('NewPackNode')

    await expect(useReconnectNodeDefinitionRefresh()()).resolves.toBeUndefined()

    expect(reportError).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      failure,
      expect.objectContaining({
        errorType: 'failure_refreshing_node_definitions_after_reconnect'
      })
    )
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })

  it('checks once more when ComfyUI reconnects again during a check', async () => {
    const refresh = registerRefreshCommand()
    let resolveFirst!: (response: Response) => void
    const fetchDefs = vi
      .spyOn(api, 'fetchNodeDefs')
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveFirst = resolve
          })
      )
      .mockImplementation(async () =>
        Response.json({ NewPackNode: nodeDef('NewPackNode') })
      )

    const onReconnected = useReconnectNodeDefinitionRefresh()
    const first = onReconnected()
    const second = onReconnected()
    const third = onReconnected()
    expect(fetchDefs).toHaveBeenCalledOnce()
    resolveFirst(Response.json({}))
    await Promise.all([first, second, third])

    expect(fetchDefs).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledOnce()

    await onReconnected()

    expect(fetchDefs).toHaveBeenCalledTimes(3)
  })

  it('rebuilds missing nodes on a later reconnect after a refresh registered their type but then failed', async () => {
    registerRefreshCommand(
      vi.fn(async () => {
        pageKnows('NewPackNode')
        throw new Error('an extension refresh callback failed')
      })
    )
    showCanvas(node('NewPackNode', { missing: true }))
    serverHas('NewPackNode')
    const onReconnected = useReconnectNodeDefinitionRefresh()

    await onReconnected()
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()

    await onReconnected()
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
  })

  it('keeps the saved baseline and modified flag across the rebuild', async () => {
    registerRefreshCommand(vi.fn(async () => pageKnows('NewPackNode')))
    showCanvas(node('NewPackNode', { missing: true }))
    serverHas('NewPackNode')
    const workflow = useWorkflowStore().activeWorkflow!
    const baseline = workflow.changeTracker.initialState
    workflow.isModified = true
    vi.mocked(useWorkflowService().openWorkflow).mockImplementation(
      async (opened) => {
        opened.changeTracker!.initialState = structuredClone(
          opened.changeTracker!.activeState
        )
        opened.isModified = false
        return true
      }
    )

    await useReconnectNodeDefinitionRefresh()()

    expect(workflow.changeTracker.initialState).toBe(baseline)
    expect(workflow.isModified).toBe(true)
  })

  it('waits for an edit in progress to finish before rebuilding', async () => {
    registerRefreshCommand(vi.fn(async () => pageKnows('NewPackNode')))
    showCanvas(node('NewPackNode', { missing: true }))
    serverHas('NewPackNode')
    const tracker = useWorkflowStore().activeWorkflow!.changeTracker
    tracker.changeCount = 1

    const done = useReconnectNodeDefinitionRefresh()()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()

    tracker.changeCount = 0
    await vi.advanceTimersByTimeAsync(200)
    await done
    expect(useWorkflowService().openWorkflow).toHaveBeenCalledOnce()
  })

  it('skips the rebuild when an edit stays in progress', async () => {
    registerRefreshCommand(vi.fn(async () => pageKnows('NewPackNode')))
    showCanvas(node('NewPackNode', { missing: true }))
    serverHas('NewPackNode')
    useWorkflowStore().activeWorkflow!.changeTracker.changeCount = 1

    const done = useReconnectNodeDefinitionRefresh()()
    await vi.advanceTimersByTimeAsync(31_000)
    await done

    expect(useWorkflowService().openWorkflow).not.toHaveBeenCalled()
  })
})
