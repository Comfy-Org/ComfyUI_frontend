import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { ExecutedWsMessage } from '@/schemas/apiSchema'
import { app } from '@/scripts/app'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { toNodeId } from '@/types/nodeId'
import { createNodeExecutionId } from '@/types/nodeIdentification'

const mockGetNodeById = vi.fn()

vi.mock<unknown>(import('@/utils/litegraphUtil'), () => ({
  isAnimatedOutput: vi.fn(() => false),
  isVideoNode: vi.fn(() => false),
  resolveNode: vi.fn()
}))

vi.mock<unknown>(import('@/scripts/app'), () => ({
  app: {
    getPreviewFormatParam: vi.fn(() => ''),
    getRandParam: vi.fn(() => ''),
    rootGraph: {
      getNodeById: (...args: unknown[]) => mockGetNodeById(...args)
    },
    nodeOutputs: {} as Record<string, unknown>,
    nodePreviewImages: {} as Record<string, string[]>
  }
}))

vi.mock<unknown>(import('@/utils/graphTraversalUtil'), () => ({
  executionIdToNodeLocatorId: vi.fn((_rootGraph: unknown, id: string) => id)
}))

function createMockNode(id: number): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: toNodeId(id),
    type: 'PreviewImage'
  })
}

describe('useNodeOutputStore output projection', () => {
  beforeEach(() => {
    app.nodeOutputs = {}
    app.nodePreviewImages = {}
  })

  it('projects an executed output into the store, app.nodeOutputs and view URLs', () => {
    const store = useNodeOutputStore()
    const node = createMockNode(1)
    mockGetNodeById.mockReturnValue(node)
    const executionId = createNodeExecutionId([node.id])
    const output: ExecutedWsMessage['output'] = {
      images: [
        {
          filename: 'execution-result.png',
          subfolder: 'daily outputs',
          type: 'output'
        }
      ]
    }

    store.setNodeOutputsByExecutionId(executionId, output)

    expect(store.nodeOutputs[String(node.id)]).toEqual(output)
    expect(app.nodeOutputs[String(node.id)]).toEqual(output)

    const urls = store.getNodeImageUrlsByExecutionId(executionId, node)
    expect(urls).toHaveLength(1)

    const previewUrl = new URL(urls![0], window.location.origin)
    expect(previewUrl.pathname).toBe('/api/view')
    expect(previewUrl.searchParams.get('filename')).toBe('execution-result.png')
    expect(previewUrl.searchParams.get('subfolder')).toBe('daily outputs')
    expect(previewUrl.searchParams.get('type')).toBe('output')
  })
})
