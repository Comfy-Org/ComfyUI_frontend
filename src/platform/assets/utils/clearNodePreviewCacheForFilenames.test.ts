import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { clearNodePreviewCacheForFilenames } from './clearNodePreviewCacheForFilenames'

vi.mock('@/scripts/app', () => ({
  app: { nodeOutputs: {} as Record<string, unknown> }
}))

import { app } from '@/scripts/app'

type MockWidget = { name: string; value: unknown }
type MockNode = {
  id: number
  widgets?: MockWidget[]
  imgs?: unknown
  graph?: { setDirtyCanvas: (v: boolean) => void }
}

function makeGraph(nodes: MockNode[]): LGraph {
  return { _nodes: nodes } as unknown as LGraph
}

const locatorForMockNode = (node: LGraphNode): string | null =>
  String((node as unknown as MockNode).id)

describe('FE-230 clearNodePreviewCacheForFilenames', () => {
  beforeEach(() => {
    for (const key of Object.keys(app.nodeOutputs)) {
      delete app.nodeOutputs[key]
    }
  })

  it('clears node.imgs and app.nodeOutputs when a widget value matches a deleted filename', () => {
    const setDirty = vi.fn()
    const node: MockNode = {
      id: 7,
      widgets: [{ name: 'image', value: 'foo.png' }],
      imgs: [{ src: 'blob:stale' }],
      graph: { setDirtyCanvas: setDirty }
    }
    const graph = makeGraph([node])
    app.nodeOutputs['7'] = {
      images: [{ type: 'input', filename: 'foo.png' }]
    }

    clearNodePreviewCacheForFilenames(
      graph,
      new Set(['foo.png']),
      locatorForMockNode
    )

    expect(node.imgs).toBeUndefined()
    expect(app.nodeOutputs['7']).toBeUndefined()
    expect(setDirty).toHaveBeenCalledWith(true)
  })

  it('leaves unrelated nodes untouched', () => {
    const setDirty = vi.fn()
    const node: MockNode = {
      id: 8,
      widgets: [{ name: 'image', value: 'unrelated.png' }],
      imgs: [{ src: 'blob:keep' }],
      graph: { setDirtyCanvas: setDirty }
    }
    const graph = makeGraph([node])
    app.nodeOutputs['8'] = {
      images: [{ type: 'input', filename: 'unrelated.png' }]
    }

    clearNodePreviewCacheForFilenames(
      graph,
      new Set(['foo.png']),
      locatorForMockNode
    )

    expect(node.imgs).toEqual([{ src: 'blob:keep' }])
    expect(app.nodeOutputs['8']).toBeDefined()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('no-ops when the deleted filename set is empty', () => {
    const setDirty = vi.fn()
    const node: MockNode = {
      id: 9,
      widgets: [{ name: 'image', value: 'foo.png' }],
      imgs: [{ src: 'blob:keep' }],
      graph: { setDirtyCanvas: setDirty }
    }
    const graph = makeGraph([node])
    app.nodeOutputs['9'] = {
      images: [{ type: 'input', filename: 'foo.png' }]
    }

    clearNodePreviewCacheForFilenames(graph, new Set(), locatorForMockNode)

    expect(node.imgs).toEqual([{ src: 'blob:keep' }])
    expect(app.nodeOutputs['9']).toBeDefined()
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('matches any widget on the node, not just "image"', () => {
    const setDirty = vi.fn()
    const node: MockNode = {
      id: 10,
      widgets: [
        { name: 'seed', value: 42 },
        { name: 'video', value: 'clip.mp4' }
      ],
      imgs: [{ src: 'blob:videostale' }],
      graph: { setDirtyCanvas: setDirty }
    }
    const graph = makeGraph([node])
    app.nodeOutputs['10'] = {
      images: [{ type: 'input', filename: 'clip.mp4' }]
    }

    clearNodePreviewCacheForFilenames(
      graph,
      new Set(['clip.mp4']),
      locatorForMockNode
    )

    expect(node.imgs).toBeUndefined()
    expect(app.nodeOutputs['10']).toBeUndefined()
    expect(setDirty).toHaveBeenCalledWith(true)
  })
})
