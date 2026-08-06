import { describe, expect, it } from 'vitest'

import { History } from '../history'
import type { GroupData, SceneNode } from '../node'
import { arrangeNodes } from './arrangeOps'

function mkNode(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number
): SceneNode {
  return {
    id,
    kind: 'raster',
    name: id,
    visible: true,
    opacity: 1,
    mode: {
      blend: 'normal',
      blendSpace: 'auto',
      compositeSpace: 'auto',
      composite: 'union',
      legacy: false
    },
    transform: { x, y, w, h, rotation: 0 },
    locks: { content: false, position: false, visibility: false }
  } as unknown as SceneNode
}

function mkRoot(children: SceneNode[]): GroupData {
  return {
    id: 'root',
    kind: 'group',
    name: 'root',
    visible: true,
    opacity: 1,
    mode: {
      blend: 'normal',
      blendSpace: 'auto',
      compositeSpace: 'auto',
      composite: 'union',
      legacy: false
    },
    transform: { x: 0, y: 0, w: 0, h: 0, rotation: 0 },
    locks: { content: false, position: false, visibility: false },
    children,
    passThrough: true
  } as unknown as GroupData
}

describe('arrangeNodes', () => {
  it('aligns left edges to the selection bbox and is undoable', () => {
    const a = mkNode('a', 10, 0, 10, 10)
    const b = mkNode('b', 50, 20, 20, 10)
    const root = mkRoot([a, b])
    const history = new History()

    expect(arrangeNodes(root, ['a', 'b'], 'left', history)).toBe(true)
    expect(a.transform.x).toBe(10)
    expect(b.transform.x).toBe(10)
    expect(b.transform.y).toBe(20)

    expect(history.canUndo()).toBe(true)
    history.undo()
    expect(b.transform.x).toBe(50)
  })

  it('equalizes gaps keeping first and last fixed', () => {
    const a = mkNode('a', 0, 0, 10, 10)
    const b = mkNode('b', 20, 0, 20, 10)
    const c = mkNode('c', 90, 0, 10, 10)
    const root = mkRoot([a, b, c])
    const history = new History()

    expect(arrangeNodes(root, ['a', 'b', 'c'], 'hgap', history)).toBe(true)
    expect(a.transform.x).toBe(0)
    expect(c.transform.x).toBe(90)
    expect(b.transform.x).toBeCloseTo(40, 6)
    const gap1 = b.transform.x - 10
    const gap2 = 90 - (b.transform.x + 20)
    expect(gap1).toBeCloseTo(gap2, 6)
  })

  it('skips locked and non-transformable nodes', () => {
    const a = mkNode('a', 0, 0, 10, 10)
    const b = mkNode('b', 50, 0, 10, 10)
    b.locks.position = true
    const root = mkRoot([a, b])
    const history = new History()
    expect(arrangeNodes(root, ['a', 'b'], 'left', history)).toBe(false)
    expect(b.transform.x).toBe(50)
  })

  it('returns false when nothing moves', () => {
    const a = mkNode('a', 0, 0, 10, 10)
    const b = mkNode('b', 0, 30, 10, 10)
    const root = mkRoot([a, b])
    const history = new History()
    expect(arrangeNodes(root, ['a', 'b'], 'left', history)).toBe(false)
    expect(history.canUndo()).toBe(false)
  })
})
