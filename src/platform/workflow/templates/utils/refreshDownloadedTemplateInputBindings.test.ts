import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { refreshDownloadedTemplateInputBindings } from './refreshDownloadedTemplateInputBindings'

vi.mock(import('@/utils/graphTraversalUtil'), () => ({
  getNodeByExecutionId: vi.fn()
}))

const findNode = vi.mocked(getNodeByExecutionId)

describe('refreshDownloadedTemplateInputBindings', () => {
  beforeEach(() => findNode.mockReset())

  it('refreshes each matching widget once by execution ID', () => {
    const callback = vi.fn()
    const node = new LGraphNode('test')
    node.addWidget('text', 'image', 'subject.png', callback)
    findNode.mockReturnValue(node)
    const candidate = fromPartial<MissingMediaCandidate>({
      nodeId: '1:2',
      widgetName: 'image',
      name: 'subject.png'
    })

    refreshDownloadedTemplateInputBindings(
      new LGraph(),
      [candidate, candidate],
      new Set(['subject.png'])
    )

    expect(findNode).toHaveBeenCalledWith(expect.anything(), '1:2')
    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('subject.png', undefined, node)
  })

  it('ignores unmatched filenames and widget values', () => {
    const callback = vi.fn()
    const node = new LGraphNode('test')
    node.addWidget('text', 'image', 'other.png', callback)
    findNode.mockReturnValue(node)

    refreshDownloadedTemplateInputBindings(
      new LGraph(),
      [
        fromPartial<MissingMediaCandidate>({
          nodeId: '1',
          widgetName: 'image',
          name: 'subject.png'
        })
      ],
      new Set(['subject.png'])
    )

    expect(callback).not.toHaveBeenCalled()
  })
})
