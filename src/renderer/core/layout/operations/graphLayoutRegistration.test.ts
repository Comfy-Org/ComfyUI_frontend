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
  attachLayout,
  detachLayout,
  materializeRerouteLayout,
  moveLayout,
  resizeLayout,
  setBoundsLayout,
  transferLayoutRegistration,
  unregisterAllGraphLayout
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

    expect(attachLayout(graph, 'node', node, { adoptExisting: false })).toBe(
      'applied'
    )
    expect(attachLayout(graph, 'group', group)).toBe('no-op')
    expect(attachLayout(graph, 'group', group, { adoptExisting: true })).toBe(
      'applied'
    )
    expect(
      attachLayout(graph, 'reroute', reroute, {
        position: { x: 50, y: 60 }
      })
    ).toBe('no-op')
  })

  it('returns no-op when detaching instances that were never attached', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    const group = new LGraphGroup('group')
    const reroute = new Reroute(toRerouteId(1), graph, [0, 0])

    expect(detachLayout(graph, 'node', node).result).toBe('no-op')
    expect(detachLayout(graph, 'group', group).result).toBe('no-op')
    expect(detachLayout(graph, 'reroute', reroute).result).toBe('no-op')
  })

  it('mutations without local registration are silent no-ops', () => {
    const graph = new LGraph()
    const node = new LGraphNode('node')
    const group = new LGraphGroup('group')
    const reroute = new Reroute(toRerouteId(2), graph, [0, 0])
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')

    moveLayout(graph, 'node', node, { x: 1, y: 2 })
    resizeLayout(node, { width: 3, height: 4 })
    setBoundsLayout(graph, group, { x: 1, y: 2 }, { width: 3, height: 4 })
    moveLayout(graph, 'reroute', reroute, { x: 1, y: 2 })

    expect(applyOperation).not.toHaveBeenCalled()
  })

  it('detaching a node projects store geometry into node._posSize before removal', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    moveLayout(graph, 'node', node, { x: 70, y: 80 })
    resizeLayout(node, { width: 90, height: 100 })

    expect(detachLayout(graph, 'node', node).result).toBe('applied')

    expect([...node._posSize]).toEqual([70, 80, 90, 100])
    expect(node._layoutRegistered).toBe(false)
  })

  it('detaching a reroute retains its synchronized store position', () => {
    const graph = new LGraph()
    const reroute = addedReroute(graph)
    moveLayout(graph, 'reroute', reroute, { x: 70, y: 80 })

    expect(detachLayout(graph, 'reroute', reroute).result).toBe('applied')

    expect([...reroute.pos]).toEqual([70, 80])
  })

  it('detach restore envelopes reinstate geometry and attachment', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const group = addedGroup(graph)
    const reroute = addedReroute(graph)
    const detaches = [
      detachLayout(graph, 'node', node),
      detachLayout(graph, 'group', group),
      detachLayout(graph, 'reroute', reroute)
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
    expect(detachLayout(graph, 'node', node).result).toBe('applied')
    expect(detachLayout(graph, 'group', group).result).toBe('applied')
    expect(detachLayout(graph, 'reroute', reroute).result).toBe('applied')
  })

  it('uses one atomic group bounds operation versus node move and resize', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const group = addedGroup(graph)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')

    setBoundsLayout(graph, group, { x: 1, y: 2 }, { width: 3, height: 4 })
    moveLayout(graph, 'node', node, { x: 5, y: 6 })
    resizeLayout(node, { width: 7, height: 8 })

    expect(
      applyOperation.mock.calls.map(([operation]) => operation.type)
    ).toEqual(['setGroupBounds', 'moveNode', 'resizeNode'])
  })

  it('materializes reroutes by adopting existing layout or creating geometry', () => {
    const graph = new LGraph()
    const owned = new Reroute(toRerouteId(10), graph, [1, 2])
    const replacement = new Reroute(owned.id, graph, [3, 4])
    const created = new Reroute(toRerouteId(11), graph, [5, 6])
    expect(
      attachLayout(graph, 'reroute', owned, {
        position: { x: 1, y: 2 }
      })
    ).toBe('applied')

    expect(materializeRerouteLayout(graph, replacement)).toBe('applied')
    expect(materializeRerouteLayout(graph, created)).toBe('applied')
    expect(
      layoutStore.getRerouteLayout(graph.id, created.id)?.position
    ).toEqual({
      x: 5,
      y: 6
    })
    expect(detachLayout(graph, 'reroute', replacement).result).toBe('applied')
  })

  it('freezes node transfer outcomes and local flag updates', () => {
    const graph = new LGraph()
    const unowned = new LGraphNode('unowned')
    const node = addedNode(graph)
    const replacement = new LGraphNode('replacement')
    replacement.id = node.id

    expect(transferLayoutRegistration(unowned, replacement)).toBe('no-op')
    expect(transferLayoutRegistration(node, node)).toBe('rejected')
    expect(transferLayoutRegistration(node, replacement)).toBe('applied')
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

    const detach = detachLayout(graph, 'group', group)
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

  it('returns rejected when an already-attached node cannot detach', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')
    applyOperation.mockReturnValueOnce('rejected')

    expect(
      attachLayout(graph, 'node', node, {
        adoptExisting: false
      })
    ).toBe('rejected')
    expect(node._layoutRegistered).toBe(true)
  })

  it('returns no-op when detaching already-detached instances', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const group = addedGroup(graph)
    const reroute = addedReroute(graph)

    expect(detachLayout(graph, 'node', node).result).toBe('applied')
    expect(detachLayout(graph, 'group', group).result).toBe('applied')
    expect(detachLayout(graph, 'reroute', reroute).result).toBe('applied')
    expect(detachLayout(graph, 'node', node).result).toBe('no-op')
    expect(detachLayout(graph, 'group', group).result).toBe('no-op')
    expect(detachLayout(graph, 'reroute', reroute).result).toBe('no-op')
  })

  it('restores local attachment when a reentrant detach is rejected', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const other = addedNode(graph)
    let reentrant: ReturnType<typeof detachLayout>['result'] | undefined
    const stop = layoutStore.onNodeChange(graph.id, node.id, () => {
      reentrant ??= detachLayout(graph, 'node', other).result
    })
    onTestFinished(stop)

    expect(detachLayout(graph, 'node', node).result).toBe('applied')
    expect(reentrant).toBe('rejected')
    expect(other._layoutRegistered).toBe(true)
    expect(
      layoutStore.getNodeLayoutRef(graph.id, other.id).value
    ).not.toBeNull()
    expect(detachLayout(graph, 'node', other).result).toBe('applied')
  })

  it('blocks reentrant replacement adoption while a detach is in flight', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const replacement = new LGraphNode('replacement')
    replacement.id = node.id
    let reentrant: ReturnType<typeof transferLayoutRegistration> | undefined
    const stop = layoutStore.onNodeChange(graph.id, node.id, () => {
      reentrant ??= transferLayoutRegistration(node, replacement)
    })
    onTestFinished(stop)

    expect(detachLayout(graph, 'node', node).result).toBe('applied')
    expect(reentrant).toBe('no-op')
    expect(replacement._layoutRegistered).toBe(false)
    expect(layoutStore.getNodeLayoutRef(graph.id, node.id).value).toBeNull()
  })

  it('does not restore a detach that was already detached', () => {
    const graph = new LGraph()
    const node = addedNode(graph)
    const applyOperation = vi.spyOn(layoutStore, 'applyOperation')

    expect(detachLayout(graph, 'node', node).result).toBe('applied')
    const detach = detachLayout(graph, 'node', node)
    expect(detach.result).toBe('no-op')
    applyOperation.mockClear()

    detach.restore()

    expect(applyOperation).not.toHaveBeenCalled()
    expect(layoutStore.getNodeLayoutRef(graph.id, node.id).value).toBeNull()
  })
})
