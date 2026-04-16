import { describe, beforeEach, expect, it } from 'vitest'

import { layoutStore } from '@/renderer/core/layout/store/layoutStore'

import { useLayoutMutations } from './layoutMutations'

beforeEach(() => {
  layoutStore.initializeFromLiteGraph([
    { id: '1', pos: [10, 20], size: [200, 100] },
    { id: '2', pos: [300, 400], size: [150, 80] }
  ])
})

describe('moveNode', () => {
  it('does nothing when node does not exist', () => {
    const { moveNode } = useLayoutMutations()
    moveNode('999', { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef('999').value).toBeNull()
  })

  it('updates node position', () => {
    const { moveNode } = useLayoutMutations()
    moveNode('1', { x: 100, y: 200 })
    expect(layoutStore.getNodeLayoutRef('1').value?.position).toEqual({
      x: 100,
      y: 200
    })
  })

  it('normalizes numeric node ID to string', () => {
    const { moveNode } = useLayoutMutations()
    moveNode(1, { x: 50, y: 60 })
    expect(layoutStore.getNodeLayoutRef('1').value?.position).toEqual({
      x: 50,
      y: 60
    })
  })
})

describe('resizeNode', () => {
  it('does nothing when node does not exist', () => {
    const { resizeNode } = useLayoutMutations()
    resizeNode('999', { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef('999').value).toBeNull()
  })

  it('updates node size', () => {
    const { resizeNode } = useLayoutMutations()
    resizeNode('1', { width: 400, height: 200 })
    expect(layoutStore.getNodeLayoutRef('1').value?.size).toEqual({
      width: 400,
      height: 200
    })
  })
})

describe('setNodeZIndex', () => {
  it('does nothing when node does not exist', () => {
    const { setNodeZIndex } = useLayoutMutations()
    setNodeZIndex('999', 10)
    expect(layoutStore.getNodeLayoutRef('999').value).toBeNull()
  })

  it('updates node z-index', () => {
    const { setNodeZIndex } = useLayoutMutations()
    setNodeZIndex('1', 42)
    expect(layoutStore.getNodeLayoutRef('1').value?.zIndex).toBe(42)
  })
})

describe('createNode', () => {
  it('makes node accessible via getNodeLayoutRef', () => {
    const { createNode } = useLayoutMutations()
    createNode('99', {
      position: { x: 50, y: 60 },
      size: { width: 300, height: 150 }
    })
    const layout = layoutStore.getNodeLayoutRef('99').value
    expect(layout?.position).toEqual({ x: 50, y: 60 })
    expect(layout?.size).toEqual({ width: 300, height: 150 })
  })
})

describe('deleteNode', () => {
  it('does nothing when node does not exist', () => {
    const { deleteNode } = useLayoutMutations()
    deleteNode('999')
    expect(layoutStore.getNodeLayoutRef('1').value).not.toBeNull()
  })

  it('removes node from the store', () => {
    const { deleteNode } = useLayoutMutations()
    deleteNode('1')
    expect(layoutStore.getNodeLayoutRef('1').value).toBeNull()
  })
})

describe('batchMoveNodes', () => {
  it('does nothing when updates array is empty', () => {
    const { batchMoveNodes } = useLayoutMutations()
    const before = layoutStore.getNodeLayoutRef('1').value?.position
    batchMoveNodes([])
    expect(layoutStore.getNodeLayoutRef('1').value?.position).toEqual(before)
  })

  it('updates positions for all found nodes', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([
      { nodeId: '1', position: { x: 50, y: 60 } },
      { nodeId: '2', position: { x: 70, y: 80 } }
    ])
    expect(layoutStore.getNodeLayoutRef('1').value?.position).toEqual({
      x: 50,
      y: 60
    })
    expect(layoutStore.getNodeLayoutRef('2').value?.position).toEqual({
      x: 70,
      y: 80
    })
  })

  it('preserves existing node size when moving', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([{ nodeId: '1', position: { x: 50, y: 60 } }])
    expect(layoutStore.getNodeLayoutRef('1').value?.size).toEqual({
      width: 200,
      height: 100
    })
  })

  it('skips nodes not found in the store', () => {
    const { batchMoveNodes } = useLayoutMutations()
    batchMoveNodes([
      { nodeId: '999', position: { x: 0, y: 0 } },
      { nodeId: '1', position: { x: 50, y: 60 } }
    ])
    expect(layoutStore.getNodeLayoutRef('999').value).toBeNull()
    expect(layoutStore.getNodeLayoutRef('1').value?.position).toEqual({
      x: 50,
      y: 60
    })
  })
})

describe('bringNodeToFront', () => {
  it('gives the node a higher z-index than all other nodes', () => {
    const { setNodeZIndex, bringNodeToFront } = useLayoutMutations()
    setNodeZIndex('2', 10)
    bringNodeToFront('1')
    const z1 = layoutStore.getNodeLayoutRef('1').value?.zIndex ?? 0
    const z2 = layoutStore.getNodeLayoutRef('2').value?.zIndex ?? 0
    expect(z1).toBeGreaterThan(z2)
  })
})
