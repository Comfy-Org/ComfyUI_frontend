import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { toNodeId } from '@/types/nodeId'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import { refreshDownloadedTemplateInputBindings } from './refreshDownloadedTemplateInputBindings'

function graphWith(node: LGraphNode, id: number): LGraph {
  const graph = new LGraph()
  node.id = toNodeId(id)
  graph.add(node)
  return graph
}

describe('refreshDownloadedTemplateInputBindings', () => {
  it('refreshes each matching widget once, found by execution ID', () => {
    const callback = vi.fn()
    const node = new LGraphNode('test')
    node.addWidget('text', 'image', 'subject.png', callback)
    const candidate = fromPartial<MissingMediaCandidate>({
      nodeId: '7',
      widgetName: 'image',
      name: 'subject.png'
    })

    refreshDownloadedTemplateInputBindings(
      graphWith(node, 7),
      [candidate, candidate],
      new Set(['subject.png'])
    )

    expect(callback).toHaveBeenCalledOnce()
    expect(callback).toHaveBeenCalledWith('subject.png', undefined, node)
  })

  it('refreshes nothing when the execution ID is not in the graph', () => {
    const callback = vi.fn()
    const node = new LGraphNode('test')
    node.addWidget('text', 'image', 'subject.png', callback)

    refreshDownloadedTemplateInputBindings(
      graphWith(node, 7),
      [
        fromPartial<MissingMediaCandidate>({
          nodeId: '99',
          widgetName: 'image',
          name: 'subject.png'
        })
      ],
      new Set(['subject.png'])
    )

    expect(callback).not.toHaveBeenCalled()
  })

  it('ignores unmatched filenames and widget values', () => {
    const callback = vi.fn()
    const node = new LGraphNode('test')
    node.addWidget('text', 'image', 'other.png', callback)

    refreshDownloadedTemplateInputBindings(
      graphWith(node, 1),
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
