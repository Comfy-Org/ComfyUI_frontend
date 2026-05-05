import { describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { clearNodePreviewCacheForFilenames } from './clearNodePreviewCacheForFilenames'

type MockWidget = { name: string; value: unknown }
type MockNode = {
  id: number
  widgets?: MockWidget[]
  imgs?: unknown
  videoContainer?: unknown
  graph?: { setDirtyCanvas: (v: boolean) => void }
}

function makeGraph(nodes: MockNode[]): LGraph {
  return { _nodes: nodes } as unknown as LGraph
}

describe('FE-230 clearNodePreviewCacheForFilenames', () => {
  it('clears node.imgs and removes outputs when a widget value matches a deleted filename', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 7,
      widgets: [{ name: 'image', value: 'foo.png' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
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

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toEqual([{ src: 'blob:keep' }])
    expect(remove).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('no-ops when the deleted filename set is empty', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 9,
      widgets: [{ name: 'image', value: 'foo.png' }],
      imgs: [{ src: 'blob:keep' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toEqual([{ src: 'blob:keep' }])
    expect(remove).not.toHaveBeenCalled()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('matches when widget value has a subfolder prefix', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 11,
      widgets: [{ name: 'image', value: 'sub/foo.png' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
    expect(setDirty).toHaveBeenCalledWith(true)
  })

  it('matches when widget value has an [output] annotation suffix', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 12,
      widgets: [{ name: 'image', value: 'foo.png [output]' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
    expect(setDirty).toHaveBeenCalledWith(true)
  })

  it('matches when widget value has both subfolder prefix and annotation suffix', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 13,
      widgets: [{ name: 'image', value: 'sub/foo.png [output]' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
    expect(setDirty).toHaveBeenCalledWith(true)
  })

  it('matches when widget value is a ResultItem-shaped object', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 14,
      widgets: [
        {
          name: 'image',
          value: { filename: 'foo.png', subfolder: 'sub', type: 'output' }
        }
      ],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(['foo.png']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
    expect(setDirty).toHaveBeenCalledWith(true)
  })

  it('also clears videoContainer for video previews', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 15,
      widgets: [{ name: 'video', value: 'clip.mp4' }],
      videoContainer: { foo: 'bar' },
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(['clip.mp4']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.videoContainer).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
  })

  it('matches any widget on the node, not just "image"', () => {
    const setDirty = vi.fn()
    const remove = vi.fn()
    const node: MockNode = {
      id: 10,
      widgets: [
        { name: 'seed', value: 42 },
        { name: 'video', value: 'clip.mp4' }
      ],
      imgs: [{ src: 'blob:videostale' }],
      graph: { setDirtyCanvas: setDirty }
    }

    clearNodePreviewCacheForFilenames(
      makeGraph([node]),
      new Set(['clip.mp4']),
      remove as unknown as (node: LGraphNode) => void
    )

    expect(node.imgs).toBeUndefined()
    expect(remove).toHaveBeenCalledWith(node)
    expect(setDirty).toHaveBeenCalledWith(true)
  })
})
