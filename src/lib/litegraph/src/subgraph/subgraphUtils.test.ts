import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import type {
  INodeInputSlot,
  INodeOutputSlot,
  Positionable
} from '@/lib/litegraph/src/interfaces'
import type { ResolvedConnection } from '@/lib/litegraph/src/LLink'
import {
  LGraph,
  LGraphGroup,
  LGraphNode,
  LiteGraph,
  LLink,
  Reroute,
  findUsedSubgraphIds,
  getDirectSubgraphIds
} from '@/lib/litegraph/src/litegraph'
import type { UUID } from '@/lib/litegraph/src/litegraph'
import type { SerialisableLLink } from '@/lib/litegraph/src/types/serialisation'
import { toLinkId } from '@/types/linkId'
import { toRerouteId } from '@/types/rerouteId'
import { createMockPositionable } from '@/utils/__tests__/litegraphTestUtils'

import type { SubgraphInput } from './SubgraphInput'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'
import {
  getBoundaryLinks,
  groupResolvedByOutput,
  isNodeSlot,
  isSubgraphInput,
  isSubgraphOutput,
  mapSubgraphInputsAndLinks,
  mapSubgraphOutputsAndLinks,
  multiClone,
  reorderSubgraphInputs,
  splitPositionables
} from './subgraphUtils'

/** Creates a graph with three chained nodes: a -> b -> c. */
function createChainedGraph() {
  const graph = new LGraph()
  const a = new LGraphNode('A')
  a.addOutput('out', 'number')
  const b = new LGraphNode('B')
  b.addInput('in', 'number')
  b.addOutput('out', 'number')
  const c = new LGraphNode('C')
  c.addInput('in', 'number')

  graph.add(a)
  graph.add(b)
  graph.add(c)

  const linkAb = a.connect(0, b, 0)
  const linkBc = b.connect(0, c, 0)
  if (!linkAb || !linkBc) throw new Error('Failed to connect test nodes')

  return { graph, a, b, c, linkAb, linkBc }
}

