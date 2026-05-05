import { describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  clearNodePreviewCacheForValues,
  findNodesReferencingValues
} from './clearNodePreviewCacheForFilenames'

type MockWidget = { name: string; value: unknown }
type MockNode = {
  id: number
  widgets?: MockWidget[]
  imgs?: unknown
  videoContainer?: unknown
  graph?: { setDirtyCanvas: (v: boolean) => void }
  isSubgraphNode?: () => boolean
  subgraph?: { nodes: MockNode[] }
}

function makeGraph(nodes: MockNode[]): LGraph {
  return { nodes } as unknown as LGraph
}

describe('FE-230 clearNodePreviewCacheForValues', () => {
  it('clears node.imgs and removes outputs when a widget value matches a deleted value', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 7,
      widgets: [{ name: 'image', value: 'foo.png' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForValues(
      makeGraph([node]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
    expect(setDirty).toHaveBeenCalledWith(true)
  })

  it('leaves unrelated nodes untouched', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 8,
      widgets: [{ name: 'image', value: 'unrelated.png' }],
      imgs: [{ src: 'blob:keep' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForValues(
      makeGraph([node]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toEqual([{ src: 'blob:keep' }])
    expect(remove).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('no-ops when the deleted value set is empty', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 9,
      widgets: [{ name: 'image', value: 'foo.png' }],
      imgs: [{ src: 'blob:keep' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForValues(
      makeGraph([node]),
      new Set(),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toEqual([{ src: 'blob:keep' }])
    expect(remove).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('matches the [output]-annotated form for output assets', () => {
    const remove = vi.fn()
    const node: MockNode = {
      id: 12,
      widgets: [{ name: 'image', value: 'foo.png [output]' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: vi.fn() }
    }

    clearNodePreviewCacheForValues(
      makeGraph([node]),
      new Set(['foo.png [output]']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
  })

  it('matches the subfolder-prefixed annotated form when provided', () => {
    const remove = vi.fn()
    const node: MockNode = {
      id: 13,
      widgets: [{ name: 'image', value: 'sub/foo.png [output]' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: vi.fn() }
    }

    clearNodePreviewCacheForValues(
      makeGraph([node]),
      new Set(['sub/foo.png [output]']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
  })

  it('does not cross-match basenames across input/output sources', () => {
    const remove = vi.fn()
    const inputNode: MockNode = {
      id: 1,
      widgets: [{ name: 'image', value: 'foo.png' }],
      imgs: [{ src: 'blob:input' }],
      graph: { setDirtyCanvas: vi.fn() }
    }
    const outputNode: MockNode = {
      id: 2,
      widgets: [{ name: 'image', value: 'foo.png [output]' }],
      imgs: [{ src: 'blob:output' }],
      graph: { setDirtyCanvas: vi.fn() }
    }

    clearNodePreviewCacheForValues(
      makeGraph([inputNode, outputNode]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(inputNode.imgs).toBeUndefined()
    expect(outputNode.imgs).toEqual([{ src: 'blob:output' }])
    expect(remove).toHaveBeenCalledWith(inputNode)
    expect(remove).not.toHaveBeenCalledWith(outputNode)
  })

  it('also clears videoContainer for video previews', () => {
    const remove = vi.fn()
    const node: MockNode = {
      id: 15,
      widgets: [{ name: 'video', value: 'clip.mp4' }],
      videoContainer: { foo: 'bar' },
      graph: { setDirtyCanvas: vi.fn() }
    }

    clearNodePreviewCacheForValues(
      makeGraph([node]),
      new Set(['clip.mp4']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.videoContainer).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
  })

  it('matches any widget on the node, not just "image"', () => {
    const remove = vi.fn()
    const node: MockNode = {
      id: 10,
      widgets: [
        { name: 'seed', value: 42 },
        { name: 'video', value: 'clip.mp4' }
      ],
      imgs: [{ src: 'blob:videostale' }],
      graph: { setDirtyCanvas: vi.fn() }
    }

    clearNodePreviewCacheForValues(
      makeGraph([node]),
      new Set(['clip.mp4']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
  })

  it('walks subgraph interiors and matches nested nodes', () => {
    const inner: MockNode = {
      id: 100,
      widgets: [{ name: 'image', value: 'nested.png [output]' }],
      imgs: [{ src: 'blob:nested' }],
      graph: { setDirtyCanvas: vi.fn() }
    }
    const wrapper: MockNode = {
      id: 50,
      widgets: [],
      isSubgraphNode: () => true,
      subgraph: { nodes: [inner] }
    }
    const remove = vi.fn()

    clearNodePreviewCacheForValues(
      makeGraph([wrapper]),
      new Set(['nested.png [output]']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(inner.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(inner)
  })
})

describe('FE-230 findNodesReferencingValues', () => {
  it('skips subgraph wrapper nodes (only their interior nodes match)', () => {
    const inner: MockNode = {
      id: 100,
      widgets: [{ name: 'image', value: 'foo.png' }]
    }
    const wrapper: MockNode = {
      id: 50,
      widgets: [{ name: 'image', value: 'foo.png' }],
      isSubgraphNode: () => true,
      subgraph: { nodes: [inner] }
    }

    const matches = findNodesReferencingValues(
      makeGraph([wrapper]),
      new Set(['foo.png'])
    )

    expect(matches).toEqual([inner])
  })
})
