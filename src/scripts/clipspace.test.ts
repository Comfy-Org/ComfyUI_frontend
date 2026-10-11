import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { NodeExecutionOutput } from '@/platform/remote/comfyui/execution/types'
import { copyToClipspace, pasteFromClipspace } from '@/scripts/clipspace'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

const outputsByNode = new Map<LGraphNode, NodeExecutionOutput>()

vi.mock(import('@/scripts/app'))

function previews(...sources: string[]) {
  return sources.map((src) => fromAny<HTMLImageElement, unknown>({ src }))
}

describe('clipspace', () => {
  beforeEach(() => {
    outputsByNode.clear()
    const store = useNodeOutputStore()
    vi.mocked(store.getNodeOutputs).mockImplementation((node) =>
      outputsByNode.get(node)
    )
    vi.mocked(store.setNodeOutputImages).mockImplementation((node, images) => {
      outputsByNode.set(node, { images })
    })
  })

  it('pastes the image the user selected when outputs contain degenerate entries', () => {
    const good = { filename: 'good.png', subfolder: '', type: 'output' }
    const source = createMockLGraphNode({
      imgs: previews('https://comfy.test/a.png', 'https://comfy.test/b.png'),
      imageIndex: 1
    })
    outputsByNode.set(
      source,
      fromAny({
        images: [
          null,
          { status: 'unavailable', reason: 'upload_failed' },
          { filename: 'stale.png', subfolder: '', type: 'output' },
          good
        ]
      })
    )
    copyToClipspace(source)

    const imageWidget = { name: 'image', type: 'combo', value: 'before.png' }
    const target = createMockLGraphNode({
      id: 2,
      imgs: [],
      widgets: [imageWidget]
    })
    pasteFromClipspace(target)

    expect(imageWidget.value).toBe('good.png [output]')
    expect(outputsByNode.get(target)?.images).toEqual([good])
    expect(target.imgs?.map((img) => img.src)).toEqual([
      'https://comfy.test/b.png'
    ])
  })

  it('skips the selected preview when the selected index has no preview', () => {
    const source = createMockLGraphNode({
      imgs: previews('https://comfy.test/a.png'),
      imageIndex: 5
    })
    copyToClipspace(source)

    const target = createMockLGraphNode({ id: 2, imgs: previews('kept') })

    expect(() => pasteFromClipspace(target)).not.toThrow()
    expect(target.imgs?.map((img) => img.src)).toEqual(['kept'])
  })
})
