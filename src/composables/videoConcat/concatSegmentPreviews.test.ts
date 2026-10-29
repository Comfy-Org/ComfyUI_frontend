import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@comfyorg/litegraph/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@comfyorg/litegraph/subgraph/__fixtures__/subgraphHelpers'
import { api } from '@/scripts/api'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  parseSegmentPreviews,
  segmentPreviewUrl
} from './concatSegmentPreviews'

vi.mock(import('@/scripts/api'))

function rootNode(id: string) {
  const graph = new LGraph()
  const node = new LGraphNode('CreateVideo')
  node.id = toNodeId(id)
  graph.add(node)
  return node
}

function nodeInSubgraph() {
  const subgraph = createTestSubgraph()
  const { rootGraph } = subgraph
  rootGraph.subgraphs.set(subgraph.id, subgraph)
  const host = createTestSubgraphNode(subgraph)
  rootGraph.add(host)
  const inner = new LGraphNode('CreateVideo')
  subgraph.add(inner)
  return { host, inner }
}

function preview(filename: string, source: [string, number]) {
  return { name: 'video0', filename, subfolder: '', type: 'temp', source }
}

function viewUrl(filename: string) {
  return `/api/view?filename=${filename}&subfolder=&type=temp`
}

describe('parseSegmentPreviews', () => {
  it.for([
    { value: undefined },
    { value: 'segments' },
    { value: [{ filename: 'a.mp4', type: 'somewhere' }] }
  ])('ignores malformed output $value', ({ value }) => {
    expect(parseSegmentPreviews(value)).toEqual([])
  })
})

describe('segmentPreviewUrl', () => {
  beforeEach(() => {
    vi.mocked(api.apiURL).mockImplementation((path) => `/api${path}`)
  })

  it('finds the preview recorded for a root node and output slot', () => {
    const node = rootNode('12')
    const previews = parseSegmentPreviews([
      preview('nested.mp4', ['5:12', 0]),
      preview('root.mp4', ['12', 0])
    ])

    expect(segmentPreviewUrl(previews, { node, slot: 0 })).toBe(
      viewUrl('root.mp4')
    )
  })

  it('keeps a remapped root id that contains colons whole', () => {
    const node = rootNode('insert:review:root:node:10')
    const previews = parseSegmentPreviews([
      preview('remapped.mp4', ['insert:review:root:node:10', 0])
    ])

    expect(segmentPreviewUrl(previews, { node, slot: 0 })).toBe(
      viewUrl('remapped.mp4')
    )
  })

  it('matches a node inside a subgraph by its full execution path', () => {
    const { host, inner } = nodeInSubgraph()
    const previews = parseSegmentPreviews([
      preview('root.mp4', [String(inner.id), 0]),
      preview('nested.mp4', [`${host.id}:${inner.id}`, 0])
    ])

    expect(segmentPreviewUrl(previews, { node: inner, slot: 0 })).toBe(
      viewUrl('nested.mp4')
    )
  })

  it.for([
    { label: 'another output slot', slot: 3 },
    { label: 'no recorded preview', slot: 0, previews: [] }
  ])(
    'finds nothing for $label',
    ({ slot, previews = [preview('a.mp4', ['12', 0])] }) => {
      expect(
        segmentPreviewUrl(parseSegmentPreviews(previews), {
          node: rootNode('12'),
          slot
        })
      ).toBeUndefined()
    }
  )

  it('finds nothing without a source', () => {
    expect(
      segmentPreviewUrl(
        parseSegmentPreviews([preview('a.mp4', ['12', 0])]),
        undefined
      )
    ).toBeUndefined()
  })
})
