import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { containsRect } from '@/lib/litegraph/src/measure'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { GroupId } from '@/types/groupId'
import { toGroupId } from '@/types/groupId'
import * as colorUtil from '@/utils/colorUtil'
import { createUuidv4 } from '@/utils/uuid'

import { test } from './__fixtures__/testExtensions'

vi.mock('@/utils/colorUtil', async (importOriginal) => {
  const actual = await importOriginal<typeof colorUtil>()
  return { ...actual, readableTextColor: vi.fn(actual.readableTextColor) }
})

function createMockContext() {
  return {
    beginPath: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillText: vi.fn(),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    textAlign: 'left' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline
  } as unknown as CanvasRenderingContext2D
}

const graphCanvas = { editor_alpha: 1 } as Partial<LGraphCanvas> as LGraphCanvas

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

describe('LGraphGroup', () => {
  test('serializes to the existing format', () => {
    const link = new LGraphGroup('title', toGroupId(929))
    expect(link.serialize()).toMatchSnapshot('Basic')
  })

  test('clears a color option', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group', toGroupId(932))
    graph.add(group)
    group.color = '#123456'

    group.setColorOption(null)

    expect(group.color).toBeUndefined()
    expect(group.serialize().color).toBeUndefined()
  })

  describe('recomputeInsideNodes', () => {
    test('uses visited set to avoid redundant computation', () => {
      const graph = new LGraph()

      // Create 4 nested groups: outer -> mid1 -> mid2 -> inner
      const outer = new LGraphGroup('outer')
      outer.pos = [0, 0]
      outer.size = [400, 400]
      graph.add(outer)

      const mid1 = new LGraphGroup('mid1')
      mid1.pos = [10, 10]
      mid1.size = [300, 300]
      graph.add(mid1)

      const mid2 = new LGraphGroup('mid2')
      mid2.pos = [20, 20]
      mid2.size = [200, 200]
      graph.add(mid2)

      const inner = new LGraphGroup('inner')
      inner.pos = [30, 30]
      inner.size = [100, 100]
      graph.add(inner)

      // Track the visited set to verify each group is only fully processed once
      const visited = new Set<GroupId>()
      outer.recomputeInsideNodes(100, visited)

      // All nested groups should be in the visited set
      expect(visited.has(outer.id)).toBe(true)
      expect(visited.has(mid1.id)).toBe(true)
      expect(visited.has(mid2.id)).toBe(true)
      expect(visited.has(inner.id)).toBe(true)
      expect(visited.size).toBe(4)

      // Verify children relationships are correct
      expect(outer.children.has(mid1)).toBe(true)
      expect(outer.children.has(mid2)).toBe(true)
      expect(outer.children.has(inner)).toBe(true)
      expect(mid1.children.has(mid2)).toBe(true)
      expect(mid1.children.has(inner)).toBe(true)
      expect(mid2.children.has(inner)).toBe(true)
    })

    test('respects maxDepth limit', () => {
      const graph = new LGraph()

      const outer = new LGraphGroup('outer')
      outer.pos = [0, 0]
      outer.size = [300, 300]
      graph.add(outer)

      const inner = new LGraphGroup('inner')
      inner.pos = [10, 10]
      inner.size = [100, 100]
      graph.add(inner)

      // With maxDepth=1, inner group is added as child but not processed
      outer.recomputeInsideNodes(1)

      // outer should have inner as a child
      expect(outer.children.has(inner)).toBe(true)
      // inner should not have computed its own children (it was never processed)
      expect(inner.children.size).toBe(0)
    })
  })

  describe('resizeTo', () => {
    const alwaysSnapToGrid = LiteGraph.alwaysSnapToGrid
    const gridSize = LiteGraph.CANVAS_GRID_SIZE

    afterEach(() => {
      LiteGraph.alwaysSnapToGrid = alwaysSnapToGrid
      LiteGraph.CANVAS_GRID_SIZE = gridSize
    })

    function createGroupFittedToContent() {
      const graph = new LGraph()
      const group = new LGraphGroup('group')
      graph.add(group)

      const content = new LGraphGroup('content')
      content.pos = [103, 207]
      content.size = [140, 80]

      group.resizeTo([content], 10)
      return { group, content }
    }

    test('fits the group around its contents with padding', () => {
      LiteGraph.alwaysSnapToGrid = false
      const { group } = createGroupFittedToContent()

      expect([...group.pos]).toEqual([93, 197 - group.titleHeight])
      expect([...group.size]).toEqual([160, 100 + group.titleHeight])
    })

    test('expands every border to the grid when always snapping', () => {
      LiteGraph.alwaysSnapToGrid = true
      LiteGraph.CANVAS_GRID_SIZE = 10
      const { group, content } = createGroupFittedToContent()

      const [x, y, width, height] = group.boundingRect
      expect([x, y, x + width, y + height].map((edge) => edge % 10)).toEqual([
        0, 0, 0, 0
      ])
      expect(containsRect(group.boundingRect, content.boundingRect)).toBe(true)
    })
  })

  describe('draw', () => {
    test('lightens the title text for a very dark background', () => {
      const group = new LGraphGroup('Group')
      group.color = '#000000'
      const ctx = createMockContext()

      group.draw(graphCanvas, ctx)

      expect(ctx.fillStyle).toBe(colorUtil.readableTextColor('#000000'))
      expect(ctx.fillStyle).not.toBe('#fff')
      expect(ctx.fillStyle).not.toBe('#000000')
    })

    test('leaves the title text unchanged for a light background', () => {
      const group = new LGraphGroup('Group')
      group.color = '#ffffff'
      const ctx = createMockContext()

      group.draw(graphCanvas, ctx)

      expect(ctx.fillStyle).toBe('#ffffff')
    })

    test('leaves the title text unchanged for a moderately dark, non-black background', () => {
      const group = new LGraphGroup('Group')
      // "purple" preset groupcolor - dark but well above the black-ish threshold
      group.color = '#a1309b'
      const ctx = createMockContext()

      group.draw(graphCanvas, ctx)

      expect(ctx.fillStyle).toBe('#a1309b')
    })

    test('does not recompute the title text color when the background is unchanged', () => {
      const group = new LGraphGroup('Group')
      group.color = '#000000'
      const ctx = createMockContext()
      vi.mocked(colorUtil.readableTextColor).mockClear()

      group.draw(graphCanvas, ctx)
      group.draw(graphCanvas, ctx)

      expect(colorUtil.readableTextColor).toHaveBeenCalledTimes(1)
    })

    test('recomputes the title text color when the background changes', () => {
      const group = new LGraphGroup('Group')
      group.color = '#000000'
      const ctx = createMockContext()
      vi.mocked(colorUtil.readableTextColor).mockClear()

      group.draw(graphCanvas, ctx)
      group.color = '#111111'
      group.draw(graphCanvas, ctx)

      expect(colorUtil.readableTextColor).toHaveBeenCalledTimes(2)
    })
  })
})

