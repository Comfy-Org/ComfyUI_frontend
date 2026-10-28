import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
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

function serverHas(...names: string[]) {
  const defs = Object.fromEntries(names.map((name) => [name, nodeDef(name)]))
  return vi
    .spyOn(api, 'fetchNodeDefs')
    .mockImplementation(async () => Response.json(defs))
}

function pageKnows(...names: string[]) {
  useNodeDefStore().updateNodeDefs(names.map(nodeDef))
}

function canvasHas(...types: string[]) {
  const graph = new LGraph()
  for (const type of types) {
    const node = new LGraphNode(type)
    node.type = type
    graph.add(node)
  }
  vi.spyOn(app, 'rootGraph', 'get').mockReturnValue(graph)
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
    canvasHas()
  })

  it('refreshes node definitions and reloads the open workflow when the server came back with a node the canvas shows as missing', async () => {
    const order: string[] = []
    registerRefreshCommand(
      vi.fn(async () => {
        order.push('refresh')
      })
    )
    vi.mocked(useWorkflowService().reloadCurrentWorkflow).mockImplementation(
      async () => {
        order.push('reload')
      }
    )
    pageKnows('KSampler')
    canvasHas('KSampler', 'NewPackNode')
    serverHas('KSampler', 'NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(order).toEqual(['refresh', 'reload'])
  })

  it('refreshes node definitions but keeps the open workflow when the new node is not on the canvas', async () => {
    const refresh = registerRefreshCommand()
    pageKnows('KSampler')
    canvasHas('KSampler')
    serverHas('KSampler', 'NewPackNode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).toHaveBeenCalledOnce()
    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
  })

  it('does nothing when the server reconnects with the node types the page already has', async () => {
    const refresh = registerRefreshCommand()
    pageKnows('KSampler', 'CLIPTextEncode')
    canvasHas('KSampler')
    serverHas('KSampler', 'CLIPTextEncode')

    await useReconnectNodeDefinitionRefresh()()

    expect(refresh).not.toHaveBeenCalled()
    expect(useWorkflowService().reloadCurrentWorkflow).not.toHaveBeenCalled()
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
    canvasHas('NewPackNode')
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
