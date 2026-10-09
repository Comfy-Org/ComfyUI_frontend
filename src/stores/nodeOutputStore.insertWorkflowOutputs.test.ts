import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/platform/remote/comfyui/execution/types'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { toNodeId } from '@/types/nodeId'
import { tryNormalizeNodeExecutionId } from '@/types/nodeIdentification'

vi.mock(import('@/scripts/app'))

const REMAPPED_ID = 'insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:9'

const OUTPUT: ExecutedWsMessage['output'] = {
  images: [{ filename: 'astronaut.png', subfolder: '', type: 'output' }]
}

class SaveImage extends LGraphNode {
  constructor() {
    super('SaveImage')
    this.addInput('images', 'IMAGE')
  }
}

/** One Save Image node on the root graph, under the given raw id. */
function canvasWith(rawNodeId: string) {
  const graph = new LGraph()
  const node = new SaveImage()
  node.id = toNodeId(rawNodeId)
  graph.add(node)
  Object.assign(app, {
    rootGraph: graph,
    nodeOutputs: {},
    nodePreviewImages: {}
  })
  return node
}

/** What app.ts's `executed` listener does with the frame. */
function deliverExecutedFrame(rawNodeId: string) {
  const executionId = tryNormalizeNodeExecutionId(rawNodeId)
  expect(executionId).not.toBeNull()
  useNodeOutputStore().setNodeOutputsByExecutionId(executionId!, OUTPUT)
}

describe('nodeOutputStore: outputs for insert_workflow-remapped node ids', () => {
  it('lands an executed output on a node with a plain numeric id', () => {
    const node = canvasWith('9')

    deliverExecutedFrame('9')

    expect(useNodeOutputStore().getNodeOutputs(node)).toEqual(OUTPUT)
  })

  it('regression: lands an executed output on an agent-inserted node (PM-2037)', () => {
    // Before the fix the write side (`executionIdToNodeLocatorId`) read the
    // id as a 5-segment subgraph path and resolved nothing, and the read side
    // (`nodeToNodeLocatorId`) minted null for the same id — so the run
    // produced the image, the frame named this node, and the node stayed
    // empty while the image appeared in the chat panel.
    const node = canvasWith(REMAPPED_ID)

    deliverExecutedFrame(REMAPPED_ID)

    expect(useNodeOutputStore().getNodeOutputs(node)).toEqual(OUTPUT)
  })

  it('resolves the image URL for an agent-inserted node', () => {
    const node = canvasWith(REMAPPED_ID)

    deliverExecutedFrame(REMAPPED_ID)

    const urls = useNodeOutputStore().getNodeImageUrls(node)
    expect(urls).toHaveLength(1)
    expect(urls?.[0]).toContain('astronaut.png')
  })

  it('keys two inserted nodes separately rather than collapsing them', () => {
    const graph = new LGraph()
    const first = new SaveImage()
    first.id = toNodeId(REMAPPED_ID)
    const second = new SaveImage()
    second.id = toNodeId('insert:0fbd38ecb13037d0b3b0ca78b8a20a5a:root:node:10')
    graph.add(first)
    graph.add(second)
    Object.assign(app, {
      rootGraph: graph,
      nodeOutputs: {},
      nodePreviewImages: {}
    })

    deliverExecutedFrame(String(first.id))

    const store = useNodeOutputStore()
    expect(store.getNodeOutputs(first)).toEqual(OUTPUT)
    expect(store.getNodeOutputs(second)).toBeUndefined()
  })
})