describe('group layout in layoutStore', () => {
  function addedGroup(graph: LGraph, id: GroupId) {
    const group = new LGraphGroup('group', id)
    group.pos = [100, 100]
    group.size = [300, 200]
    graph.add(group)
    return group
  }

  test('registers geometry on add and drops it on remove', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(801))

    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, toGroupId(801))
    ).toEqual({
      id: toGroupId(801),
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 }
    })

    graph.remove(group)
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, toGroupId(801))
    ).toBeNull()
  })

  test('drops entries when the graph is cleared', () => {
    const graph = new LGraph()
    const rootGraphId = graph.rootGraph.id
    addedGroup(graph, toGroupId(802))

    graph.clear()

    expect(layoutStore.getGroupLayout(rootGraphId, toGroupId(802))).toBeNull()
  })

  test('isolates colliding group IDs across live root graphs', () => {
    const firstGraph = new LGraph()
    const SHARED_GROUP = toGroupId(803)
    const secondGraph = new LGraph()
    firstGraph.id = createUuidv4()
    secondGraph.id = createUuidv4()
    const firstGroup = addedGroup(firstGraph, SHARED_GROUP)
    const secondGroup = addedGroup(secondGraph, SHARED_GROUP)

    firstGroup.pos = [20, 30]
    secondGroup.pos = [200, 300]

    expect(
      layoutStore.getGroupLayout(firstGraph.id, SHARED_GROUP)?.position
    ).toEqual({
      x: 20,
      y: 30
    })
    expect(
      layoutStore.getGroupLayout(secondGraph.id, SHARED_GROUP)?.position
    ).toEqual({
      x: 200,
      y: 300
    })

    firstGraph.remove(firstGroup)
    expect(layoutStore.getGroupLayout(firstGraph.id, SHARED_GROUP)).toBeNull()
    expect(
      layoutStore.getGroupLayout(secondGraph.id, SHARED_GROUP)
    ).not.toBeNull()

    firstGraph.clear()
    expect(
      layoutStore.getGroupLayout(secondGraph.id, secondGroup.id)
    ).not.toBeNull()
  })

  describe('every geometry mutation keeps the store in step', () => {
    const mutations: Array<[name: string, mutate: (g: LGraphGroup) => void]> = [
      ['pos setter', (g) => void (g.pos = [7, 9])],
      ['size setter', (g) => void (g.size = [400, 300])],
      ['move', (g) => g.move(10, 20)],
      ['resize', (g) => void g.resize(500, 400)],
      ['snapToGrid', (g) => void g.snapToGrid(64)],
      [
        'configure',
        (g) =>
          g.configure({
            id: g.id,
            title: 'reconfigured',
            bounding: [1, 2, 300, 200],
            flags: {}
          })
      ]
    ]

    test.for(mutations)('%s', ([, mutate], { expect }) => {
      const graph = new LGraph()
      const group = addedGroup(graph, toGroupId(803))

      mutate(group)

      expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
        id: group.id,
        position: { x: group.pos[0], y: group.pos[1] },
        size: { width: group.size[0], height: group.size[1] }
      })
    })
  })

  test('keeps geometry locally when the store entry is gone', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(809))
    layoutStore.applyOperation({
      type: 'deleteGroup',
      graphId: graph.rootGraph.id,
      groupId: group.id,
      timestamp: Date.now(),
      source: LayoutSource.Canvas
    })

    group.pos = [11, 22]

    expect([...group.pos]).toEqual([11, 22])
  })

  test('snapToGrid reports whether the group moved', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(810))

    group.pos = [70, 128]
    expect(group.snapToGrid(64)).toBe(true)
    expect(group.snapToGrid(64)).toBe(false)
  })

  test('resizeTo fits contents and commits, still unclamped', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(804))
    const node = new LGraphNode('tiny')
    node.pos = [500, 500]
    node.size = [10, 10]
    graph.add(node)

    group.resizeTo([node])

    // Narrower than minWidth: fit-to-contents deliberately does not clamp.
    expect(group.size[0]).toBeLessThan(LGraphGroup.minWidth)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: group.pos[0], y: group.pos[1] },
      size: { width: group.size[0], height: group.size[1] }
    })
  })

  test('setters write through the shared Rectangle buffer', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(805))
    const pos = group.pos
    const size = group.size

    group.pos = [1, 2]
    group.size = [400, 300]

    expect(group.pos).toBe(pos)
    expect(group.size).toBe(size)
    expect([...pos]).toEqual([1, 2])
  })

  test('legacy geometry buffers write through to the store', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(806))

    group.pos[0] = 25
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 25, y: 100 },
      size: { width: 300, height: 200 }
    })

    group.size[1] = 450
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 25, y: 100 },
      size: { width: 300, height: 450 }
    })

    group._bounding.set([30, 40, 500, 600])
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 30, y: 40 },
      size: { width: 500, height: 600 }
    })

    group._bounding.pos[0] = 35
    group._bounding.size[1] = 650
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 35, y: 40 },
      size: { width: 500, height: 650 }
    })
  })

  test('reads geometry from the store', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(807))
    const pos = group.pos
    const size = group.size

    layoutStore.applyOperation({
      type: 'setGroupBounds',
      actor: 'test',
      timestamp: 1,
      source: LayoutSource.Canvas,
      graphId: graph.rootGraph.id,
      groupId: group.id,
      position: { x: 11, y: 12 },
      size: { width: 410, height: 310 }
    })

    expect(group.pos).toBe(pos)
    expect(group.size).toBe(size)
    expect([...group.boundingRect]).toEqual([11, 12, 410, 310])
    expect([...pos]).toEqual([11, 12])
    expect([...size]).toEqual([410, 310])
    expect(group.serialize().bounding).toEqual([11, 12, 410, 310])
  })

  test('group collections react to nested bounds updates', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(808))
    const groups = layoutStore.getAllGroups(graph.rootGraph.id)

    expect(groups.value.get(group.id)?.position.x).toBe(100)

    group.pos = [75, 80]

    expect(groups.value.get(group.id)?.position).toEqual({ x: 75, y: 80 })
  })
})
