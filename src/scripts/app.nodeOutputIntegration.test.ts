import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'

describe('execution output projection', () => {
  it('projects an executed event through canonical state to node preview URLs', () => {
    const graph = new LGraph()
    const node = new LGraphNode('Preview Image')
    const onExecuted = vi.fn()
    node.onExecuted = onExecuted
    graph.add(node)

    Reflect.set(app, 'rootGraphInternal', graph)
    app.vueAppReady = false
    app.nodeOutputs = {}
    const appWithApiHandlers = app as unknown as {
      addApiUpdateHandlers: () => void
    }
    vi.spyOn(api, 'init').mockImplementation(() => {})
    appWithApiHandlers.addApiUpdateHandlers()

    const output: ExecutedWsMessage['output'] = {
      images: [
        {
          filename: 'execution-result.png',
          subfolder: 'daily outputs',
          type: 'output'
        }
      ]
    }

    api.dispatchCustomEvent('executed', {
      node: node.id,
      display_node: node.id,
      prompt_id: 'test-prompt',
      output
    })

    const store = useNodeOutputStore()
    expect(store.nodeOutputs[String(node.id)]).toEqual(output)
    expect(app.nodeOutputs[String(node.id)]).toEqual(output)
    expect(onExecuted).toHaveBeenCalledWith(output)

    const [previewUrl] = store.getNodeImageUrls(node) ?? []
    const parsedPreviewUrl = new URL(previewUrl, window.location.origin)
    expect(parsedPreviewUrl.pathname).toBe('/api/view')
    expect(parsedPreviewUrl.searchParams.get('filename')).toBe(
      'execution-result.png'
    )
    expect(parsedPreviewUrl.searchParams.get('subfolder')).toBe('daily outputs')
    expect(parsedPreviewUrl.searchParams.get('type')).toBe('output')
  })
})
