import { toGroupId } from '@/types/groupId'
import type { GroupId } from '@/types/groupId'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { unregisterGroupLayout } from '@/renderer/core/layout/operations/graphLayoutRegistration'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import {
  LayoutOperationError,
  layoutStore
} from '@/renderer/core/layout/store/layoutStore'

import { test } from './__fixtures__/testExtensions'

describe('LGraphGroup', () => {
  test('serializes to the existing format', () => {
    const link = new LGraphGroup('title', 929)
    expect(link.serialize()).toMatchSnapshot('Basic')
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
})

describe('group layout in layoutStore', () => {
  // graph.add(node) registers node state, which needs a store.
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

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
    addedGroup(graph, toGroupId(802))

    graph.clear()

    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, toGroupId(802))
    ).toBeNull()
  })

  test('remove preserves a foreign layout that replaced the attached group', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(803))
    const groups = layoutStore.getYDoc().getMap<Y.Map<unknown>>('groups')
    const key = `${graph.rootGraph.id}:${group.id}`
    const foreignGroup = new Y.Map<unknown>()
    foreignGroup.set('id', group.id)
    foreignGroup.set('rect', [20, 30, 40, 50])
    foreignGroup.set('registrationId', 'foreign-group')
    groups.set(key, foreignGroup)

    graph.remove(group)

    expect(groups.get(key)).toBe(foreignGroup)
  })

  test('clear preserves a foreign layout that replaced the attached group', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(804))
    const groups = layoutStore.getYDoc().getMap<Y.Map<unknown>>('groups')
    const key = `${graph.rootGraph.id}:${group.id}`
    const foreignGroup = new Y.Map<unknown>()
    foreignGroup.set('id', group.id)
    foreignGroup.set('rect', [20, 30, 40, 50])
    foreignGroup.set('registrationId', 'foreign-group')
    groups.set(key, foreignGroup)

    graph.clear()

    expect(groups.get(key)).toBe(foreignGroup)
  })

  test('unregister without ownership evidence preserves the layout', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('unowned', 805)
    const groups = layoutStore.getYDoc().getMap<Y.Map<unknown>>('groups')
    const key = `${graph.rootGraph.id}:${group.id}`
    const foreignGroup = new Y.Map<unknown>()
    foreignGroup.set('id', group.id)
    foreignGroup.set('rect', [20, 30, 40, 50])
    foreignGroup.set('registrationId', 'foreign-group')
    groups.set(key, foreignGroup)

    unregisterGroupLayout(graph, group)

    expect(groups.get(key)).toBe(foreignGroup)
  })

  test('retains group ownership when unregister throws before deletion', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(806))
    const ydoc = layoutStore.getYDoc()
    const transact = vi.spyOn(ydoc, 'transact').mockImplementationOnce(() => {
      throw new Error('group delete failed')
    })

    expect(() => graph.remove(group)).toThrow('group delete failed')
    transact.mockRestore()
    expect(graph.groups).toContain(group)
    expect(group.graph).toBe(graph)
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, group.id)
    ).not.toBeNull()

    graph.remove(group)

    expect(graph.groups).not.toContain(group)
    expect(group.graph).toBeUndefined()
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toBeNull()
  })

  test('keeps group ownership when reentrant unregister is rejected', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(807))
    const ydoc = layoutStore.getYDoc()
    function attemptRemove(): void {
      ydoc.off('beforeTransaction', attemptRemove)
      graph.remove(group)
    }
    ydoc.on('beforeTransaction', attemptRemove)

    group.pos = [200, 250]

    expect(graph.groups).toContain(group)
    expect(group.graph).toBe(graph)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 200, y: 250 },
      size: { width: 300, height: 200 }
    })
  })

  test('keeps node layout registration when reentrant clear is rejected', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    graph.add(node)
    const group = addedGroup(graph, toGroupId(808))
    const ydoc = layoutStore.getYDoc()
    function attemptClear(): void {
      ydoc.off('beforeTransaction', attemptClear)
      graph.clear()
    }
    ydoc.on('beforeTransaction', attemptClear)

    group.pos = [200, 250]

    expect(node._layoutRegistered).toBe(true)
    expect(graph.nodes).toContain(node)
    expect(graph.groups).toContain(group)
    expect(group.graph).toBe(graph)
  })

  test('keeps node ownership when reentrant removal is rejected', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    graph.add(node)
    const group = addedGroup(graph, toGroupId(809))
    const ydoc = layoutStore.getYDoc()
    function attemptRemove(): void {
      ydoc.off('beforeTransaction', attemptRemove)
      graph.remove(node)
    }
    ydoc.on('beforeTransaction', attemptRemove)

    group.pos = [200, 250]

    expect(node._layoutRegistered).toBe(true)
    expect(node.graph).toBe(graph)
    expect(graph.nodes).toContain(node)
  })

  test('aborts reentrant configure when layout teardown is rejected', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    graph.add(node)
    const group = addedGroup(graph, toGroupId(810))
    const data = graph.asSerialisable()
    const ydoc = layoutStore.getYDoc()
    function attemptConfigure(): void {
      ydoc.off('beforeTransaction', attemptConfigure)
      graph.configure(data)
    }
    ydoc.on('beforeTransaction', attemptConfigure)

    group.pos = [200, 250]

    expect(graph.nodes).toEqual([node])
    expect(graph.groups).toEqual([group])
    expect(node.graph).toBe(graph)
    expect(group.graph).toBe(graph)
  })

  test('clear detaches groups so another graph can adopt them', () => {
    const firstGraph = new LGraph()
    const secondGraph = new LGraph()
    const group = addedGroup(firstGraph, toGroupId(808))

    firstGraph.clear()
    secondGraph.add(group)

    expect(group.graph).toBe(secondGraph)
    expect(firstGraph.groups).toHaveLength(0)
    expect(secondGraph.groups).toEqual([group])
    expect(layoutStore.getGroupLayout(secondGraph.id, group.id)).not.toBeNull()
  })

  test('root clear detaches groups owned by destroyed subgraphs', () => {
    const root = new LGraph()
    const subgraph = createTestSubgraph({ rootGraph: root })
    root.subgraphs.set(subgraph.id, subgraph)
    const group = addedGroup(subgraph, toGroupId(814))
    const originalRootId = root.id
    const nextGraph = new LGraph()

    root.clear()
    nextGraph.add(group)

    expect(group.graph).toBe(nextGraph)
    expect(subgraph.groups).toHaveLength(0)
    expect(nextGraph.groups).toEqual([group])
    expect(layoutStore.getGroupLayout(originalRootId, toGroupId(814))).toBeNull()
    expect(layoutStore.getGroupLayout(nextGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 }
    })
  })

  test('rolls back group add when layout registration fails', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group')
    const originalId = group.id
    const originalLastGroupId = graph.state.lastGroupId
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockImplementation((operation) => {
        if (operation.type === 'createGroup') throw new Error('layout failed')
        return 'no-op'
      })

    expect(() => graph.add(group)).toThrow('layout failed')
    applyOperation.mockRestore()

    expect(group.id).toBe(originalId)
    expect(group.graph).toBeUndefined()
    expect(graph.groups).toHaveLength(0)
    expect(graph.state.lastGroupId).toBe(originalLastGroupId)
    expect(layoutStore.getGroupLayout(graph.id, toGroupId(1))).toBeNull()
  })

  test('rolls back group add when layout registration throws after applying', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group')
    const originalId = group.id
    const originalLastGroupId = graph.state.lastGroupId
    const originalApplyOperation = layoutStore.applyOperation.bind(layoutStore)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    applyOperation.mockImplementation((operation) => {
      const result = originalApplyOperation(operation)
      if (operation.type === 'createGroup') {
        const cause = new Error('notify failed')
        throw new LayoutOperationError(cause.message, true, { cause })
      }
      return result
    })

    expect(() => graph.add(group)).toThrow('notify failed')
    applyOperation.mockRestore()

    expect(group.id).toBe(originalId)
    expect(group.graph).toBeUndefined()
    expect(graph.groups).toHaveLength(0)
    expect(graph.state.lastGroupId).toBe(originalLastGroupId)
    expect(layoutStore.getGroupLayout(graph.id, toGroupId(1))).toBeNull()
  })

  test('rejects an externally owned same-UUID group layout before mutation', () => {
    const firstGraph = new LGraph()
    const secondGraph = new LGraph()
    secondGraph.id = firstGraph.id
    const first = addedGroup(firstGraph, toGroupId(815))
    const second = new LGraphGroup('second', first.id)
    second.pos = [200, 300]
    second.size = [400, 500]
    const firstLastGroupId = firstGraph.state.lastGroupId
    const secondLastGroupId = secondGraph.state.lastGroupId

    expect(() => secondGraph.add(second)).toThrow(/layout.*owned/i)

    expect(firstGraph.groups).toEqual([first])
    expect(secondGraph.groups).toHaveLength(0)
    expect(first.graph).toBe(firstGraph)
    expect(second.graph).toBeUndefined()
    expect(second.id).toBe(815)
    expect([...second.pos]).toEqual([200, 300])
    expect([...second.size]).toEqual([400, 500])
    expect(firstGraph.state.lastGroupId).toBe(firstLastGroupId)
    expect(secondGraph.state.lastGroupId).toBe(secondLastGroupId)
    expect(layoutStore.getGroupLayout(firstGraph.id, first.id)).toEqual({
      id: first.id,
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 }
    })

    firstGraph.remove(first)
    expect(layoutStore.getGroupLayout(firstGraph.id, first.id)).toBeNull()
  })

  test('isolates colliding group IDs across live root graphs', () => {
    const firstGraph = new LGraph()
    const SHARED_GROUP = toGroupId(803)
    const secondGraph = new LGraph()
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

  test('assigns colliding live groups independent layout ownership', () => {
    const graph = new LGraph()
    const first = addedGroup(graph, toGroupId(809))
    const second = addedGroup(graph, toGroupId(809))

    expect(second.id).not.toBe(first.id)
    expect(graph.state.lastGroupId).toBe(second.id)

    first.pos = [10, 20]
    second.pos = [30, 40]
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, first.id)?.position
    ).toEqual({
      x: 10,
      y: 20
    })
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, second.id)?.position
    ).toEqual({
      x: 30,
      y: 40
    })

    graph.remove(first)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, first.id)).toBeNull()
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, second.id)
    ).not.toBeNull()

    graph.remove(second)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, second.id)).toBeNull()
  })

  test('remaps colliding group IDs across sibling subgraphs', () => {
    const root = new LGraph()
    const firstGraph = createTestSubgraph({ rootGraph: root })
    const secondGraph = createTestSubgraph({ rootGraph: root })
    root.subgraphs.set(firstGraph.id, firstGraph)
    root.subgraphs.set(secondGraph.id, secondGraph)
    const first = addedGroup(firstGraph, toGroupId(810))
    const second = addedGroup(secondGraph, toGroupId(810))

    expect(second.id).not.toBe(first.id)
    expect(root.state.lastGroupId).toBe(second.id)
    expect(layoutStore.getGroupLayout(root.id, first.id)).not.toBeNull()
    expect(layoutStore.getGroupLayout(root.id, second.id)).not.toBeNull()
  })

  test('adding the same group twice is idempotent', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(811))

    graph.add(group)

    expect(group.id).toBe(811)
    expect(graph.groups).toEqual([group])
  })

  test('rejects a group owned by another graph before mutation', () => {
    const firstGraph = new LGraph()
    const secondGraph = new LGraph()
    const group = addedGroup(firstGraph, toGroupId(812))

    expect(() => secondGraph.add(group)).toThrow(/already belongs/)
    expect(group.graph).toBe(firstGraph)
    expect(group.id).toBe(812)
    expect(firstGraph.groups).toEqual([group])
    expect(secondGraph.groups).toHaveLength(0)
  })

  test('does not remove a foreign group with the same ID', () => {
    const graph = new LGraph()
    const owner = addedGroup(graph, toGroupId(813))
    const foreign = new LGraphGroup('foreign', owner.id)

    graph.remove(foreign)

    expect(graph.groups).toEqual([owner])
    expect(owner.graph).toBe(graph)
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, owner.id)
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
    useLayoutMutations().deleteGroup(graph.rootGraph.id, group.id)

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
      source: layoutStore.getCurrentSource(),
      entity: 'group',
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

  test('rejects a layout inserted during group registration without deleting it', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group')
    const originalId = group.id
    const originalLastGroupId = graph.state.lastGroupId
    const rootGraphId = graph.rootGraph.id
    const foreignRect = [20, 30, 40, 50]
    const ydoc = layoutStore.getYDoc()
    function insertForeignLayout(): void {
      ydoc.off('beforeTransaction', insertForeignLayout)
      const foreignGroup = new Y.Map<unknown>()
      foreignGroup.set('id', 1)
      foreignGroup.set('rect', foreignRect)
      ydoc
        .getMap<Y.Map<unknown>>('groups')
        .set(`${rootGraphId}:1`, foreignGroup)
      throw new Error('foreign group listener failed')
    }
    ydoc.on('beforeTransaction', insertForeignLayout)

    expect(() => graph.add(group)).toThrow('foreign group listener failed')

    expect(group.id).toBe(originalId)
    expect(group.graph).toBeUndefined()
    expect(graph.groups).toHaveLength(0)
    expect(graph.state.lastGroupId).toBe(originalLastGroupId)
    expect(layoutStore.getGroupLayout(rootGraphId, toGroupId(1))).toEqual({
      id: 1,
      position: { x: 20, y: 30 },
      size: { width: 40, height: 50 }
    })
  })

  test('preserves a foreign layout replacing an applied registration before failure', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group')
    const originalLastGroupId = graph.state.lastGroupId
    const rootGraphId = graph.rootGraph.id
    const ydoc = layoutStore.getYDoc()
    const groups = ydoc.getMap<Y.Map<unknown>>('groups')
    let registeredKey: string | undefined
    const originalTransact = ydoc.transact.bind(ydoc)
    const transact = vi.spyOn(ydoc, 'transact')
    transact.mockImplementation((transaction, origin) => {
      originalTransact(transaction, origin)
      registeredKey = [...groups.keys()].find((key) =>
        key.startsWith(`${rootGraphId}:`)
      )
      if (!registeredKey) return
      transact.mockRestore()
      const foreignGroup = new Y.Map<unknown>()
      const groupId = Number(
        registeredKey.slice(registeredKey.lastIndexOf(':') + 1)
      )
      foreignGroup.set('id', groupId)
      foreignGroup.set('rect', [20, 30, 40, 50])
      foreignGroup.set('registrationId', 'foreign-group')
      groups.set(registeredKey, foreignGroup)
      throw new Error('group finalization failed')
    })

    expect(() => graph.add(group)).toThrow('group finalization failed')
    transact.mockRestore()

    expect(group.graph).toBeUndefined()
    expect(graph.groups).toHaveLength(0)
    expect(graph.state.lastGroupId).toBe(originalLastGroupId)
    const groupId = toGroupId(
      Number(registeredKey!.slice(registeredKey!.lastIndexOf(':') + 1))
    )
    expect(layoutStore.getGroupLayout(rootGraphId, groupId)).toEqual({
      id: groupId,
      position: { x: 20, y: 30 },
      size: { width: 40, height: 50 }
    })
  })
})
