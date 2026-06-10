import { describe, beforeEach, expect, it } from 'vitest'

import { asNodeId } from '@/lib/litegraph/src/litegraph'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { useLayoutMutations } from './layoutMutations'

const nid = asNodeId

beforeEach(() => {
  layoutStore.initializeFromLiteGraph([
    { id: '1', pos: [10, 20], size: [200, 100] },
    { id: '2', pos: [300, 400], size: [150, 80] }
  ])
})

describe('moveNode', () => {
  it('does nothing when node does not exist', () => {
    const { moveNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(nid('1')).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(nid('2')).value }
    moveNode(nid('999'), { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(nid('999')).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(nid('1')).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(nid('2')).value).toEqual(before2)
  })

  it('updates node position', () => {
    const { moveNode } = useLayoutMutations()
    moveNode(nid('1'), { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(nid('1')).value?.position).toEqual({
      x: 100,
      y: 200
    })
  })

  it('normalizes numeric node ID to string', () => {
    const { moveNode } = useLayoutMutations()
    moveNode(nid(1), { x: 50, y: 60 })
    expect(layoutStore.getNodeLayoutRef(nid('1')).value?.position).toEqual({
      x: 50,
      y: 60
    })
  })
})

describe('resizeNode', () => {
  it('does nothing when node does not exist', () => {
    const { resizeNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(nid('1')).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(nid('2')).value }
    resizeNode(nid('999'), { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef(nid('999')).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(nid('1')).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(nid('2')).value).toEqual(before2)
  })

  it('updates node size', () => {
    const { resizeNode } = useLayoutMutations()
    resizeNode(nid('1'), { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef(nid('1')).value?.size).toEqual({
      width: 400,
      height: 200
    })
  })
})

describe('setNodeZIndex', () => {
  it('does nothing when node does not exist', () => {
    const { setNodeZIndex } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(nid('1')).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(nid('2')).value }
    setNodeZIndex(nid('999'), 10)
    expect(layoutStore.getNodeLayoutRef(nid('999')).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(nid('1')).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(nid('2')).value).toEqual(before2)
  })

  it('updates node z-index', () => {
    const { setNodeZIndex } = useLayoutMutations()
    setNodeZIndex(nid('1'), 42)
    expect(layoutStore.getNodeLayoutRef(nid('1')).value?.zIndex).toBe(42)
  })
})

describe('createNode', () => {
  it('makes node accessible via getNodeLayoutRef', () => {
    const { createNode } = useLayoutMutations()
    createNode(nid('99'), {
      position: { x: 50, y: 60 },
      size: { width: 300, height: 150 }
    })
    const layout = layoutStore.getNodeLayoutRef(nid('99')).value
    expect(layout?.position).toEqual({ x: 50, y: 60 })
    expect(layout?.size).toEqual({ width: 300, height: 150 })
  })
})

describe('deleteNode', () => {
  it('does nothing when node does not exist', () => {
    const { deleteNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(nid('1')).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(nid('2')).value }
    deleteNode(nid('999'))
    expect(layoutStore.getNodeLayoutRef(nid('999')).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(nid('1')).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(nid('2')).value).toEqual(before2)
  })

  it('removes node from the store', () => {
    const { deleteNode } = useLayoutMutations()
    deleteNode(nid('1'))
    expect(layoutStore.getNodeLayoutRef(nid('1')).value).toBeNull()
  })
})

describe('batchMoveNodes', () => {
  it('does nothing when updates array is empty', () => {
    const { batchMoveNodes } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(nid('1')).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(nid('2')).value }
    batchMoveNodes([])
    expect(layoutStore.getNodeLayoutRef(nid('1')).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(nid('2')).value).toEqual(before2)
  })

  it('updates positions for all found nodes', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([
      { nodeId: nid('1'), position: { x: 50, y: 60 } },
      { nodeId: nid('2'), position: { x: 70, y: 80 } }
    ])
    expect(layoutStore.getNodeLayoutRef(nid('1')).value?.position).toEqual({
      x: 50,
      y: 60
    })
    expect(layoutStore.getNodeLayoutRef(nid('2')).value?.position).toEqual({
      x: 70,
      y: 80
    })
  })

  it('preserves existing node size when moving', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([{ nodeId: nid('1'), position: { x: 50, y: 60 } }])
    expect(layoutStore.getNodeLayoutRef(nid('1')).value?.size).toEqual({
      width: 200,
      height: 100
    })
  })

  it('skips nodes not found in the store', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([
      { nodeId: nid('999'), position: { x: 0, y: 0 } },
      { nodeId: nid('1'), position: { x: 50, y: 60 } }
    ])
    expect(layoutStore.getNodeLayoutRef(nid('999')).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(nid('1')).value?.position).toEqual({
      x: 50,
      y: 60
    })
  })
})

describe('bringNodeToFront', () => {
  it('gives the node a higher z-index than all other nodes', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(nid('2'), 10)
    bringNodeToFront(nid('1'))
    const z1 = layoutStore.getNodeLayoutRef(nid('1')).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(nid('2')).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('gives the node a higher z-index when all nodes start at the same level', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(nid('1'), 5)
    setNodeZIndex(nid('2'), 5)
    bringNodeToFront(nid('1'))
    const z1 = layoutStore.getNodeLayoutRef(nid('1')).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(nid('2')).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('remains frontmost when the already-leading node is brought to front again', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(nid('1'), 20)
    setNodeZIndex(nid('2'), 5)
    bringNodeToFront(nid('1'))
    const z1 = layoutStore.getNodeLayoutRef(nid('1')).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(nid('2')).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })
})
