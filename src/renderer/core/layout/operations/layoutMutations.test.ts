import { beforeEach, describe, expect, it } from 'vitest'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { toNodeId } from '@/types/nodeId'

import { useLayoutMutations } from './layoutMutations'

const NODE_1 = toNodeId('1')
const NODE_2 = toNodeId('2')
const MISSING_NODE = toNodeId('999')
const NEW_NODE = toNodeId('99')

beforeEach(() => {
  layoutStore.initializeFromLiteGraph([
    { id: NODE_1, pos: [10, 20], size: [200, 100] },
    { id: NODE_2, pos: [300, 400], size: [150, 80] }
  ])
})

describe('moveNode', () => {
  it('does nothing when node does not exist', () => {
    const { moveNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(NODE_2).value }
    moveNode(MISSING_NODE, { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(NODE_2).value).toEqual(before2)
  })

  it('updates node position', () => {
    const { moveNode } = useLayoutMutations()
    moveNode(NODE_1, { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef(NODE_1).value?.position).toEqual({
      x: 100,
      y: 200
    })
  })
})

describe('resizeNode', () => {
  it('does nothing when node does not exist', () => {
    const { resizeNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(NODE_2).value }
    resizeNode(MISSING_NODE, { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef(MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(NODE_2).value).toEqual(before2)
  })

  it('updates node size', () => {
    const { resizeNode } = useLayoutMutations()
    resizeNode(NODE_1, { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef(NODE_1).value?.size).toEqual({
      width: 400,
      height: 200
    })
  })
})

describe('setNodeZIndex', () => {
  it('does nothing when node does not exist', () => {
    const { setNodeZIndex } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(NODE_2).value }
    setNodeZIndex(MISSING_NODE, 10)
    expect(layoutStore.getNodeLayoutRef(MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(NODE_2).value).toEqual(before2)
  })

  it('updates node z-index', () => {
    const { setNodeZIndex } = useLayoutMutations()
    setNodeZIndex(NODE_1, 42)
    expect(layoutStore.getNodeLayoutRef(NODE_1).value?.zIndex).toBe(42)
  })
})

describe('createNode', () => {
  it('makes node accessible via getNodeLayoutRef', () => {
    const { createNode } = useLayoutMutations()
    createNode(NEW_NODE, {
      position: { x: 50, y: 60 },
      size: { width: 300, height: 150 }
    })
    const layout = layoutStore.getNodeLayoutRef(NEW_NODE).value
    expect(layout?.position).toEqual({ x: 50, y: 60 })
    expect(layout?.size).toEqual({ width: 300, height: 150 })
  })
})

describe('deleteNode', () => {
  it('does nothing when node does not exist', () => {
    const { deleteNode } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(NODE_2).value }
    deleteNode(MISSING_NODE)
    expect(layoutStore.getNodeLayoutRef(MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(NODE_2).value).toEqual(before2)
  })

  it('removes node from the store', () => {
    const { deleteNode } = useLayoutMutations()
    deleteNode(NODE_1)
    expect(layoutStore.getNodeLayoutRef(NODE_1).value).toBeNull()
  })
})

describe('batchMoveNodes', () => {
  it('does nothing when updates array is empty', () => {
    const { batchMoveNodes } = useLayoutMutations()
    const before1 = { ...layoutStore.getNodeLayoutRef(NODE_1).value }
    const before2 = { ...layoutStore.getNodeLayoutRef(NODE_2).value }
    batchMoveNodes([])
    expect(layoutStore.getNodeLayoutRef(NODE_1).value).toEqual(before1)
    expect(layoutStore.getNodeLayoutRef(NODE_2).value).toEqual(before2)
  })

  it('updates positions for all found nodes', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([
      { nodeId: NODE_1, position: { x: 50, y: 60 } },
      { nodeId: NODE_2, position: { x: 70, y: 80 } }
    ])
    expect(layoutStore.getNodeLayoutRef(NODE_1).value?.position).toEqual({
      x: 50,
      y: 60
    })
    expect(layoutStore.getNodeLayoutRef(NODE_2).value?.position).toEqual({
      x: 70,
      y: 80
    })
  })

  it('preserves existing node size when moving', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([{ nodeId: NODE_1, position: { x: 50, y: 60 } }])
    expect(layoutStore.getNodeLayoutRef(NODE_1).value?.size).toEqual({
      width: 200,
      height: 100
    })
  })

  it('skips nodes not found in the store', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([
      { nodeId: MISSING_NODE, position: { x: 0, y: 0 } },
      { nodeId: NODE_1, position: { x: 50, y: 60 } }
    ])
    expect(layoutStore.getNodeLayoutRef(MISSING_NODE).value).toBeNull()
    expect(layoutStore.getNodeLayoutRef(NODE_1).value?.position).toEqual({
      x: 50,
      y: 60
    })
  })
})

describe('bringNodeToFront', () => {
  it('gives the node a higher z-index than all other nodes', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(NODE_2, 10)
    bringNodeToFront(NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('gives the node a higher z-index when all nodes start at the same level', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(NODE_1, 5)
    setNodeZIndex(NODE_2, 5)
    bringNodeToFront(NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })

  it('remains frontmost when the already-leading node is brought to front again', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex(NODE_1, 20)
    setNodeZIndex(NODE_2, 5)
    bringNodeToFront(NODE_1)
    const z1 = layoutStore.getNodeLayoutRef(NODE_1).value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef(NODE_2).value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })
})
