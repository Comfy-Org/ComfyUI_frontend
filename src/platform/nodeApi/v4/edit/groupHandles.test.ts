import { assert, beforeEach, describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph
} from '@/lib/litegraph/src/litegraph'
import { createTestSubgraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { ComfyApiHost } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy } from '@/platform/nodeApi/v4/types'

describe('group handles', () => {
  let graph: LGraph | null
  let comfy: Comfy
  let host: ComfyApiHost

  beforeEach(() => {
    graph = new LGraph()
    ;({ comfy, host } = createComfyApi({ getGraph: () => graph }))
  })

  function shown(): LGraph {
    assert(graph)
    return graph
  }

  function addGroup(title: string, [x, y, width, height]: number[]) {
    const group = new LGraphGroup(title)
    group.pos = [x, y]
    group.size = [width, height]
    shown().add(group)
    return group
  }

  function addNode(title: string, x: number, y: number) {
    const node = new LGraphNode(title)
    node.pos = [x, y]
    node.size = [100, 50]
    shown().add(node)
    return node
  }

  it('lists the groups of the graph on screen, in draw order', () => {
    addGroup('First', [0, 0, 300, 300])
    addGroup('Second', [500, 0, 300, 300])

    const groups = comfy.graph.groups()

    expect(groups?.map((group) => group.getTitle())).toEqual([
      'First',
      'Second'
    ])
    expect(Object.isFrozen(groups)).toBe(true)
    expect(comfy.graph.groups()?.[0]).toBe(groups?.[0])
  })

  it('reads a group’s id, title, color and bounds', () => {
    const group = addGroup('Named', [10, 20, 300, 200])
    group.color = '#335'
    const [handle] = comfy.graph.groups() ?? []

    expect(handle.id).toBe(String(group.id))
    expect(handle.isDeleted).toBe(false)
    expect(handle.getTitle()).toBe('Named')
    expect(handle.getColor()).toBe('#335')
    expect(handle.getBounds()).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200
    })
    expect(Object.isFrozen(handle.getBounds())).toBe(true)
    expect(Object.isFrozen(handle)).toBe(true)
  })

  it('gives the nodes whose center is inside it now, as they are moved', () => {
    addGroup('Area', [0, 0, 400, 400])
    const inside = addNode('Inside', 50, 100)
    const edge = addNode('Across the edge', 360, 100)
    addNode('Outside', 600, 100)
    addNode('Top inside, centre below', 50, 400 + 20)
    const [handle] = comfy.graph.groups() ?? []

    expect(handle.nodes()?.map((node) => node.getTitle())).toEqual(['Inside'])

    edge.pos = [250, 100]
    inside.pos = [900, 900]

    expect(handle.nodes()?.map((node) => node.getTitle())).toEqual([
      'Across the edge'
    ])
    expect(Object.isFrozen(handle.nodes())).toBe(true)
  })

  it('counts a node’s title bar when deciding where its center is', () => {
    addGroup('Area', [0, 0, 400, 100])
    addNode('Centre in the group only with its title bar', 50, 100 - 25 + 5)
    const titleBar = LiteGraph.NODE_TITLE_HEIGHT
    const [handle] = comfy.graph.groups() ?? []

    expect(titleBar).toBeGreaterThan(10)
    expect(handle.nodes()).toHaveLength(1)
  })

  it('reads nothing once the group is removed', () => {
    const group = addGroup('Removed', [0, 0, 100, 100])
    const [handle] = comfy.graph.groups() ?? []

    shown().remove(group)

    expect(handle.isDeleted).toBe(true)
    expect(handle.getTitle()).toBeUndefined()
    expect(handle.getColor()).toBeUndefined()
    expect(handle.getBounds()).toBeUndefined()
    expect(handle.nodes()).toBeUndefined()
  })

  it('follows its group through an undo, and is retired when another document loads', () => {
    addGroup('Kept', [0, 0, 100, 100])
    const [handle] = comfy.graph.groups() ?? []

    shown().configure(shown().serialize())
    host.afterHistoryRestore()

    expect(handle.isDeleted).toBe(false)
    expect(handle.getTitle()).toBe('Kept')
    expect(comfy.graph.groups()?.[0]).toBe(handle)

    host.beginDocument()

    expect(handle.isDeleted).toBe(true)
  })

  it('retires the handle of a group an undo removed, so the group that takes its id next gets another', () => {
    const beforeAdding = shown().serialize()
    addGroup('Gone', [0, 0, 100, 100])
    const [handle] = comfy.graph.groups() ?? []

    shown().configure(beforeAdding)
    host.afterHistoryRestore()
    const next = addGroup('New', [0, 0, 100, 100])

    expect(String(next.id)).toBe(handle.id)
    expect(handle.isDeleted).toBe(true)
    expect(comfy.graph.groups()?.[0]).not.toBe(handle)
  })

  it('keeps the handle of a group a restore removed while a later group holds the counter above its id, and reads it when it comes back', () => {
    const group = addGroup('Back', [0, 0, 100, 100])
    addGroup('Later', [200, 0, 100, 100])
    const withGroup = shown().serialize()
    const [handle] = comfy.graph.groups() ?? []
    shown().remove(group)
    const withoutGroup = shown().serialize()

    shown().configure(withoutGroup)
    host.afterHistoryRestore()
    expect(handle.isDeleted).toBe(true)
    shown().configure(withGroup)
    host.afterHistoryRestore()

    expect(handle.isDeleted).toBe(false)
    expect(handle.getTitle()).toBe('Back')
    expect(comfy.graph.groups()?.[0]).toBe(handle)
  })

  it('retires the handle of the newest group a restore removed, whose id the next group takes, since a saved state does not keep the group counter', () => {
    const group = addGroup('Newest', [0, 0, 100, 100])
    const [handle] = comfy.graph.groups() ?? []
    shown().remove(group)

    shown().configure(shown().serialize())
    host.afterHistoryRestore()
    const next = addGroup('Next', [0, 0, 100, 100])

    expect(String(next.id)).toBe(handle.id)
    expect(handle.isDeleted).toBe(true)
  })

  it('lists the groups inside a subgraph through its graph handle', () => {
    const subgraph = createTestSubgraph({ rootGraph: shown() })
    shown().subgraphs.set(subgraph.id, subgraph)
    const inner = new LGraphGroup('Inner group')
    subgraph.add(inner)
    const [scope] = comfy.graph.subgraphs()

    expect(scope.groups()?.map((group) => group.getTitle())).toEqual([
      'Inner group'
    ])
    expect(comfy.graph.root()?.groups()).toEqual([])
  })

  it('has no groups without a graph on screen, or for a graph that is gone', () => {
    const scope = comfy.graph.root()
    host.beginDocument()

    expect(scope?.groups()).toBeUndefined()

    graph = null

    expect(comfy.graph.groups()).toBeUndefined()
  })
})
