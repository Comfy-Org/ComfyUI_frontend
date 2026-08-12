import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import { api } from '@/scripts/api'

import { createComfyApi } from './comfyApi'

const { queuePrompt } = vi.hoisted(() => ({
  queuePrompt: vi.fn(async (..._args: unknown[]) => true)
}))
vi.mock('@/scripts/app', () => ({ app: { queuePrompt } }))

function graphWith(...titles: string[]) {
  const graph = new LGraph()
  for (const title of titles) {
    const node = new LGraphNode(title)
    node.addOutput('out', 'IMAGE')
    graph.add(node)
  }
  return graph
}

describe('comfy.queue', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    queuePrompt.mockClear()
  })

  it('runs the whole workflow', async () => {
    const comfy = createComfyApi(() => graphWith('A'))
    await comfy.queue.run()

    expect(queuePrompt).toHaveBeenCalledWith(0, 1)
  })

  it('passes the batch count through', async () => {
    const comfy = createComfyApi(() => graphWith('A'))
    await comfy.queue.run({ batch: 4 })

    expect(queuePrompt).toHaveBeenCalledWith(0, 4)
  })

  it('runs only the given nodes', async () => {
    // Partial execution is a host feature; packs used to get here by rewriting
    // prompt.output by hand, which is the surface we are retiring.
    const graph = graphWith('A', 'B')
    const comfy = createComfyApi(() => graph)
    const target = comfy.graph.nodes()[1]

    await comfy.queue.run({ nodes: [target] })

    expect(queuePrompt).toHaveBeenCalledWith(0, 1, [String(target.id)])
  })

  it('refuses an empty node list rather than running everything', async () => {
    // A filter that matched nothing must not silently run the whole graph.
    const comfy = createComfyApi(() => graphWith('A'))

    await expect(comfy.queue.run({ nodes: [] })).rejects.toThrow(
      /at least one node/
    )
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('refuses a node that has left the graph', async () => {
    const graph = graphWith('A')
    const comfy = createComfyApi(() => graph)
    const node = comfy.graph.nodes()[0]
    graph.remove(graph.getNodeById(toNodeId(node.id))!)

    await expect(comfy.queue.run({ nodes: [node] })).rejects.toThrow(
      /not in the graph/
    )
    expect(queuePrompt).not.toHaveBeenCalled()
  })

  it('reports runs starting and finishing being submitted', () => {
    const comfy = createComfyApi(() => graphWith('A'))
    const before = vi.fn()
    const after = vi.fn()
    const stop = comfy.queue.onBeforeRun(before)
    comfy.queue.onAfterRun(after)

    api.dispatchCustomEvent('promptQueueing', { requestId: 1, batchCount: 1 })
    api.dispatchCustomEvent('promptQueued', { number: 0, batchCount: 1 })
    expect(before).toHaveBeenCalledTimes(1)
    expect(after).toHaveBeenCalledTimes(1)

    stop()
    api.dispatchCustomEvent('promptQueueing', { requestId: 2, batchCount: 1 })
    expect(before).toHaveBeenCalledTimes(1)
  })
})
