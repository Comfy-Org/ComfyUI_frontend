import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  Reroute
} from '@/lib/litegraph/src/litegraph'
import {
  attachGroupLayout,
  attachNodeLayout,
  detachGroupLayout,
  detachNodeLayout,
  detachRerouteLayout,
  materializeRerouteLayout,
  moveNodeLayout,
  moveRerouteLayout,
  registerNodeLayout,
  registerRerouteLayout,
  resizeNodeLayout,
  setGroupBoundsLayout,
  transferNodeLayoutRegistration,
  unregisterAllGraphLayout,
  unregisterGroupLayout,
  unregisterNodeLayout,
  unregisterRerouteLayout
} from '@/renderer/core/layout/operations/graphLayoutRegistration'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { LayoutSource } from '@/renderer/core/layout/types'
import type { LayoutChange } from '@/renderer/core/layout/types'
import { toRerouteId } from '@/types/rerouteId'

describe('graph layout registration contract', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    setActivePinia(createTestingPinia({ stubActions: false }))
    layoutStore.resetForTests()
  })

  function addedNode(graph: LGraph): LGraphNode {
    const node = new LGraphNode('node')
    node.pos = [10, 20]
    node.size = [300, 150]
    graph.add(node)
    return node
  }

  function addedGroup(graph: LGraph): LGraphGroup {
    const group = new LGraphGroup('group')
    group.pos = [30, 40]
    group.size = [500, 250]
    graph.add(group)
    return group
  }

  function addedReroute(graph: LGraph): Reroute {
    return graph.setReroute({ pos: [50, 60], linkIds: [] })
  }

  it('attaching a node allocates complete visible geometry and local state', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const layout = layoutStore.getNodeLayoutRef(graph.id, node.id).value

    expect(layout).toMatchObject({
      bounds: { x: 10, y: 20, width: 300, height: 150 },
      position: { x: 10, y: 20 },
      size: { width: 300, height: 150 },
      visible: true
    })
    expect(layout?.zIndex).toBeTypeOf('number')
    expect(node._layoutRegistered).toBe(true)
    expect(node._geometryVersion + 1).toBe(layoutStore.geometryVersion)
  })

  it('freezes attach collision results for each entity kind', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const group = addedGroup(graph)
    const reroute = addedReroute(graph)

    expect(attachNodeLayout(graph, node, false)).toBe('applied')
    expect(attachGroupLayout(graph, group, false)).toBe('no-op')
    expect(attachGroupLayout(graph, group, true)).toBe('applied')
    expect(
      registerRerouteLayout(graph, reroute, { x: 50, y: 60 }, 'replacement')
    ).toBe('no-op')
  })

  it('freezes missing and mismatched detach results for each entity kind', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    const group = new LGraphGroup('group')
    const reroute = new Reroute(toRerouteId(1), graph, [0, 0])

    expect(unregisterNodeLayout(graph, node)).toBe('no-op')
    expect(unregisterGroupLayout(graph, group)).toBe('no-op')
    expect(unregisterRerouteLayout(graph, reroute)).toBe('no-op')
    expect(unregisterNodeLayout(graph, node, 'mismatch')).toBe('no-op')
    expect(unregisterGroupLayout(graph, group, 'mismatch')).toBe('no-op')
    expect(unregisterRerouteLayout(graph, reroute, 'mismatch')).toBe('no-op')
  })

  it('mutations without local registration are silent no-ops', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    const group = new LGraphGroup('group')
    const reroute = new Reroute(toRerouteId(2), graph, [0, 0])
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')

    moveNodeLayout(node, { x: 1, y: 2 })
    resizeNodeLayout(node, { width: 3, height: 4 })
    setGroupBoundsLayout(graph, group, { x: 1, y: 2 }, { width: 3, height: 4 })
    moveRerouteLayout(graph, reroute, { x: 1, y: 2 })

    expect(applyOperation).not.toHaveBeenCalled()
  })

  it('detaching a node projects store geometry into node._posSize before removal', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    moveNodeLayout(node, { x: 70, y: 80 })
    resizeNodeLayout(node, { width: 90, height: 100 })

    expect(detachNodeLayout(graph, node).result).toBe('applied')

    expect([...node._posSize]).toEqual([70, 80, 90, 100])
    expect(node._layoutRegistered).toBe(false)
  })

  it('detaching a reroute retains its synchronized store position', () => {
    const graph = new LGraph()
    const reroute = addedReroute(graph)
    moveRerouteLayout(graph, reroute, { x: 70, y: 80 })

    expect(detachRerouteLayout(graph, reroute).result).toBe('applied')

    expect([...reroute.pos]).toEqual([70, 80])
  })

  it('detach restore envelopes reinstate geometry and ownership', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const group = addedGroup(graph)
    const reroute = addedReroute(graph)
    const detaches = [
      detachNodeLayout(graph, node),
      detachGroupLayout(graph, group),
      detachRerouteLayout(graph, reroute)
    ]

    expect(detaches.map(({ result }) => result)).toEqual([
      'applied',
      'applied',
      'applied'
    ])
    detaches[1].restore()
    detaches[2].restore()
    detaches[0].restore()

    expect(node._layoutRegistered).toBe(true)
    expect(node._geometryVersion).toBe(layoutStore.geometryVersion)
    expect(detachNodeLayout(graph, node).result).toBe('applied')
    expect(detachGroupLayout(graph, group).result).toBe('applied')
    expect(detachRerouteLayout(graph, reroute).result).toBe('applied')
  })

  it('uses one atomic group bounds operation versus node move and resize', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const group = addedGroup(graph)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')

    setGroupBoundsLayout(graph, group, { x: 1, y: 2 }, { width: 3, height: 4 })
    moveNodeLayout(node, { x: 5, y: 6 })
    resizeNodeLayout(node, { width: 7, height: 8 })

    expect(
      applyOperation.mock.calls.map(([operation]) => operation.type)
    ).toEqual(['setGroupBounds', 'moveNode', 'resizeNode'])
  })

  it('materializes reroutes by adopting existing ownership or creating geometry', () => {
    const graph = new LGraph()
    const owned = new Reroute(toRerouteId(10), graph, [1, 2])
    const replacement = new Reroute(owned.id, graph, [3, 4])
    const created = new Reroute(toRerouteId(11), graph, [5, 6])
    expect(registerRerouteLayout(graph, owned, { x: 1, y: 2 }, 'owner')).toBe(
      'applied'
    )

    expect(materializeRerouteLayout(graph, replacement)).toBe('applied')
    expect(materializeRerouteLayout(graph, created)).toBe('applied')
    expect(
      layoutStore.getRerouteLayout(graph.id, created.id)?.position
    ).toEqual({
      x: 5,
      y: 6
    })
    expect(detachRerouteLayout(graph, replacement).result).toBe('applied')
  })

  it('freezes node transfer outcomes and local flag updates', () => {
    const graph = new LGraph()
    const unowned = new LGraphNode('unowned')
    const node = addedNode(graph)
    const replacement = new LGraphNode('replacement')
    replacement.id = node.id

    expect(transferNodeLayoutRegistration(unowned, replacement)).toBe('no-op')
    expect(transferNodeLayoutRegistration(node, node)).toBe('rejected')
    expect(transferNodeLayoutRegistration(node, replacement)).toBe('applied')
    expect(node._layoutRegistered).toBe(false)
    expect(replacement._layoutRegistered).toBe(true)
    expect(replacement._geometryVersion).toBe(layoutStore.geometryVersion)
  })

  it('batches bulk unregister into one operation batch and one notification per entity', async () => {
    const graph = new LGraph()
    addedNode(graph)
    addedGroup(graph)
    addedReroute(graph)
    const changes: LayoutChange[] = []
    const stop = layoutStore.onChange((change) => changes.push(change))
    onTestFinished(stop)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    const applyOperations = vi.spyOn(layoutStore, 'applyOperations')

    expect(unregisterAllGraphLayout(graph)).toBe('applied')
    await Promise.resolve()

    expect(applyOperation).not.toHaveBeenCalled()
    expect(applyOperations).toHaveBeenCalledOnce()
    expect(
      applyOperations.mock.calls[0][0].map((operation) => operation.type)
    ).toEqual(['deleteNode', 'deleteGroup', 'deleteReroute'])
    expect(changes.map(({ operation }) => operation.type)).toEqual([
      'deleteNode',
      'deleteGroup',
      'deleteReroute'
    ])
  })

  it('emits one operation and notification for detach and restore', async () => {
    const graph = new LGraph()
    const group = addedGroup(graph)
    const changes: LayoutChange[] = []
    const stop = layoutStore.onChange((change) => changes.push(change))
    onTestFinished(stop)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')

    const detach = detachGroupLayout(graph, group)
    detach.restore()
    await Promise.resolve()

    expect(
      applyOperation.mock.calls.map(([operation]) => operation.type)
    ).toEqual(['deleteGroup', 'createGroup'])
    expect(changes.map(({ operation }) => operation.type)).toEqual([
      'deleteGroup',
      'createGroup'
    ])
    expect(changes.every(({ source }) => source === LayoutSource.Canvas)).toBe(
      true
    )
  })

  it('returns rejected when attaching an already-attached node cannot release ownership', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    applyOperation.mockReturnValueOnce('rejected')

    expect(registerNodeLayout(graph, node, 'new-owner')).toBe('rejected')
    expect(node._layoutRegistered).toBe(true)
  })

  it('preserves local ownership after mismatched explicit unregisters', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const group = addedGroup(graph)
    const reroute = addedReroute(graph)

    expect(unregisterNodeLayout(graph, node, 'foreign')).toBe('no-op')
    expect(unregisterGroupLayout(graph, group, 'foreign')).toBe('no-op')
    expect(unregisterRerouteLayout(graph, reroute, 'foreign')).toBe('no-op')
    expect(detachNodeLayout(graph, node).result).toBe('applied')
    expect(detachGroupLayout(graph, group).result).toBe('applied')
    expect(detachRerouteLayout(graph, reroute).result).toBe('applied')
  })
})
