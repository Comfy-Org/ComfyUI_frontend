import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { toNodeId } from '@/types/nodeId'

import {
  parseSegmentPreviews,
  segmentPreviewUrl
} from './concatSegmentPreviews'

vi.mock(import('@/scripts/api'))

const node = new LGraphNode('CreateVideo')
node.id = toNodeId(12)

const previews = parseSegmentPreviews([
  {
    name: 'video0',
    filename: 'segment.mp4',
    subfolder: '',
    type: 'temp',
    source: ['12', 0]
  },
  {
    name: 'video1',
    filename: 'nested.mp4',
    subfolder: 'clips',
    type: 'temp',
    source: ['5:12', 1]
  }
])

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

  it('finds the preview recorded for the source node and output slot', () => {
    expect(segmentPreviewUrl(previews, { node, slot: 0 })).toBe(
      '/api/view?filename=segment.mp4&subfolder=&type=temp'
    )
  })

  it('matches a source inside a subgraph by its local node id', () => {
    expect(segmentPreviewUrl(previews, { node, slot: 1 })).toBe(
      '/api/view?filename=nested.mp4&subfolder=clips&type=temp'
    )
  })

  it.for([
    { label: 'another node', source: { node: new LGraphNode('Other') } },
    { label: 'another output slot', source: { node, slot: 3 } },
    { label: 'no source', source: undefined }
  ])('finds nothing for $label', ({ source }) => {
    expect(segmentPreviewUrl(previews, source)).toBeUndefined()
  })
})
