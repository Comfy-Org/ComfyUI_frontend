import { describe, expect, it, vi } from 'vitest'

import type { LGraph } from '@/lib/litegraph/src/litegraph'

import { clearDeletedAssetWidgetValues } from './clearDeletedAssetWidgetValues'

type MockWidget = { name: string; value: unknown }
type MockNode = {
  id: number
  widgets?: MockWidget[]
  widgets_values?: unknown[]
  graph?: { setDirtyCanvas: (v: boolean) => void }
  isSubgraphNode?: () => boolean
  subgraph?: { nodes: MockNode[] }
}

function makeGraph(nodes: MockNode[]): LGraph {
  return { nodes } as unknown as LGraph
}

describe('FE-230 clearDeletedAssetWidgetValues', () => {
  it('clears widget.value AND widgets_values for matching widgets so workflow JSON serializes the cleared state', () => {
    const setDirty = vi.fn()
    const node: MockNode = {
      id: 1,
      widgets: [{ name: 'image', value: 'outputs/foo.png [output]' }],
      widgets_values: ['outputs/foo.png [output]'],
      graph: { setDirtyCanvas: setDirty }
    }

    clearDeletedAssetWidgetValues(
      makeGraph([node]),
      new Set(['outputs/foo.png [output]'])
    )

    expect(node.widgets![0].value).toBe('')
    expect(node.widgets_values![0]).toBe('')
    expect(setDirty).toHaveBeenCalledWith(true)
  })

  it('leaves untouched widgets that do not match deleted values', () => {
    const node: MockNode = {
      id: 2,
      widgets: [
        { name: 'image', value: 'outputs/foo.png [output]' },
        { name: 'mask', value: 'inputs/keep.png' }
      ],
      widgets_values: ['outputs/foo.png [output]', 'inputs/keep.png'],
      graph: { setDirtyCanvas: vi.fn() }
    }

    clearDeletedAssetWidgetValues(
      makeGraph([node]),
      new Set(['outputs/foo.png [output]'])
    )

    expect(node.widgets![0].value).toBe('')
    expect(node.widgets![1].value).toBe('inputs/keep.png')
    expect(node.widgets_values![0]).toBe('')
    expect(node.widgets_values![1]).toBe('inputs/keep.png')
  })

  it('leaves nodes alone when none of their widgets reference a deleted value (mask-editor case)', () => {
    const setDirty = vi.fn()
    const node: MockNode = {
      id: 3,
      widgets: [
        {
          name: 'image',
          value: 'clipspace/clipspace-painted-masked-1.png [input]'
        }
      ],
      widgets_values: ['clipspace/clipspace-painted-masked-1.png [input]'],
      graph: { setDirtyCanvas: setDirty }
    }

    clearDeletedAssetWidgetValues(
      makeGraph([node]),
      new Set(['outputs/some-other-asset.png [output]'])
    )

    expect(node.widgets![0].value).toBe(
      'clipspace/clipspace-painted-masked-1.png [input]'
    )
    expect(node.widgets_values![0]).toBe(
      'clipspace/clipspace-painted-masked-1.png [input]'
    )
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('no-ops when the deleted-values set is empty', () => {
    const setDirty = vi.fn()
    const node: MockNode = {
      id: 4,
      widgets: [{ name: 'image', value: 'outputs/foo.png [output]' }],
      widgets_values: ['outputs/foo.png [output]'],
      graph: { setDirtyCanvas: setDirty }
    }

    clearDeletedAssetWidgetValues(makeGraph([node]), new Set())

    expect(node.widgets![0].value).toBe('outputs/foo.png [output]')
    expect(node.widgets_values![0]).toBe('outputs/foo.png [output]')
    expect(setDirty).not.toHaveBeenCalled()
  })

  it('handles missing widgets_values (legacy nodes) without throwing', () => {
    const node: MockNode = {
      id: 5,
      widgets: [{ name: 'image', value: 'outputs/foo.png [output]' }],
      graph: { setDirtyCanvas: vi.fn() }
    }

    expect(() =>
      clearDeletedAssetWidgetValues(
        makeGraph([node]),
        new Set(['outputs/foo.png [output]'])
      )
    ).not.toThrow()

    expect(node.widgets![0].value).toBe('')
  })

  it('clears all matching widgets across multiple nodes', () => {
    const nodeA: MockNode = {
      id: 6,
      widgets: [{ name: 'image', value: 'outputs/a.png [output]' }],
      widgets_values: ['outputs/a.png [output]'],
      graph: { setDirtyCanvas: vi.fn() }
    }
    const nodeB: MockNode = {
      id: 7,
      widgets: [{ name: 'image', value: 'outputs/a.png [output]' }],
      widgets_values: ['outputs/a.png [output]'],
      graph: { setDirtyCanvas: vi.fn() }
    }

    clearDeletedAssetWidgetValues(
      makeGraph([nodeA, nodeB]),
      new Set(['outputs/a.png [output]'])
    )

    expect(nodeA.widgets![0].value).toBe('')
    expect(nodeB.widgets![0].value).toBe('')
  })

  it('does not affect nodes without widgets', () => {
    const node: MockNode = {
      id: 8,
      graph: { setDirtyCanvas: vi.fn() }
    }

    expect(() =>
      clearDeletedAssetWidgetValues(
        makeGraph([node]),
        new Set(['outputs/foo.png [output]'])
      )
    ).not.toThrow()
  })
})
