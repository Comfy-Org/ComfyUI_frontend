import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createNodeExecutionId } from '@/types/nodeIdentification'

describe('execution output projection', () => {
  let originalRootGraph: unknown
  let originalNodeOutputs: typeof app.nodeOutputs

  beforeEach(() => {
    originalRootGraph = Reflect.get(app, 'rootGraphInternal')
    originalNodeOutputs = { ...app.nodeOutputs }
  })

  afterEach(() => {
    Reflect.set(app, 'rootGraphInternal', originalRootGraph)
    app.nodeOutputs = originalNodeOutputs
  })

  it('projects canonical output state to node preview URLs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Preview Image')
    graph.add(node)

    Reflect.set(app, 'rootGraphInternal', graph)
    app.nodeOutputs = {}

    const output: ExecutedWsMessage['output'] = {
      images: [
        {
          filename: 'execution-result.png',
          subfolder: 'daily outputs',
          type: 'output'
        }
      ]
    }

    const store = useNodeOutputStore()
    const executionId = createNodeExecutionId([node.id])
    store.setNodeOutputsByExecutionId(executionId, output)

    expect(store.nodeOutputs[String(node.id)]).toEqual(output)
    expect(app.nodeOutputs[String(node.id)]).toEqual(output)

    const [previewUrl] =
      store.getNodeImageUrlsByExecutionId(executionId, node) ?? []
    const parsedPreviewUrl = new URL(previewUrl, window.location.origin)
    expect(parsedPreviewUrl.pathname).toBe('/api/view')
    expect(parsedPreviewUrl.searchParams.get('filename')).toBe(
      'execution-result.png'
    )
    expect(parsedPreviewUrl.searchParams.get('subfolder')).toBe('daily outputs')
    expect(parsedPreviewUrl.searchParams.get('type')).toBe('output')
  })
})
