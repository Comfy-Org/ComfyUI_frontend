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
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'

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

let served: string[] = []

function serverHas(...names: string[]) {
  served = names
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

// The default refresh registers what the server serves, as the real one does.
function registerRefreshCommand(
  refresh = vi.fn<() => Promise<void>>(async () => pageKnows(...served))
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
    served = []
    showCanvas()
  })

  it('refreshes node definitions and reloads the open workflow when the server came back with a node the canvas shows as missing', async () => {
    const order: string[] = []
    registerRefreshCommand(
      vi.fn(async () => {
        pageKnows(...served)
        order.push('refresh')
      })
    )
    vi.mocked(useWorkflowService().reloadCurrentWorkflow).mockImplementation(
      async () => {
        order.push('reload')
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
    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
  })

  it('does nothing when the server reconnects with the node types the page already has', async () => {
    const refresh = registerRefreshCommand()
    pageKnows('KSampler', 'CLIPTextEncode')
    showCanvas(node('KSampler'))
    serverHas('KSampler', 'CLIPTextEncode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).not.toHaveBeenCalled()
    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
  })

  it('rebuilds a missing node inside a subgraph', async () => {
    const refresh = registerRefreshCommand()
    const rootGraph = showCanvas()
    const subgraph = createTestSubgraph({ rootGraph })
    subgraph.add(node('NewPackNode', { missing: true }))
    rootGraph.add(createTestSubgraphNode(subgraph))
    serverHas('NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useWorkflowService().reloadCurrentWorkflow).toHaveBeenCalledOnce()
  })

  it('keeps the open workflow when another refresh already rebuilt its missing nodes', async () => {
    const graph = showCanvas(node('NewPackNode', { missing: true }))
    registerRefreshCommand(
      vi.fn(async () => {
        pageKnows(...served)
        graph.clear()
        graph.add(node('NewPackNode'))
      })
    )
    serverHas('NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
  })

  it('counts a type LiteGraph registered outside the node definition store as known', async () => {
    const refresh = registerRefreshCommand()
    LiteGraph.registerNodeType('FrontendOnlyNode', class extends LGraphNode {})
    serverHas('FrontendOnlyNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).not.toHaveBeenCalled()
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
    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
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
    resolveFirst(Response.json({}))
    await Promise.all([first, second, third])

    expect(fetchDefs).toHaveBeenCalledTimes(2)
    expect(refresh).toHaveBeenCalledOnce()
  })
})
