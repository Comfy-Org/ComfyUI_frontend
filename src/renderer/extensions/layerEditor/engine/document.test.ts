import { describe, expect, it } from 'vitest'

import type { Document } from './document'
import {
  allContentRefs,
  filterTopmost,
  findNode,
  flattenTree,
  parentOf,
  walk
} from './document'
import { groupKind } from './kinds/group'
import { rasterKind } from './kinds/raster'
import type { GroupData, RasterData } from './node'

function tree(): {
  root: GroupData
  inner: GroupData
  a: ReturnType<typeof rasterKind.create>
  b: ReturnType<typeof rasterKind.create>
  c: ReturnType<typeof rasterKind.create>
} {
  const a = rasterKind.create({ id: 'a', contentId: 'ca' })
  const b = rasterKind.create({ id: 'b', contentId: 'cb' })
  const c = rasterKind.create({ id: 'c', contentId: 'cc' })
  const inner = groupKind.create({ id: 'inner', children: [b, c] })
  const root = groupKind.create({ id: 'root', children: [a, inner] })
  return { root, inner, a, b, c }
}

describe('walk', () => {
  it('visits every node depth-first with its parent and depth', () => {
    const { root } = tree()
    const seen: Array<[string, string, number]> = []
    walk(root, (node, parent, depth) => {
      seen.push([node.id, parent.id, depth])
    })
    expect(seen).toEqual([
      ['a', 'root', 0],
      ['inner', 'root', 0],
      ['b', 'inner', 1],
      ['c', 'inner', 1]
    ])
  })

  it('returning false skips descent into that subtree', () => {
    const { root } = tree()
    const seen: string[] = []
    walk(root, (node) => {
      seen.push(node.id)
      if (node.id === 'inner') return false
    })
    expect(seen).toEqual(['a', 'inner'])
  })
})

describe('findNode / parentOf', () => {
  it('locates a nested node with parent and index', () => {
    const { root, inner, c } = tree()
    const loc = findNode(root, 'c')
    expect(loc?.node).toBe(c)
    expect(loc?.parent).toBe(inner)
    expect(loc?.index).toBe(1)
  })

  it('returns null / null for unknown ids', () => {
    const { root } = tree()
    expect(findNode(root, 'nope')).toBeNull()
    expect(parentOf(root, 'nope')).toBeNull()
  })

  it('parentOf resolves the containing group', () => {
    const { root, inner } = tree()
    expect(parentOf(root, 'b')).toBe(inner)
    expect(parentOf(root, 'a')).toBe(root)
  })
})

describe('filterTopmost', () => {
  it('drops descendants of an already-included group', () => {
    const { root } = tree()
    expect(filterTopmost(root, ['b', 'inner', 'a'])).toEqual(['a', 'inner'])
  })

  it('keeps siblings in tree order regardless of input order', () => {
    const { root } = tree()
    expect(filterTopmost(root, ['c', 'b'])).toEqual(['b', 'c'])
  })
})

describe('flattenTree', () => {
  it('lists groups and leaves in visit order', () => {
    const { root } = tree()
    expect(flattenTree(root).map((n) => n.id)).toEqual(['a', 'inner', 'b', 'c'])
  })
})

describe('allContentRefs', () => {
  it('unions per-node refs with channel contents', () => {
    const { root } = tree()
    const doc: Document = {
      version: 2,
      width: 10,
      height: 10,
      root,
      channels: [
        { id: 'ch', role: 'saved', contentId: 'saved-pix', enabled: true }
      ]
    }
    const refs = allContentRefs(doc, (n) =>
      n.kind === 'raster' ? [(n as RasterData).contentId] : []
    )
    expect([...refs].sort()).toEqual(['ca', 'cb', 'cc', 'saved-pix'])
  })
})
