import { describe, expect, it } from 'vitest'

import { defaultMode } from '../mode'
import type { GroupData, RasterData, SceneNode } from '../node'
import { rasterKind } from '../kinds/raster'
import { AddNodeCommand, RemoveNodeCommand, ReorderCommand } from './structure'

function group(children: SceneNode[]): GroupData {
  return {
    kind: 'group',
    id: 'g',
    name: 'g',
    visible: true,
    opacity: 1,
    mode: defaultMode('normal'),
    transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children,
    passThrough: false
  }
}

const named = (name: string): RasterData => rasterKind.create({ name })

describe('AddNodeCommand', () => {
  it('undo removes, redo re-adds at the index', () => {
    const node = named('A')
    const parent = group([node])
    const cmd = new AddNodeCommand('Add A', parent, node, 0)
    cmd.apply('undo')
    expect(parent.children).toHaveLength(0)
    cmd.apply('redo')
    expect(parent.children[0]).toBe(node)
  })
})

describe('RemoveNodeCommand', () => {
  it('undo re-inserts at the original index', () => {
    const a = named('A')
    const b = named('B')
    const parent = group([a])
    const cmd = new RemoveNodeCommand('Delete B', parent, b, 1)
    cmd.apply('undo')
    expect(parent.children.map((c) => c.name)).toEqual(['A', 'B'])
    cmd.apply('redo')
    expect(parent.children.map((c) => c.name)).toEqual(['A'])
  })
})

describe('ReorderCommand', () => {
  it('moves the node and reverses on undo', () => {
    const a = named('A')
    const b = named('B')
    const c = named('C')
    const parent = group([b, c, a])
    const cmd = new ReorderCommand('Reorder', a, parent, 0, parent, 2)
    cmd.apply('undo')
    expect(parent.children.map((n) => n.name)).toEqual(['A', 'B', 'C'])
    cmd.apply('redo')
    expect(parent.children.map((n) => n.name)).toEqual(['B', 'C', 'A'])
  })
})