describe('subgraphUtils', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    resetSubgraphFixtureState()
    vi.restoreAllMocks()
  })

  function makeNode(title: string): LGraphNode {
    const node = new LGraphNode(title)
    node.addInput('in', 'STRING')
    node.addOutput('out', 'STRING')
    return node
  }

  describe('getDirectSubgraphIds', () => {
    it('should return empty set for graph with no subgraph nodes', () => {
      const graph = new LGraph()
      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(0)
    })

    it('should find single subgraph node', () => {
      const graph = new LGraph()
      const subgraph = createTestSubgraph()
      const subgraphNode = createTestSubgraphNode(subgraph)
      graph.add(subgraphNode)

      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(1)
      expect(result.has(subgraph.id)).toBe(true)
    })

    it('should find multiple unique subgraph nodes', () => {
      const graph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Subgraph 1' })
      const subgraph2 = createTestSubgraph({ name: 'Subgraph 2' })

      const node1 = createTestSubgraphNode(subgraph1)
      const node2 = createTestSubgraphNode(subgraph2)

      graph.add(node1)
      graph.add(node2)

      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(2)
      expect(result.has(subgraph1.id)).toBe(true)
      expect(result.has(subgraph2.id)).toBe(true)
    })

    it('should return unique IDs when same subgraph is used multiple times', () => {
      const graph = new LGraph()
      const subgraph = createTestSubgraph()

      const node1 = createTestSubgraphNode(subgraph, { id: 1 })
      const node2 = createTestSubgraphNode(subgraph, { id: 2 })

      graph.add(node1)
      graph.add(node2)

      const result = getDirectSubgraphIds(graph)
      expect(result.size).toBe(1)
      expect(result.has(subgraph.id)).toBe(true)
    })
  })

  describe('findUsedSubgraphIds', () => {
    it('should handle graph with no subgraphs', () => {
      const graph = new LGraph()
      const registry = new Map<UUID, LGraph>()

      const result = findUsedSubgraphIds(graph, registry)
      expect(result.size).toBe(0)
    })

    it('should find nested subgraphs', () => {
      const rootGraph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Level 1' })
      const subgraph2 = createTestSubgraph({ name: 'Level 2' })

      // Add subgraph1 node to root
      const node1 = createTestSubgraphNode(subgraph1)
      rootGraph.add(node1)

      // Add subgraph2 node inside subgraph1
      const node2 = createTestSubgraphNode(subgraph2)
      subgraph1.add(node2)

      const registry = new Map<UUID, LGraph>([
        [subgraph1.id, subgraph1],
        [subgraph2.id, subgraph2]
      ])

      const result = findUsedSubgraphIds(rootGraph, registry)
      expect(result.size).toBe(2)
      expect(result.has(subgraph1.id)).toBe(true)
      expect(result.has(subgraph2.id)).toBe(true)
    })

    it('throws RangeError when graph.add() creates a circular subgraph reference', () => {
      const rootGraph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Subgraph 1' })
      const subgraph2 = createTestSubgraph({ name: 'Subgraph 2' })

      // Add subgraph1 to root
      const node1 = createTestSubgraphNode(subgraph1)
      rootGraph.add(node1)

      // Add subgraph2 to subgraph1
      const node2 = createTestSubgraphNode(subgraph2)
      subgraph1.add(node2)

      // Add subgraph1 to subgraph2 (circular reference)
      // Note: add() itself throws RangeError due to recursive forEachNode
      const node3 = createTestSubgraphNode(subgraph1, { id: 3 })
      expect(() => subgraph2.add(node3)).toThrow(RangeError)
    })

    it('should handle missing subgraphs in registry gracefully', () => {
      const rootGraph = new LGraph()
      const subgraph1 = createTestSubgraph({ name: 'Subgraph 1' })
      const subgraph2 = createTestSubgraph({ name: 'Subgraph 2' })

      // Add both subgraph nodes
      const node1 = createTestSubgraphNode(subgraph1)
      const node2 = createTestSubgraphNode(subgraph2)

      rootGraph.add(node1)
      rootGraph.add(node2)

      // Only register subgraph1
      const registry = new Map<UUID, LGraph>([[subgraph1.id, subgraph1]])

      const result = findUsedSubgraphIds(rootGraph, registry)
      expect(result.size).toBe(2)
      expect(result.has(subgraph1.id)).toBe(true)
      expect(result.has(subgraph2.id)).toBe(true) // Still found, just can't recurse into it
    })

    it('does not revisit subgraphs that were already discovered', () => {
      const rootGraph = new LGraph()
      const shared = createTestSubgraph({ name: 'Shared' })
      const nestedParent = createTestSubgraph({ name: 'Nested parent' })
      rootGraph.add(createTestSubgraphNode(shared))
      rootGraph.add(createTestSubgraphNode(nestedParent))
      nestedParent.add(createTestSubgraphNode(shared))

      const result = findUsedSubgraphIds(
        rootGraph,
        new Map([
          [shared.id, shared],
          [nestedParent.id, nestedParent]
        ])
      )

      expect([...result]).toEqual([shared.id, nestedParent.id])
    })
  })

  describe('splitPositionables', () => {
    it('places each known positionable type into its own set', () => {
      const subgraph = createTestSubgraph({ inputCount: 1, outputCount: 1 })
      const node = new LGraphNode('Node')
      const group = new LGraphGroup('Group')
      const reroute = new Reroute(toRerouteId(1), new LGraph())
      const unknown = fromPartial<Positionable>({ boundingRect: [0, 0, 1, 1] })

      const result = splitPositionables([
        node,
        group,
        reroute,
        subgraph.inputNode,
        subgraph.outputNode,
        unknown
      ])

      expect(result.nodes.has(node)).toBe(true)
      expect(result.groups.has(group)).toBe(true)
      expect(result.reroutes.has(reroute)).toBe(true)
      expect(result.subgraphInputNodes.has(subgraph.inputNode)).toBe(true)
      expect(result.subgraphOutputNodes.has(subgraph.outputNode)).toBe(true)
      expect(result.unknown.has(unknown)).toBe(true)
    })
  })

  describe('getBoundaryLinks', () => {
    it('classifies selected node links by internal and boundary direction', () => {
      const graph = new LGraph()
      const source = makeNode('Source')
      const selected = makeNode('Selected')
      const selectedTarget = makeNode('Selected target')
      const externalTarget = makeNode('External target')
      graph.add(source)
      graph.add(selected)
      graph.add(selectedTarget)
      graph.add(externalTarget)

      const boundaryInput = source.connect(0, selected, 0)!
      const internal = selected.connect(0, selectedTarget, 0)!
      const boundaryOutput = selected.connect(0, externalTarget, 0)!

      const result = getBoundaryLinks(
        graph,
        new Set([selected, selectedTarget])
      )

      expect(result.boundaryInputLinks).toEqual([boundaryInput])
      expect(result.internalLinks).toEqual([internal])
      expect(result.boundaryOutputLinks).toEqual([boundaryOutput])
      expect(result.boundaryLinks).toEqual([])
      expect(result.boundaryFloatingLinks).toEqual([])
    })

    it('ignores unresolved input links and warns with the missing id', () => {
      const graph = new LGraph()
      const node = makeNode('Node')
      graph.add(node)
      node.inputs[0].link = toLinkId(404)
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const result = getBoundaryLinks(graph, new Set([node]))

      expect(result.internalLinks).toEqual([])
      expect(warn).toHaveBeenCalledWith('Failed to resolve link ID [404]')
    })

    it('treats reroutes with outside participants as boundary links', () => {
      const graph = new LGraph()
      const source = makeNode('Source')
      const target = makeNode('Target')
      graph.add(source)
      graph.add(target)
      const link = source.connect(0, target, 0)!
      const reroute = new Reroute(toRerouteId(1), graph, [10, 10], undefined, [
        link.id
      ])
      link.parentId = reroute.id
      graph.reroutes.set(reroute.id, reroute)

      const result = getBoundaryLinks(graph, new Set([reroute]))

      expect(result.boundaryLinks).toEqual([link])
    })

    it('handles unlinked nodes, groups, subgraph-input links, and floating links', () => {
      const graph = new LGraph()
      const selected = makeNode('Selected')
      const group = new LGraphGroup('Group')
      graph.add(selected)
      const subgraphInputLink = new LLink(
        toLinkId(80),
        'STRING',
        SUBGRAPH_INPUT_ID,
        0,
        selected.id,
        0
      )
      graph.links.set(subgraphInputLink.id, subgraphInputLink)
      selected.inputs[0].link = subgraphInputLink.id
      const floatingLink = new LLink(toLinkId(81), 'STRING', 1, 0, 2, 0)
      const outsideReroute = new Reroute(toRerouteId(8), graph, [0, 0])
      floatingLink.parentId = outsideReroute.id
      graph.reroutes.set(outsideReroute.id, outsideReroute)
      selected.outputs[0]._floatingLinks = new Set([floatingLink])

      const result = getBoundaryLinks(graph, new Set([selected, group]))

      expect(result.boundaryInputLinks).toEqual([subgraphInputLink])
      expect(result.boundaryFloatingLinks).toEqual([floatingLink])
      expect(result.boundaryOutputLinks).toEqual([])
    })
  })

  describe('multiClone', () => {
    it('falls back to cloned serialized data when a node type cannot be created', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const node = new LGraphNode('Fallback')
      node.type = 'missing/type'
      node.properties = { nested: { value: 1 } }

      const result = multiClone([node])

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ type: 'missing/type' })
      expect(result[0].properties).toEqual({ nested: { value: 1 } })
      expect(result[0].properties).not.toBe(node.properties)
      expect(warn).toHaveBeenCalledWith('Failed to create node', 'missing/type')
    })
  })

  describe('groupResolvedByOutput', () => {
    it('groups connections by subgraph input before regular output', () => {
      const subgraph = createTestSubgraph({ inputCount: 1 })
      const output = { name: 'out' }
      const first = {
        subgraphInput: subgraph.inputs[0],
        output,
        link: new LLink(toLinkId(1), 'STRING', 1, 0, 2, 0)
      } as ResolvedConnection
      const second = {
        subgraphInput: subgraph.inputs[0],
        link: new LLink(toLinkId(2), 'STRING', 1, 0, 3, 0)
      } as ResolvedConnection

      const result = groupResolvedByOutput([first, second])

      expect(result.get(subgraph.inputs[0])).toEqual([first, second])
      expect(result.has(output)).toBe(false)
    })

    it('keeps unresolved output connections in separate groups', () => {
      const first = {
        link: new LLink(toLinkId(1), 'STRING', 1, 0, 2, 0)
      } as ResolvedConnection
      const second = {
        link: new LLink(toLinkId(2), 'STRING', 1, 0, 3, 0)
      } as ResolvedConnection

      const result = groupResolvedByOutput([first, second])

      expect(result.size).toBe(2)
      expect([...result.values()]).toEqual([[first], [second]])
    })
  })

  describe('mapSubgraphInputsAndLinks', () => {
    it('creates unique input metadata and rewrites link origins', () => {
      const targetInput = makeNode('Target').inputs[0]
      targetInput.localized_name = 'Prompt'
      targetInput.label = 'Prompt label'
      const link = new LLink(toLinkId(1), 'STRING', 10, 0, 20, 0)
      const connection = {
        link,
        input: targetInput
      } as ResolvedConnection
      const links: SerialisableLLink[] = []

      const inputs = mapSubgraphInputsAndLinks([connection], links, new Map())

      expect(inputs).toHaveLength(1)
      expect(inputs[0]).toMatchObject({
        name: 'in',
        localized_name: 'Prompt',
        label: 'Prompt label',
        type: 'STRING',
        linkIds: [toLinkId(1)]
      })
      expect(links[0]).toMatchObject({
        origin_id: SUBGRAPH_INPUT_ID,
        origin_slot: 0,
        target_id: 20,
        target_slot: 0
      })
    })

    it('restores the original link parent while mapping reroutes', () => {
      const targetInput = makeNode('Target').inputs[0]
      const link = new LLink(
        toLinkId(1),
        'STRING',
        10,
        0,
        20,
        0,
        toRerouteId(2)
      )
      const first = new Reroute(
        toRerouteId(1),
        new LGraph(),
        undefined,
        toRerouteId(99)
      )
      const second = new Reroute(
        toRerouteId(2),
        new LGraph(),
        undefined,
        first.id
      )
      const links: SerialisableLLink[] = []

      mapSubgraphInputsAndLinks(
        [{ link, input: targetInput } as ResolvedConnection],
        links,
        new Map([
          [first.id, first],
          [second.id, second]
        ])
      )

      expect(link.parentId).toBe(toRerouteId(99))
      expect(links[0].parentId).toBe(second.id)
      expect(first.parentId).toBeUndefined()
      expect(second.parentId).toBe(first.id)
    })

    it('skips unresolved input connections and uniquifies duplicate names', () => {
      const firstInput = makeNode('First').inputs[0]
      firstInput.localized_name = 'Prompt'
      const secondInput = makeNode('Second').inputs[0]
      secondInput.localized_name = 'Prompt'
      const links: SerialisableLLink[] = []

      const inputs = mapSubgraphInputsAndLinks(
        [
          { link: new LLink(toLinkId(1), 'STRING', 1, 0, 2, 0) },
          {
            link: new LLink(toLinkId(2), 'STRING', 1, 0, 3, 0),
            input: firstInput
          },
          {
            link: new LLink(toLinkId(3), 'STRING', 1, 0, 4, 0),
            input: secondInput
          }
        ] as ResolvedConnection[],
        links,
        new Map()
      )

      expect(inputs.map((input) => input.name)).toEqual(['in', 'in_1'])
      expect(inputs.map((input) => input.localized_name)).toEqual([
        'Prompt',
        'Prompt_1'
      ])
      expect(links.map((link) => link.id)).toEqual([toLinkId(2), toLinkId(3)])
    })
  })

  describe('mapSubgraphOutputsAndLinks', () => {
    it('creates unique output metadata and rewrites link targets', () => {
      const output = makeNode('Source').outputs[0]
      output.type = 'IMAGE'
      output.localized_name = 'Image'
      output.label = 'Image label'
      const link = new LLink(toLinkId(1), 'IMAGE', 10, 0, 20, 0)
      const links: SerialisableLLink[] = []

      const outputs = mapSubgraphOutputsAndLinks(
        [{ link, output } as ResolvedConnection],
        links,
        new Map()
      )

      expect(outputs).toHaveLength(1)
      expect(outputs[0]).toMatchObject({
        name: 'out',
        localized_name: 'Image',
        label: 'Image label',
        type: 'IMAGE',
        linkIds: [toLinkId(1)]
      })
      expect(links[0]).toMatchObject({
        origin_id: 10,
        origin_slot: 0,
        target_id: SUBGRAPH_OUTPUT_ID,
        target_slot: 0
      })
    })

    it('skips unresolved output connections and uniquifies duplicate names', () => {
      const firstOutput = makeNode('First').outputs[0]
      firstOutput.localized_name = 'Image'
      const secondOutput = makeNode('Second').outputs[0]
      secondOutput.localized_name = 'Image'
      const links: SerialisableLLink[] = []

      const outputs = mapSubgraphOutputsAndLinks(
        [
          { link: new LLink(toLinkId(1), 'IMAGE', 1, 0, 2, 0) },
          {
            link: new LLink(toLinkId(2), 'IMAGE', 1, 0, 3, 0),
            output: firstOutput
          },
          {
            link: new LLink(toLinkId(3), 'IMAGE', 1, 0, 4, 0),
            output: secondOutput
          }
        ] as ResolvedConnection[],
        links,
        new Map()
      )

      expect(outputs.map((output) => output.name)).toEqual(['out', 'out_1'])
      expect(outputs.map((output) => output.localized_name)).toEqual([
        'Image',
        'Image_1'
      ])
      expect(links.map((link) => link.id)).toEqual([toLinkId(2), toLinkId(3)])
    })
  })

  describe('reorderSubgraphInputs', () => {
    it('returns when the host has no subgraph', () => {
      expect(() =>
        reorderSubgraphInputs(
          fromPartial<Parameters<typeof reorderSubgraphInputs>[0]>({}),
          []
        )
      ).not.toThrow()
    })

    it('logs and leaves inputs unchanged for invalid permutations', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'first', type: 'STRING' },
          { name: 'second', type: 'STRING' }
        ]
      })
      const host = createTestSubgraphNode(subgraph)
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})

      reorderSubgraphInputs(host, [1, 1])

      expect(subgraph.inputs.map((input) => input.name)).toEqual([
        'first',
        'second'
      ])
      expect(error).toHaveBeenCalledWith(
        'reorderSubgraphInputs: orderedIndices must be a permutation of 0..1',
        [1, 1]
      )
    })

    it('dispatches reorder details when the input order changes', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'first', type: 'STRING' },
          { name: 'second', type: 'STRING' }
        ]
      })
      const host = createTestSubgraphNode(subgraph)
      const dispatch = vi.spyOn(subgraph.events, 'dispatch')

      reorderSubgraphInputs(host, [1, 0])

      expect(dispatch).toHaveBeenCalledWith('inputs-reordered', {
        subgraph,
        oldOrder: expect.any(Array),
        newOrder: expect.any(Array)
      })
      expect(subgraph.inputs.map((input) => input.name)).toEqual([
        'second',
        'first'
      ])
    })

    it('does not dispatch when the input order is unchanged', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'first', type: 'STRING' },
          { name: 'second', type: 'STRING' }
        ]
      })
      const host = createTestSubgraphNode(subgraph)
      subgraph.inputs[0].linkIds.push(toLinkId(404))
      host.inputs[0].link = toLinkId(405)
      const dispatch = vi.spyOn(subgraph.events, 'dispatch')

      reorderSubgraphInputs(host, [0, 1])

      expect(dispatch).not.toHaveBeenCalled()
    })
  })

  describe('slot type guards', () => {
    it('identifies subgraph slots and node slots', () => {
      const subgraph = createTestSubgraph({ inputCount: 1, outputCount: 1 })
      const node = makeNode('Node')

      expect(isSubgraphInput(subgraph.inputs[0])).toBe(true)
      expect(isSubgraphInput(subgraph.outputs[0])).toBe(false)
      expect(isSubgraphOutput(subgraph.outputs[0])).toBe(true)
      expect(isSubgraphOutput(node.outputs[0])).toBe(false)
      expect(isNodeSlot(node.inputs[0])).toBe(true)
      expect(isNodeSlot(node.outputs[0])).toBe(true)
      expect(isNodeSlot(null)).toBe(false)
      expect(isNodeSlot({})).toBe(false)
    })
  })

  describe('splitPositionables', () => {
    it('splits items into typed buckets', () => {
      const { graph, a, linkAb } = createChainedGraph()
      const group = new LGraphGroup('Test Group')
      const reroute = graph.createReroute([0, 0], linkAb)
      if (!reroute) throw new Error('Failed to create reroute')

      const subgraph = createTestSubgraph()
      const unknown = createMockPositionable()

      const result = splitPositionables([
        a,
        group,
        reroute,
        subgraph.inputNode,
        subgraph.outputNode,
        unknown
      ])

      expect(result.nodes).toEqual(new Set([a]))
      expect(result.groups).toEqual(new Set([group]))
      expect(result.reroutes).toEqual(new Set([reroute]))
      expect(result.subgraphInputNodes).toEqual(new Set([subgraph.inputNode]))
      expect(result.subgraphOutputNodes).toEqual(new Set([subgraph.outputNode]))
      expect(result.unknown).toEqual(new Set([unknown]))
    })
  })

  describe('getBoundaryLinks', () => {
    it('classifies links crossing into and out of the item set', () => {
      const { graph, b, linkAb, linkBc } = createChainedGraph()

      const result = getBoundaryLinks(graph, new Set<Positionable>([b]))

      expect(result.boundaryInputLinks.map((l) => l.id)).toEqual([linkAb.id])
      expect(result.boundaryOutputLinks.map((l) => l.id)).toEqual([linkBc.id])
      expect(result.internalLinks).toEqual([])
    })

    it('classifies links between selected nodes as internal', () => {
      const { graph, a, b, linkAb, linkBc } = createChainedGraph()

      const result = getBoundaryLinks(graph, new Set<Positionable>([a, b]))

      expect(result.internalLinks.map((l) => l.id)).toEqual([linkAb.id])
      expect(result.boundaryInputLinks).toEqual([])
      expect(result.boundaryOutputLinks.map((l) => l.id)).toEqual([linkBc.id])
    })

    it('treats subgraph IO links as boundary links', () => {
      const subgraph = createTestSubgraph({
        inputs: [{ name: 'in', type: 'number' }],
        outputs: [{ name: 'out', type: 'number' }]
      })
      const node = new LGraphNode('Inner')
      node.addInput('in', 'number')
      node.addOutput('out', 'number')
      subgraph.add(node)

      subgraph.inputs[0].connect(node.inputs[0], node)
      subgraph.outputs[0].connect(node.outputs[0], node)

      const result = getBoundaryLinks(subgraph, new Set<Positionable>([node]))

      expect(result.boundaryInputLinks).toHaveLength(1)
      expect(result.boundaryOutputLinks).toHaveLength(1)
    })

    it('marks reroute links as boundary when an endpoint is outside the set', () => {
      const { graph, a, b, linkAb } = createChainedGraph()
      const reroute = graph.createReroute([0, 0], linkAb)
      if (!reroute) throw new Error('Failed to create reroute')

      const boundary = getBoundaryLinks(graph, new Set<Positionable>([reroute]))
      expect(boundary.boundaryLinks.map((l) => l.id)).toEqual([linkAb.id])

      const contained = getBoundaryLinks(
        graph,
        new Set<Positionable>([a, b, reroute])
      )
      expect(contained.boundaryLinks).toEqual([])
    })

    it('collects floating links whose reroutes cross the boundary', () => {
      const { graph, a, b, linkAb } = createChainedGraph()
      const reroute = graph.createReroute([0, 0], linkAb)
      if (!reroute) throw new Error('Failed to create reroute')

      // Removing the output side turns the link into a floating link.
      graph.remove(a)
      expect(graph.floatingLinks.size).toBe(1)

      // The floating link's reroute is outside the item set.
      const crossing = getBoundaryLinks(graph, new Set<Positionable>([b]))
      expect(crossing.boundaryFloatingLinks).toHaveLength(1)

      // With the reroute inside the set, the floating link does not cross.
      const contained = getBoundaryLinks(
        graph,
        new Set<Positionable>([b, reroute])
      )
      expect(contained.boundaryFloatingLinks).toEqual([])
    })
  })

  describe('multiClone', () => {
    class CloneTestNode extends LGraphNode {
      constructor() {
        super('CloneTest')
        this.addInput('in', 'number')
      }
    }

    beforeEach(() => {
      LiteGraph.registerNodeType('test/CloneTest', CloneTestNode)
    })

    afterEach(() => {
      LiteGraph.unregisterNodeType('test/CloneTest')
      vi.restoreAllMocks()
    })

    it('clones registered nodes preserving ids', () => {
      const graph = new LGraph()
      const node = LiteGraph.createNode('test/CloneTest')
      if (!node) throw new Error('Failed to create node')
      graph.add(node)

      const cloned = multiClone([node])

      expect(cloned).toHaveLength(1)
      expect(String(cloned[0].id)).toBe(String(node.id))
      expect(cloned[0].type).toBe('test/CloneTest')
    })

    it('falls back to serialised data for unregistered node types', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const graph = new LGraph()
      const node = new LGraphNode('Mystery')
      node.type = 'test/UnregisteredType'
      graph.add(node)

      const cloned = multiClone([node])

      expect(cloned).toHaveLength(1)
      expect(cloned[0].type).toBe('test/UnregisteredType')
      expect(warn).toHaveBeenCalled()
    })
  })

  describe('groupResolvedByOutput', () => {
    it('groups connections sharing an output and isolates unresolvable ones', () => {
      const output = fromPartial<ResolvedConnection['output']>({
        name: 'shared'
      })
      const first = fromPartial<ResolvedConnection>({ output })
      const second = fromPartial<ResolvedConnection>({ output })
      const bySubgraphInput = fromPartial<ResolvedConnection>({
        subgraphInput: fromPartial<SubgraphInput>({ name: 'sub' })
      })
      const unresolvable = fromPartial<ResolvedConnection>({})

      const grouped = groupResolvedByOutput([
        first,
        second,
        bySubgraphInput,
        unresolvable
      ])

      expect(grouped.size).toBe(3)
      expect(grouped.get(output!)).toEqual([first, second])
    })
  })

  describe('mapSubgraphInputsAndLinks', () => {
    function createResolvedInput(
      linkId: number,
      inputOverrides: Record<string, unknown> = {}
    ): { resolved: ResolvedConnection; link: LLink } {
      const link = new LLink(toLinkId(linkId), 'number', 1, 0, 2, 0)
      const resolved = fromPartial<ResolvedConnection>({
        link,
        input: fromPartial<INodeInputSlot>({
          name: 'in',
          type: 'number',
          ...inputOverrides
        }),
        output: fromPartial<INodeOutputSlot>({ name: 'out', type: 'number' })
      })
      return { resolved, link }
    }

    it('creates one subgraph input per distinct output', () => {
      const { resolved } = createResolvedInput(1)
      const links: SerialisableLLink[] = []

      const inputs = mapSubgraphInputsAndLinks([resolved], links, new Map())

      expect(inputs).toHaveLength(1)
      expect(inputs[0].name).toBe('in')
      expect(inputs[0].localized_name).toBeUndefined()
      expect(links).toHaveLength(1)
      expect(links[0].origin_slot).toBe(0)
    })

    it('deduplicates names and localised names across inputs', () => {
      const first = createResolvedInput(1, { localized_name: 'In' })
      const second = createResolvedInput(2, { localized_name: 'In' })
      const links: SerialisableLLink[] = []

      const inputs = mapSubgraphInputsAndLinks(
        [first.resolved, second.resolved],
        links,
        new Map()
      )

      expect(inputs.map((i) => i.name)).toEqual(['in', 'in_1'])
      expect(inputs.map((i) => i.localized_name)).toEqual(['In', 'In_1'])
    })

    it('skips connections without a resolved input', () => {
      const link = new LLink(toLinkId(1), 'number', 1, 0, 2, 0)
      const resolved = fromPartial<ResolvedConnection>({
        link,
        output: fromPartial<INodeOutputSlot>({ name: 'out', type: 'number' })
      })

      const inputs = mapSubgraphInputsAndLinks([resolved], [], new Map())

      expect(inputs).toEqual([])
    })

    it('rewires reroute parents to the last reroute outside the subgraph', () => {
      const { resolved, link } = createResolvedInput(1)
      link.parentId = toRerouteId(10)
      const insideReroute = fromPartial<Reroute>({ parentId: toRerouteId(99) })
      const reroutes = new Map<ReturnType<typeof toRerouteId>, Reroute>([
        [toRerouteId(10), insideReroute]
      ])

      mapSubgraphInputsAndLinks([resolved], [], reroutes)

      // The chain terminated at reroute 99, which is not in the map.
      expect(link.parentId).toBe(toRerouteId(99))
      expect(insideReroute.parentId).toBeUndefined()
    })
  })

  describe('mapSubgraphOutputsAndLinks', () => {
    function createResolvedOutput(
      linkId: number,
      outputOverrides: Record<string, unknown> = {}
    ): { resolved: ResolvedConnection; link: LLink } {
      const link = new LLink(toLinkId(linkId), 'number', 1, 0, 2, 0)
      const resolved = fromPartial<ResolvedConnection>({
        link,
        input: fromPartial<INodeInputSlot>({ name: 'in', type: 'number' }),
        output: fromPartial<INodeOutputSlot>({
          name: 'out',
          type: 'number',
          ...outputOverrides
        })
      })
      return { resolved, link }
    }

    it('creates one subgraph output per distinct output slot', () => {
      const { resolved } = createResolvedOutput(1)
      const links: SerialisableLLink[] = []

      const outputs = mapSubgraphOutputsAndLinks([resolved], links, new Map())

      expect(outputs).toHaveLength(1)
      expect(outputs[0].name).toBe('out')
      expect(outputs[0].localized_name).toBeUndefined()
      expect(links).toHaveLength(1)
      expect(links[0].target_slot).toBe(0)
    })

    it('deduplicates localised names across outputs', () => {
      const first = createResolvedOutput(1, { localized_name: 'Out' })
      const second = createResolvedOutput(2, { localized_name: 'Out' })

      const outputs = mapSubgraphOutputsAndLinks(
        [first.resolved, second.resolved],
        [],
        new Map()
      )

      expect(outputs.map((o) => o.name)).toEqual(['out', 'out_1'])
      expect(outputs.map((o) => o.localized_name)).toEqual(['Out', 'Out_1'])
    })

    it('skips connections without a resolved output', () => {
      const link = new LLink(toLinkId(1), 'number', 1, 0, 2, 0)
      const resolved = fromPartial<ResolvedConnection>({
        link,
        input: fromPartial<INodeInputSlot>({ name: 'in', type: 'number' })
      })

      const outputs = mapSubgraphOutputsAndLinks([resolved], [], new Map())

      expect(outputs).toEqual([])
    })
  })

  describe('reorderSubgraphInputs', () => {
    it('returns silently when the node has no subgraph', () => {
      const subgraphNode = createTestSubgraphNode(createTestSubgraph())
      Object.defineProperty(subgraphNode, 'subgraph', {
        value: undefined,
        configurable: true
      })
      expect(() => reorderSubgraphInputs(subgraphNode, [])).not.toThrow()
    })

    it('rejects indices that are not a permutation', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      const subgraph = createTestSubgraph({ inputCount: 2 })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const originalOrder = subgraph.inputs.map((i) => i.id)

      reorderSubgraphInputs(subgraphNode, [0]) // wrong length
      reorderSubgraphInputs(subgraphNode, [0, 0]) // duplicate
      reorderSubgraphInputs(subgraphNode, [0, 2]) // out of range

      expect(error).toHaveBeenCalledTimes(3)
      expect(subgraph.inputs.map((i) => i.id)).toEqual(originalOrder)
      vi.restoreAllMocks()
    })

    it('does not dispatch an event for an identity permutation', () => {
      const subgraph = createTestSubgraph({ inputCount: 2 })
      const subgraphNode = createTestSubgraphNode(subgraph)
      const listener = vi.fn()
      subgraph.events.addEventListener('inputs-reordered', listener)

      reorderSubgraphInputs(subgraphNode, [0, 1])

      expect(listener).not.toHaveBeenCalled()
    })

    it('reorders slots and updates link slot indices', () => {
      const subgraph = createTestSubgraph({
        inputs: [
          { name: 'alpha', type: 'number' },
          { name: 'beta', type: 'number' }
        ]
      })
      const inner = new LGraphNode('Inner')
      inner.addInput('a', 'number')
      inner.addInput('b', 'number')
      subgraph.add(inner)
      subgraph.inputs[0].connect(inner.inputs[0], inner)
      subgraph.inputs[1].connect(inner.inputs[1], inner)

      const subgraphNode = createTestSubgraphNode(subgraph)
      subgraph.rootGraph.add(subgraphNode)
      const outer = new LGraphNode('Outer')
      outer.addOutput('out', 'number')
      subgraph.rootGraph.add(outer)
      outer.connect(0, subgraphNode, 0)

      const listener = vi.fn()
      subgraph.events.addEventListener('inputs-reordered', listener)

      reorderSubgraphInputs(subgraphNode, [1, 0])

      expect(subgraph.inputs.map((i) => i.name)).toEqual(['beta', 'alpha'])
      // Inner links follow their reordered slots.
      const innerLinkSlots = subgraph.inputs.map((input) =>
        input.linkIds.map((id) => subgraph.getLink(id)?.origin_slot)
      )
      expect(innerLinkSlots).toEqual([[0], [1]])
      // The outer link now targets the moved slot.
      const outerLinkId = subgraphNode.inputs.find(
        (input) => input.link != null
      )?.link
      expect(outerLinkId).not.toBeNull()
      const outerLink = subgraph.rootGraph.getLink(outerLinkId!)
      expect(outerLink?.target_slot).toBe(1)
      expect(listener).toHaveBeenCalledTimes(1)
    })
  })
})
