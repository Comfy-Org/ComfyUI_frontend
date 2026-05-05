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
  return { _nodes: nodes } as unknown as LGraph
}

describe('FE-230 markDeletedAssetsAsMissingMedia', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockScanNodeMediaCandidates.mockReset()
  })

  it('adds missing-media candidates only for widgets whose value matches a deleted filename', () => {
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

    markDeletedAssetsAsMissingMedia(makeGraph([node]), new Set(['foo.png']))

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

  it('is a no-op when no nodes reference any deleted filename', () => {
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

  it('does nothing when the deleted filename set is empty', () => {
    markDeletedAssetsAsMissingMedia(makeGraph([]), new Set())
    const store = useMissingMediaStore()
    expect(store.missingMediaCandidates).toBeNull()
  })
})
