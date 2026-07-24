import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { useMissingMediaStore } from '@/platform/missingMedia/missingMediaStore'

import { markDeletedAssetsAsMissingMedia } from './markDeletedAssetsAsMissingMedia'

vi.mock('@/platform/distribution/types', () => ({
  isCloud: true
}))

const mockScanNodeMediaCandidates = vi.hoisted(() => vi.fn())
vi.mock('@/platform/missingMedia/missingMediaScan', () => ({
  scanNodeMediaCandidates: mockScanNodeMediaCandidates
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ currentGraph: null })
}))

function makeGraph(nodes: unknown[]): LGraph {
  return { nodes } as unknown as LGraph
}

describe('FE-230 markDeletedAssetsAsMissingMedia', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockScanNodeMediaCandidates.mockReset()
    mockScanNodeMediaCandidates.mockReturnValue([])
  })

  it('adds missing-media candidates only for widgets whose value is in the deleted set', () => {
    const node = {
      id: 1,
      type: 'LoadImage',
      widgets: [
        { name: 'image', value: 'sub/foo.png [output]' },
        { name: 'mask', value: 'unrelated.png' }
      ]
    }
    mockScanNodeMediaCandidates.mockReturnValue([
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'sub/foo.png [output]'
      },
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'mask',
        mediaType: 'image',
        name: 'unrelated.png'
      }
    ])

    markDeletedAssetsAsMissingMedia(
      makeGraph([node]),
      new Set(['sub/foo.png [output]'])
    )

    const store = useMissingMediaStore()
    expect(store.missingMediaCandidates).toEqual([
      {
        nodeId: '1',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'sub/foo.png [output]',
        isMissing: true
      }
    ])
  })

  it('does not cross-match basenames across input/output sources', () => {
    const inputNode = {
      id: 2,
      type: 'LoadImage',
      widgets: [{ name: 'image', value: 'foo.png' }]
    }
    const outputNode = {
      id: 3,
      type: 'LoadImage',
      widgets: [{ name: 'image', value: 'foo.png [output]' }]
    }

    markDeletedAssetsAsMissingMedia(
      makeGraph([inputNode, outputNode]),
      new Set(['foo.png'])
    )

    expect(mockScanNodeMediaCandidates).toHaveBeenCalledTimes(1)
    expect(mockScanNodeMediaCandidates).toHaveBeenCalledWith(
      expect.anything(),
      inputNode,
      true
    )
  })

  it('skips nodes with NEVER or BYPASS mode', () => {
    const bypassed = {
      id: 4,
      type: 'LoadImage',
      mode: 4,
      widgets: [{ name: 'image', value: 'foo.png [output]' }]
    }
    const never = {
      id: 5,
      type: 'LoadImage',
      mode: 2,
      widgets: [{ name: 'image', value: 'foo.png [output]' }]
    }

    markDeletedAssetsAsMissingMedia(
      makeGraph([bypassed, never]),
      new Set(['foo.png [output]'])
    )

    expect(mockScanNodeMediaCandidates).not.toHaveBeenCalled()
    const store = useMissingMediaStore()
    expect(store.missingMediaCandidates).toBeNull()
  })

  it('walks subgraph interiors and marks nested nodes', () => {
    const inner = {
      id: 100,
      type: 'LoadImage',
      widgets: [{ name: 'image', value: 'nested.png [output]' }]
    }
    const wrapper = {
      id: 50,
      widgets: [],
      isSubgraphNode: () => true,
      subgraph: { nodes: [inner] }
    }
    mockScanNodeMediaCandidates.mockReturnValue([
      {
        nodeId: '50:100',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'nested.png [output]'
      }
    ])

    markDeletedAssetsAsMissingMedia(
      makeGraph([wrapper]),
      new Set(['nested.png [output]'])
    )

    const store = useMissingMediaStore()
    expect(store.missingMediaCandidates).toEqual([
      {
        nodeId: '50:100',
        nodeType: 'LoadImage',
        widgetName: 'image',
        mediaType: 'image',
        name: 'nested.png [output]',
        isMissing: true
      }
    ])
  })

  it('is a no-op when no nodes reference any deleted value', () => {
    const node = {
      id: 2,
      type: 'LoadImage',
      widgets: [{ name: 'image', value: 'kept.png' }]
    }

    markDeletedAssetsAsMissingMedia(makeGraph([node]), new Set(['gone.png']))

    expect(mockScanNodeMediaCandidates).not.toHaveBeenCalled()
    const store = useMissingMediaStore()
    expect(store.missingMediaCandidates).toBeNull()
  })

  it('does nothing when the deleted value set is empty', () => {
    markDeletedAssetsAsMissingMedia(makeGraph([]), new Set())
    const store = useMissingMediaStore()
    expect(store.missingMediaCandidates).toBeNull()
  })
})
