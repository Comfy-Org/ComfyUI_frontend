import { toGroupId } from '@/types/groupId'
import type { GroupId } from '@/types/groupId'
import { toNodeId } from '@/types/nodeId'
import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, onTestFinished, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphGroup, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import {
  attachGroupLayout,
  registerGroupLayout,
  registerNodeLayout,
  unregisterNodeLayout,
  unregisterGroupLayout
} from '@/renderer/core/layout/operations/graphLayoutRegistration'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import {
  LayoutOperationError,
  layoutStore
} from '@/renderer/core/layout/store/layoutStore'
import { getLayoutStoreYDoc } from '@/renderer/core/layout/store/layoutStoreTestUtils'
import { LayoutSource } from '@/renderer/core/layout/types'

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

  test.for([
    [
      'remove',
      true,
      (graph: LGraph, group: LGraphGroup) => graph.remove(group)
    ],
    ['clear', true, (graph: LGraph) => graph.clear()],
    [
      'unowned unregister',
      false,
      (graph: LGraph, group: LGraphGroup) => unregisterGroupLayout(graph, group)
    ]
  ] as const)('%s preserves a foreign layout', ([, attached, release]) => {
    const graph = new LGraph()
    const group = attached
      ? addedGroup(graph, toGroupId(803))
      : new LGraphGroup('unowned', 803)
    const groups = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('groups')
    const key = `${graph.rootGraph.id}:${group.id}`
    const foreignGroup = new Y.Map<unknown>()
    foreignGroup.set('id', group.id)
    foreignGroup.set('rect', [20, 30, 40, 50])
    foreignGroup.set('registrationId', 'foreign-group')
    groups.set(key, foreignGroup)

    release(graph, group)

    expect(groups.get(key)).toBe(foreignGroup)
  })

  test('keeps retained node ownership after a foreign explicit unregister', () => {
    const graph = new LGraph()
    const node = new LGraphNode('test')
    graph.add(node)
    unregisterNodeLayout(graph, node)
    registerNodeLayout(graph, node, 'A')

    expect(unregisterNodeLayout(graph, node, 'B')).toBe('no-op')
    node.pos = [220, 440]
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value?.position
    ).toEqual({
      x: 220,
      y: 440
    })

    expect(unregisterNodeLayout(graph, node, 'A')).toBe('applied')
    expect(
      layoutStore.getNodeLayoutRef(graph.rootGraph.id, node.id).value
    ).toBeNull()
  })

  test('keeps retained ownership after a foreign explicit unregister', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(817))
    unregisterGroupLayout(graph, group)
    registerGroupLayout(graph, group, 'A')

    expect(unregisterGroupLayout(graph, group, 'B')).toBe('no-op')
    group.pos = [200, 250]
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, group.id)?.position
    ).toEqual({ x: 200, y: 250 })

    expect(unregisterGroupLayout(graph, group, 'A')).toBe('applied')
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toBeNull()
  })

  test('restores group registration when unregister throws after deletion', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(810))
    const ydoc = getLayoutStoreYDoc()
    const registrationId = layoutStore.getRegistrationId(
      'group',
      graph.rootGraph.id,
      group.id
    )
    const originalTransact = ydoc.transact.bind(ydoc)
    const transact = vi
      .spyOn(ydoc, 'transact')
      .mockImplementationOnce((transaction, origin) => {
        originalTransact(transaction, origin)
        throw new Error('group unregister failed')
      })

    expect(() => graph.remove(group)).toThrow('group unregister failed')
    transact.mockRestore()
    expect(graph.groups).toContain(group)
    expect(group.graph).toBe(graph)
    expect(
      layoutStore.getRegistrationId('group', graph.rootGraph.id, group.id)
    ).toBe(registrationId)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 }
    })

    group.pos = [200, 250]
    expect(
      layoutStore.getGroupLayout(graph.rootGraph.id, group.id)?.position
    ).toEqual({
      x: 200,
      y: 250
    })
    graph.remove(group)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toBeNull()
  })

  test('restores an attached group layout when canvas deselect throws', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(809))
    unregisterGroupLayout(graph, group)
    registerGroupLayout(graph, group, '')
    const canvasAction = vi
      .spyOn(graph, 'canvasAction')
      .mockImplementation(() => {
        throw new Error('group deselect failed')
      })

    expect(() => graph.remove(group)).toThrow('group deselect failed')
    expect(graph.groups).toContain(group)
    expect(group.graph).toBe(graph)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 }
    })

    group.pos = [200, 250]
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toEqual({
      id: group.id,
      position: { x: 200, y: 250 },
      size: { width: 300, height: 200 }
    })

    canvasAction.mockRestore()
    graph.remove(group)
    expect(layoutStore.getGroupLayout(graph.rootGraph.id, group.id)).toBeNull()
  })

  test('drops stale group ownership when compensation preserves a foreign layout', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(819))
    const groups = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('groups')
    const key = `${graph.id}:${group.id}`
    const foreign = new Y.Map<unknown>()
    foreign.set('id', group.id)
    foreign.set('rect', [20, 30, 40, 50])
    foreign.set('registrationId', 'foreign')
    vi.spyOn(graph, 'canvasAction').mockImplementation(() => {
      groups.set(key, foreign)
      throw new Error('group deselect failed')
    })

    expect(() => graph.remove(group)).toThrow('group deselect failed')
    expect(groups.get(key)).toBe(foreign)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())

    group.pos = [200, 250]

    expect(applyOperation).not.toHaveBeenCalled()
    expect(groups.get(key)).toBe(foreign)
  })

  test('keeps group ownership when reentrant unregister is rejected', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(807))
    const ydoc = getLayoutStoreYDoc()
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
    vi.useFakeTimers()
    const graph = new LGraph()
    class StoppableNode extends LGraphNode {
      onStop = vi.fn()
    }
    const node = new StoppableNode('node')
    graph.add(node)
    const group = addedGroup(graph, toGroupId(808))
    graph.start(10)
    const executionTimer = graph.execution_timer_id
    onTestFinished(() => {
      graph.stop()
      vi.useRealTimers()
    })
    const ydoc = getLayoutStoreYDoc()
    function attemptClear(): void {
      ydoc.off('beforeTransaction', attemptClear)
      graph.clear()
    }
    ydoc.on('beforeTransaction', attemptClear)

    group.pos = [200, 250]

    expect(graph.nodes).toContain(node)
    expect(graph.groups).toContain(group)
    expect(graph.status).toBe(LGraph.STATUS_RUNNING)
    expect(graph.execution_timer_id).toBe(executionTimer)
    expect(node.onStop).not.toHaveBeenCalled()
    expect(group.graph).toBe(graph)
    node.pos = [20, 30]
    expect(
      layoutStore.getNodeLayoutRef(graph.id, node.id).value?.position
    ).toEqual({ x: 20, y: 30 })
  })

  test('keeps node ownership when reentrant removal is rejected', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    graph.add(node)
    const group = addedGroup(graph, toGroupId(809))
    const ydoc = getLayoutStoreYDoc()
    function attemptRemove(): void {
      ydoc.off('beforeTransaction', attemptRemove)
      graph.remove(node)
    }
    ydoc.on('beforeTransaction', attemptRemove)

    group.pos = [200, 250]

    expect(node.graph).toBe(graph)
    expect(graph.nodes).toContain(node)
    node.pos = [20, 30]
    expect(
      layoutStore.getNodeLayoutRef(graph.id, node.id).value?.position
    ).toEqual({ x: 20, y: 30 })
  })

  test('preserves a foreign layout that replaced an attached node', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    graph.add(node)
    const nodes = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('nodes')
    const key = `${graph.rootGraph.id}:${node.id}`
    const foreignNode = new Y.Map<unknown>()
    foreignNode.set('id', node.id)
    foreignNode.set('position', { x: 20, y: 30 })
    foreignNode.set('size', { width: 40, height: 50 })
    foreignNode.set('visible', true)
    foreignNode.set('zIndex', 0)
    foreignNode.set('registrationId', 'foreign-node')
    nodes.set(key, foreignNode)

    node.pos = [200, 300]
    node.size = [400, 500]

    expect([...node.pos]).toEqual([20, 30])
    expect([...node.size]).toEqual([40, 50])
    graph.remove(node)

    expect(nodes.get(key)).toBe(foreignNode)
  })

  test('adding the same node instance twice is idempotent', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')

    expect(graph.add(node)).toBe(node)
    expect(graph.add(node)).toBe(node)

    expect(graph.nodes).toEqual([node])
    expect(
      [...getLayoutStoreYDoc().getMap<Y.Map<unknown>>('nodes').keys()].filter(
        (key) => key.startsWith(`${graph.rootGraph.id}:`)
      )
    ).toHaveLength(1)
  })

  test('rejects a node owned by another graph before mutation', () => {
    const firstGraph = new LGraph()
    const secondGraph = new LGraph()
    const node = new LGraphNode('node')
    firstGraph.add(node)

    expect(() => secondGraph.add(node)).toThrow(/already belongs/)
    expect(node.graph).toBe(firstGraph)
    expect(firstGraph.nodes).toEqual([node])
    expect(secondGraph.nodes).toHaveLength(0)
  })

  test('rolls back node add when reentrant registration is rejected', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(811))
    const node = new LGraphNode('node')
    const originalId = node.id
    const ydoc = getLayoutStoreYDoc()
    function attemptAdd(): void {
      ydoc.off('beforeTransaction', attemptAdd)
      graph.add(node)
    }
    ydoc.on('beforeTransaction', attemptAdd)

    group.pos = [200, 250]

    expect(node.id).toBe(originalId)
    expect(node.graph).toBeNull()
    expect(graph.nodes).not.toContain(node)
    expect(layoutStore.getNodeLayoutRef(graph.id, node.id).value).toBeNull()
  })

  test('rejects ordinary node attachment to an existing layout', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    node.id = toNodeId(812)
    useLayoutMutations().createNode(graph.id, node.id, {})
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    expect(graph.add(node)).toBeUndefined()
    expect(node.graph).toBeNull()
    expect(graph.nodes).not.toContain(node)
    expect(warn).toHaveBeenCalledWith(
      '[LGraph] Node layout registration not applied',
      {
        graphId: graph.id,
        nodeId: toNodeId(812),
        nodeTitle: 'node',
        nodeType: '',
        result: 'no-op'
      }
    )
  })

  test('restores node identity when registration compensation throws', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    const originalId = node.id
    const originalLastNodeId = graph.state.lastNodeId
    const registrationCause = new Error('registration cause')
    const registrationError = new LayoutOperationError(
      'registration failed',
      true,
      { cause: registrationCause }
    )
    const compensationError = new Error('compensation failed')
    const originalApplyOperation = layoutStore.applyOperation.bind(layoutStore)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())
    applyOperation.mockImplementation((operation) => {
      if (operation.type === 'deleteNode') {
        throw compensationError
      }
      const result = originalApplyOperation(operation)
      if (operation.type === 'createNode') {
        throw registrationError
      }
      return result
    })

    let thrown: unknown
    try {
      graph.add(node)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(registrationError)
    expect(thrown).toMatchObject({
      cause: expect.objectContaining({
        errors: [registrationCause, compensationError]
      })
    })
    expect(node.id).toBe(originalId)
    expect(node.graph).toBeNull()
    expect(graph.nodes).not.toContain(node)
    expect(graph.state.lastNodeId).toBe(originalLastNodeId)

    applyOperation.mockRestore()
    expect(graph.add(node)).toBe(node)
    expect(graph.nodes).toEqual([node])
  })

  test('logs compensation failures when registration throws a non-Error', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group', 814)
    const primaryError: unknown = undefined
    const compensationError = new Error('compensation failed')
    const originalApplyOperation = layoutStore.applyOperation.bind(layoutStore)
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockImplementation((operation) => {
        if (operation.type === 'deleteGroup') throw compensationError
        const result = originalApplyOperation(operation)
        if (operation.type === 'createGroup') throw primaryError
        return result
      })
    onTestFinished(() => applyOperation.mockRestore())
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    onTestFinished(() => consoleError.mockRestore())

    let thrown = false
    try {
      attachGroupLayout(graph, group)
    } catch {
      thrown = true
    }

    expect(thrown).toBe(true)
    expect(consoleError).toHaveBeenCalledWith(
      'Layout registration and compensation failed',
      { compensationError, primaryError }
    )
  })

  test('reconciles an empty-token registration after cleanup fails', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group', 816)
    const originalApplyOperation = layoutStore.applyOperation.bind(layoutStore)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    onTestFinished(() => applyOperation.mockRestore())
    applyOperation.mockImplementation((operation) => {
      if (operation.type === 'deleteGroup') throw new Error('cleanup failed')
      const result = originalApplyOperation(operation)
      if (operation.type === 'createGroup') throw new Error('create failed')
      return result
    })

    expect(() => registerGroupLayout(graph, group, '')).toThrow('create failed')
    expect(() => unregisterGroupLayout(graph, group, '')).toThrow(
      'cleanup failed'
    )

    applyOperation.mockRestore()
    expect(registerGroupLayout(graph, group, 'retry')).toBe('applied')
    expect(layoutStore.getRegistrationId('group', graph.id, group.id)).toBe(
      'retry'
    )
  })

  test('keeps a pending orphan after a foreign explicit unregister', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group', 818)
    const originalApplyOperation = layoutStore.applyOperation.bind(layoutStore)
    const applyOperation = vi
      .spyOn(layoutStore, 'applyOperation')
      .mockImplementation((operation) => {
        const result = originalApplyOperation(operation)
        if (operation.type === 'createGroup') throw new Error('create failed')
        return result
      })
    onTestFinished(() => applyOperation.mockRestore())

    expect(() => registerGroupLayout(graph, group, 'A')).toThrow(
      'create failed'
    )
    expect(unregisterGroupLayout(graph, group, 'B')).toBe('no-op')

    applyOperation.mockRestore()
    expect(registerGroupLayout(graph, group, 'retry')).toBe('applied')
    expect(layoutStore.getRegistrationId('group', graph.id, group.id)).toBe(
      'retry'
    )
  })

  test('aborts reentrant configure when layout teardown is rejected', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    graph.add(node)
    const group = addedGroup(graph, toGroupId(810))
    const data = graph.asSerialisable()
    const ydoc = getLayoutStoreYDoc()
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

  test('adopts stored group ownership when configured from serialized data', () => {
    const graph = new LGraph()
    const groupId = toGroupId(811)
    layoutStore.applyOperation({
      actor: 'remote-peer',
      entity: 'group',
      graphId: graph.id,
      groupId,
      layout: {
        id: groupId,
        position: { x: 500, y: 300 },
        size: { width: 400, height: 200 }
      },
      registrationId: 'remote-peer',
      source: LayoutSource.External,
      timestamp: Date.now(),
      type: 'createGroup'
    })
    const data = graph.asSerialisable()
    data.groups = [
      {
        bounding: [100, 100, 300, 150],
        color: '#fff',
        font_size: 24,
        id: groupId,
        title: 'configured'
      }
    ]

    graph.configure(data)

    const [group] = graph.groups
    expect([...group.pos]).toEqual([500, 300])
    expect([...group.size]).toEqual([400, 200])

    group.pos = [600, 300]

    expect(layoutStore.getGroupLayout(graph.id, groupId)?.position).toEqual({
      x: 600,
      y: 300
    })
    expect(layoutStore.getRegistrationId('group', graph.id, groupId)).toBe(
      'remote-peer'
    )
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
    expect(
      layoutStore.getGroupLayout(originalRootId, toGroupId(814))
    ).toBeNull()
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
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())

    expect(() => secondGraph.add(second)).not.toThrow()

    expect(firstGraph.groups).toEqual([first])
    expect(secondGraph.groups).toHaveLength(0)
    expect(first.graph).toBe(firstGraph)
    expect(second.graph).toBeUndefined()
    expect(second.id).toBe(815)
    expect([...second.pos]).toEqual([200, 300])
    expect([...second.size]).toEqual([400, 500])
    expect(firstGraph.state.lastGroupId).toBe(firstLastGroupId)
    expect(secondGraph.state.lastGroupId).toBe(secondLastGroupId)
    expect(warn).toHaveBeenCalledWith(
      '[LGraph] Group layout registration not applied',
      {
        graphId: firstGraph.id,
        groupId: first.id,
        groupTitle: 'second',
        result: 'no-op'
      }
    )
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

    getLayoutStoreYDoc()
      .getMap<Y.Map<unknown>>('groups')
      .get(`${graph.rootGraph.id}:${group.id}`)
      ?.set('rect', [11, 12, 410, 310])

    expect(group.pos).toBe(pos)
    expect(group.size).toBe(size)
    expect([...group.boundingRect]).toEqual([11, 12, 410, 310])
    expect([...pos]).toEqual([11, 12])
    expect([...size]).toEqual([410, 310])
    expect(group.serialize().bounding).toEqual([11, 12, 410, 310])
  })

  test('projects remote geometry into an attached group', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(808))
    const ydoc = getLayoutStoreYDoc()
    const remote = new Y.Doc()
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc))
    const stateVector = Y.encodeStateVector(ydoc)
    const onGeometryChange = vi.fn()
    const stop = layoutStore.onGeometryChange(onGeometryChange)
    onTestFinished(stop)

    remote
      .getMap<Y.Map<unknown>>('groups')
      .get(`${graph.rootGraph.id}:${group.id}`)
      ?.set('rect', [11, 12, 410, 310])
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote, stateVector))

    expect(onGeometryChange).toHaveBeenCalledWith(new Set([graph.rootGraph.id]))
    expect([...group.boundingRect]).toEqual([11, 12, 410, 310])
  })

  test('group collections react to nested bounds updates', () => {
    const graph = new LGraph()
    const group = addedGroup(graph, toGroupId(809))
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
    const ydoc = getLayoutStoreYDoc()
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
    const ydoc = getLayoutStoreYDoc()
    const groups = ydoc.getMap<Y.Map<unknown>>('groups')
    let registeredKey: string | undefined
    const originalTransact = ydoc.transact.bind(ydoc)
    const transact = vi.spyOn(ydoc, 'transact')
    onTestFinished(() => transact.mockRestore())
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

    if (!registeredKey) throw new Error('Expected registered group key')
    const key = registeredKey

    expect(group.graph).toBeUndefined()
    expect(graph.groups).toHaveLength(0)
    expect(graph.state.lastGroupId).toBe(originalLastGroupId)
    const groupId = toGroupId(Number(key.slice(key.lastIndexOf(':') + 1)))
    expect(layoutStore.getGroupLayout(rootGraphId, groupId)).toEqual({
      id: groupId,
      position: { x: 20, y: 30 },
      size: { width: 40, height: 50 }
    })

    const foreignLayout = groups.get(key)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    onTestFinished(() => warn.mockRestore())
    expect(() => graph.add(group)).not.toThrow()
    expect(groups.get(key)).toBe(foreignLayout)
    expect(warn).toHaveBeenCalledWith(
      '[LGraph] Group layout registration not applied',
      {
        graphId: rootGraphId,
        groupId,
        groupTitle: 'group',
        result: 'no-op'
      }
    )
  })

  test('stale registered group writes preserve a foreign replacement', () => {
    const graph = new LGraph()
    const group = new LGraphGroup('group')
    graph.add(group)
    const groups = getLayoutStoreYDoc().getMap<Y.Map<unknown>>('groups')
    const key = `${graph.rootGraph.id}:${group.id}`
    const foreign = new Y.Map<unknown>()
    foreign.set('id', group.id)
    foreign.set('rect', [20, 30, 40, 50])
    foreign.set('registrationId', 'foreign')
    groups.set(key, foreign)

    group.pos = [200, 300]

    expect(groups.get(key)).toBe(foreign)
    expect([...group.pos]).toEqual([20, 30])
  })
})
