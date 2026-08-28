import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { registerNodeState } from '@/core/graph/nodeShell/nodeShellState'
import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  normalizeConfiguredTopology,
  realignInputLinkSlots
} from '@/lib/litegraph/src/linkDeduplication'
import type {
  ExportedSubgraph,
  ISerialisedNode,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import { useLinkStore } from '@/stores/linkStore'
import { graphScopeOf } from '@/types/graphScopeId'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'
import type { NodeId } from '@/types/nodeId'

const DEFINITION_ORDER = ['in_a', 'in_b', 'in_c']

class ReorderTargetNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'ReorderTarget')
    for (const name of DEFINITION_ORDER) this.addInput(name, 'number')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = [...(data.inputs ?? [])].sort(
      (a, b) =>
        DEFINITION_ORDER.indexOf(a.name) - DEFINITION_ORDER.indexOf(b.name)
    )
    super.configure(data)
  }
}

class SourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Source')
    this.addOutput('out', 'number')
  }
}

const SUBGRAPH_ID = 'ab111111-1111-4111-8111-111111111111'

function shiftedNodesAndLinks(
  sourceId: number,
  targetId: number,
  linkIdOffset = 0
) {
  const [firstLinkId, secondLinkId, thirdLinkId] = [1, 2, 3].map(
    (id) => id + linkIdOffset
  )
  return {
    nodes: [
      {
        id: sourceId,
        type: 'test/RealignSource',
        pos: [0, 0] as [number, number],
        size: [140, 60] as [number, number],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [
          {
            name: 'out',
            type: 'number',
            links: [firstLinkId, secondLinkId, thirdLinkId]
          }
        ],
        properties: {}
      },
      {
        id: targetId,
        type: 'test/RealignTarget',
        pos: [300, 0] as [number, number],
        size: [140, 80] as [number, number],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'in_b', type: 'number', link: firstLinkId },
          { name: 'in_c', type: 'number', link: secondLinkId },
          { name: 'in_a', type: 'number', link: thirdLinkId }
        ],
        outputs: [],
        properties: {}
      }
    ],
    links: [
      {
        id: firstLinkId,
        origin_id: sourceId,
        origin_slot: 0,
        target_id: targetId,
        target_slot: 0,
        type: 'number'
      },
      {
        id: secondLinkId,
        origin_id: sourceId,
        origin_slot: 0,
        target_id: targetId,
        target_slot: 1,
        type: 'number'
      },
      {
        id: thirdLinkId,
        origin_id: sourceId,
        origin_slot: 0,
        target_id: targetId,
        target_slot: 2,
        type: 'number'
      }
    ]
  }
}

/**
 * As {@link shiftedNodesAndLinks}, but `in_a` carries a duplicate link: the
 * link registered first (id 3) is not the id the serialized input references
 * (id 4). Registration rejects 4, so realignment must follow
 * the rejected alias through to the registered link to correct its slot.
 */
function duplicateDriftedNodesAndLinks(sourceId: number, targetId: number) {
  const base = shiftedNodesAndLinks(sourceId, targetId)
  const target = base.nodes[1]
  target.inputs = [
    { name: 'in_b', type: 'number', link: 1 },
    { name: 'in_c', type: 'number', link: 2 },
    { name: 'in_a', type: 'number', link: 4 }
  ]
  base.nodes[0].outputs = [{ name: 'out', type: 'number', links: [1, 2, 3, 4] }]
  base.links.push({
    id: 4,
    origin_id: sourceId,
    origin_slot: 0,
    target_id: targetId,
    target_slot: 2,
    type: 'number'
  })
  return base
}

function repeatedReferenceWorkflow(
  targetSlot: number,
  referenceSlots: readonly number[]
): SerialisableGraph {
  const workflow = savedWorkflow()
  const source = workflow.nodes![0]
  const target = workflow.nodes![1]
  source.outputs = [{ name: 'out', type: 'number', links: [1] }]
  target.inputs = DEFINITION_ORDER.map((name, slot) => ({
    name,
    type: 'number',
    link: referenceSlots.includes(slot) ? 1 : null
  }))
  workflow.links = [
    {
      id: 1,
      origin_id: 1,
      origin_slot: 0,
      target_id: 2,
      target_slot: targetSlot,
      type: 'number'
    }
  ]
  return workflow
}

function emptySubgraphDefinition(): ExportedSubgraph {
  return {
    id: SUBGRAPH_ID,
    version: 1,
    revision: 0,
    state: { lastNodeId: 0, lastLinkId: 0, lastGroupId: 0, lastRerouteId: 0 },
    name: 'Empty Subgraph',
    config: {},
    inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 120, 60] },
    outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [300, 0, 120, 60] },
    inputs: [],
    outputs: [],
    widgets: [],
    nodes: [],
    links: []
  }
}

function subgraphInputFanoutWithRejectedDuplicate(): ExportedSubgraph {
  const subgraph = emptySubgraphDefinition()
  subgraph.state.lastNodeId = 2
  subgraph.state.lastLinkId = 3
  subgraph.inputs = [
    { id: 'input', name: 'input', type: 'number', linkIds: [3] }
  ]
  subgraph.nodes = [1, 2].map((id) => ({
    id,
    type: 'test/RealignTarget',
    pos: [300, id * 100] as [number, number],
    size: [140, 80] as [number, number],
    flags: {},
    order: id,
    mode: 0,
    inputs: [
      { name: 'in_a', type: 'number', link: id === 1 ? 1 : 3 },
      { name: 'in_b', type: 'number', link: null },
      { name: 'in_c', type: 'number', link: null }
    ],
    outputs: [],
    properties: {}
  }))
  subgraph.links = [
    {
      id: 1,
      origin_id: SUBGRAPH_INPUT_ID,
      origin_slot: 0,
      target_id: 1,
      target_slot: 0,
      type: 'number'
    },
    {
      id: 2,
      origin_id: SUBGRAPH_INPUT_ID,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    },
    {
      id: 3,
      origin_id: SUBGRAPH_INPUT_ID,
      origin_slot: 0,
      target_id: 2,
      target_slot: 0,
      type: 'number'
    }
  ]
  return subgraph
}

interface WorkflowOptions {
  duplicate?: boolean
  insideSubgraph?: boolean
  withSubgraphDefinition?: boolean
}

function savedWorkflow({
  duplicate = false,
  insideSubgraph = false,
  withSubgraphDefinition = false
}: WorkflowOptions = {}): SerialisableGraph {
  const id = insideSubgraph
    ? 'ab000000-0000-4000-8000-000000000002'
    : duplicate
      ? 'ab000000-0000-4000-8000-000000000003'
      : 'ab000000-0000-4000-8000-000000000001'
  const contents = duplicate
    ? duplicateDriftedNodesAndLinks(1, 2)
    : shiftedNodesAndLinks(1, 2)
  const definitions = insideSubgraph
    ? {
        subgraphs: [
          {
            ...emptySubgraphDefinition(),
            name: 'Subgraph With Shifted Inputs',
            state: {
              lastNodeId: 20,
              lastLinkId: 3,
              lastGroupId: 0,
              lastRerouteId: 0
            },
            ...shiftedNodesAndLinks(10, 20)
          }
        ]
      }
    : withSubgraphDefinition
      ? { subgraphs: [emptySubgraphDefinition()] }
      : undefined

  return {
    id,
    version: 1,
    revision: 0,
    state: {
      lastNodeId: insideSubgraph ? 0 : 2,
      lastLinkId: duplicate ? 4 : insideSubgraph ? 0 : 3,
      lastGroupId: 0,
      lastRerouteId: 0
    },
    ...(insideSubgraph ? { nodes: [], links: [] } : contents),
    ...(definitions ? { definitions } : {})
  }
}

const LINK_BY_INPUT_NAME: Record<string, number> = {
  in_a: 3,
  in_b: 1,
  in_c: 2
}

function assertLinksRealigned(graph: LGraph, targetNodeId: NodeId) {
  const target = graph.getNodeById(targetNodeId)!
  const linkStore = useLinkStore()

  for (const [slot, input] of target.inputs.entries()) {
    const expectedLinkId = toLinkId(LINK_BY_INPUT_NAME[input.name])
    const link = graph.links.get(expectedLinkId)!

    expect(link.target_slot, `link.target_slot for input ${input.name}`).toBe(
      slot
    )
    expect(
      linkStore.getInputSlotLink(graphScopeOf(graph), target.id, slot)?.id,
      `store registration for input ${input.name} at slot ${slot}`
    ).toBe(expectedLinkId)
  }
}

describe('normalizeConfiguredTopology', () => {
  it('keeps the competing link referenced by the target input', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const data = savedWorkflow()
    const target = data.nodes?.find((node) => node.id === 2)
    if (!target?.inputs || !data.links) throw new Error('Invalid fixture')
    target.inputs[0].link = 2
    data.links[1].origin_id = 99
    data.links[1].target_slot = 0

    const normalized = normalizeConfiguredTopology(data)

    expect(normalized.links?.map((link) => link.id)).toEqual([2, 3])
    expect(normalized.nodes?.[1].inputs?.[0].link).toBe(2)
    expect(console.warn).toHaveBeenCalledWith(
      'Dropping competing link to occupied input 2:0',
      expect.objectContaining({ droppedLinkId: 2, survivorLinkId: 1 })
    )
  })
})

describe('LGraph.configure input slot realignment (#3348)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.registerNodeType('test/RealignSource', SourceNode)
    LiteGraph.registerNodeType('test/RealignTarget', ReorderTargetNode)
  })

  it.for([
    ['root workflow', {}, toNodeId(2)],
    [
      'root workflow cloned for definitions',
      { withSubgraphDefinition: true },
      toNodeId(2)
    ],
    ['subgraph definition', { insideSubgraph: true }, toNodeId(20)]
  ] satisfies [string, WorkflowOptions, NodeId][])(
    're-keys links in %s',
    ([_name, options, targetNodeId]) => {
      const graph = new LGraph()
      graph.configure(savedWorkflow(options))
      const configuredGraph =
        'insideSubgraph' in options && options.insideSubgraph
          ? graph.subgraphs.get(SUBGRAPH_ID)!
          : graph

      assertLinksRealigned(configuredGraph, targetNodeId)
    }
  )

  it('realigns the registered link when a drifted input referenced a rejected alias', () => {
    const graph = new LGraph()
    graph.configure(savedWorkflow({ duplicate: true }))

    expect(graph.links.has(toLinkId(4))).toBe(false)
    assertLinksRealigned(graph, toNodeId(2))
  })

  it('realigns links against a reminted node id', () => {
    const payload = savedWorkflow()
    const graph = new LGraph()
    graph.id = payload.id
    const incumbent = new ReorderTargetNode()
    incumbent.id = toNodeId(2)
    if (!registerNodeState(graph, incumbent)) {
      throw new Error('failed to register incumbent target')
    }
    const contents = shiftedNodesAndLinks(10, 2, 10)
    payload.state = {
      lastNodeId: 10,
      lastLinkId: 13,
      lastGroupId: 0,
      lastRerouteId: 0
    }
    payload.nodes = contents.nodes
    payload.links = contents.links

    graph.configure(payload, true)

    const remintedTargetId = graph.links.get(toLinkId(11))?.target_id
    if (remintedTargetId === undefined) throw new Error('link 11 not found')
    expect(remintedTargetId).not.toBe(toNodeId(2))
    expect(
      [11, 12, 13].map(
        (linkId) => graph.links.get(toLinkId(linkId))?.target_slot
      )
    ).toEqual([1, 2, 0])
    expect(
      [0, 1, 2].map(
        (slot) =>
          useLinkStore().getInputSlotLink(
            graphScopeOf(graph),
            remintedTargetId,
            slot
          )?.id
      )
    ).toEqual([toLinkId(13), toLinkId(11), toLinkId(12)])
  })

  it('maps a rejected subgraph input fanout branch to its exact survivor', () => {
    const workflow = savedWorkflow()
    workflow.nodes = []
    workflow.links = []
    workflow.definitions = {
      subgraphs: [subgraphInputFanoutWithRejectedDuplicate()]
    }

    const graph = new LGraph()
    graph.configure(workflow)

    const subgraph = graph.subgraphs.get(SUBGRAPH_ID)!
    expect(subgraph.inputs[0].linkIds).toEqual([toLinkId(2)])
  })

  it('uses the first slot when one link is referenced by multiple inputs', () => {
    const graph = new LGraph()
    graph.configure(repeatedReferenceWorkflow(2, [0, 1]))

    expect(graph.getLink(toLinkId(1))?.target_slot).toBe(0)
    expect(graph.getNodeById(toNodeId(2))?.getInputLink(0)?.id).toBe(
      toLinkId(1)
    )
  })

  it('preserves the current slot when it is one of multiple references', () => {
    const graph = new LGraph()
    graph.configure(repeatedReferenceWorkflow(2, [0, 2]))

    expect(graph.getLink(toLinkId(1))?.target_slot).toBe(2)
    expect(graph.getNodeById(toNodeId(2))?.getInputLink(2)?.id).toBe(
      toLinkId(1)
    )
  })
})

const SHRUNK_DEFINITION_ORDER = ['in_a', 'in_b']

class DroppedInputTargetNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'DroppedInputTarget')
    for (const name of SHRUNK_DEFINITION_ORDER) this.addInput(name, 'number')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = (data.inputs ?? [])
      .filter((input) => SHRUNK_DEFINITION_ORDER.includes(input.name))
      .sort(
        (a, b) =>
          SHRUNK_DEFINITION_ORDER.indexOf(a.name) -
          SHRUNK_DEFINITION_ORDER.indexOf(b.name)
      )
    super.configure(data)
  }
}

const RENAMED_DEFINITION_ORDER = ['in_a', 'in_b', 'in_c_v2']

class RenamedInputTargetNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'RenamedInputTarget')
    for (const name of RENAMED_DEFINITION_ORDER) this.addInput(name, 'number')
  }

  override configure(data: ISerialisedNode): void {
    super.configure(data)
    for (const input of this.inputs) {
      if (input.name === 'in_c') input.name = 'in_c_v2'
    }
    this.inputs.sort(
      (a, b) =>
        RENAMED_DEFINITION_ORDER.indexOf(a.name) -
        RENAMED_DEFINITION_ORDER.indexOf(b.name)
    )
  }
}

function unmatchedInputNameWorkflow(nodeType: string): SerialisableGraph {
  return {
    id: 'ab000000-0000-4000-8000-000000000004',
    version: 1,
    revision: 0,
    state: { lastNodeId: 2, lastLinkId: 3, lastGroupId: 0, lastRerouteId: 0 },
    nodes: [
      {
        id: 1,
        type: 'test/RealignSource',
        pos: [0, 0],
        size: [140, 60],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [{ name: 'out', type: 'number', links: [1, 2, 3] }],
        properties: {}
      },
      {
        id: 2,
        type: nodeType,
        pos: [300, 0],
        size: [140, 80],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'in_c', type: 'number', link: 3 },
          { name: 'in_a', type: 'number', link: 1 },
          { name: 'in_b', type: 'number', link: 2 }
        ],
        outputs: [],
        properties: {}
      }
    ],
    links: [
      {
        id: 3,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: 'number'
      },
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 1,
        type: 'number'
      },
      {
        id: 2,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 2,
        type: 'number'
      }
    ]
  }
}

function unmatchedInputLinkState(graph: LGraph) {
  const target = graph.getNodeById(toNodeId(2))!
  const serialized = graph.serialize()
  const reloaded = new LGraph()
  reloaded.configure(structuredClone(serialized))
  const reloadedTarget = reloaded.getNodeById(toNodeId(2))!

  return {
    graphLinkIds: [...graph.links.keys()],
    inputLinkIds: target.inputs.map((_, slot) => target.getInputLink(slot)?.id),
    serializedLinkIds: (serialized.links ?? []).map(([id]) => toLinkId(id)),
    reloadedGraphLinkIds: [...reloaded.links.keys()],
    reloadedInputLinkIds: reloadedTarget.inputs.map(
      (_, slot) => reloadedTarget.getInputLink(slot)?.id
    )
  }
}

describe('LGraph.configure realignment with an unmatched input name (#15581)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    LiteGraph.registerNodeType('test/RealignSource', SourceNode)
    LiteGraph.registerNodeType(
      'test/DroppedInputTarget',
      DroppedInputTargetNode
    )
    LiteGraph.registerNodeType(
      'test/RenamedInputTarget',
      RenamedInputTargetNode
    )
  })

  it('realigns siblings when configure drops an input', () => {
    const graph = new LGraph()
    graph.configure(unmatchedInputNameWorkflow('test/DroppedInputTarget'))

    expect(unmatchedInputLinkState(graph)).toEqual({
      graphLinkIds: [toLinkId(1), toLinkId(2)],
      inputLinkIds: [toLinkId(1), toLinkId(2)],
      serializedLinkIds: [toLinkId(1), toLinkId(2)],
      reloadedGraphLinkIds: [toLinkId(1), toLinkId(2)],
      reloadedInputLinkIds: [toLinkId(1), toLinkId(2)]
    })
  })

  it('realigns siblings when configure renames an input', () => {
    const graph = new LGraph()
    graph.configure(unmatchedInputNameWorkflow('test/RenamedInputTarget'))

    expect(unmatchedInputLinkState(graph)).toEqual({
      graphLinkIds: [toLinkId(1), toLinkId(2)],
      inputLinkIds: [toLinkId(1), toLinkId(2), undefined],
      serializedLinkIds: [toLinkId(1), toLinkId(2)],
      reloadedGraphLinkIds: [toLinkId(1), toLinkId(2)],
      reloadedInputLinkIds: [toLinkId(1), toLinkId(2), undefined]
    })
  })

  it('reports no error while realigning around an unmatched name', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})

    const graph = new LGraph()
    graph.configure(unmatchedInputNameWorkflow('test/DroppedInputTarget'))

    expect(error).not.toHaveBeenCalled()
  })
})

describe('realignInputLinkSlots with a rejected batch (#15581)', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('atomically removes an unmatched blocker and moves links', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'number')
    const target = new LGraphNode('Target')
    for (const name of ['p', 'q', 'r']) target.addInput(name, 'number')
    graph.add(source)
    graph.add(target)

    const squatter = source.connect(0, target, 0)!
    const blocked = source.connect(0, target, 1)!
    const free = source.connect(0, target, 2)!
    source.onConnectionsChange = vi.fn()
    target.onConnectionsChange = vi.fn()
    const incrementVersion = vi.spyOn(graph, 'incrementVersion')

    const nodeData = target.serialize()
    nodeData.inputs = [
      { name: 'no_such_input', type: 'number', link: squatter.id },
      { name: 'p', type: 'number', link: blocked.id },
      { name: 'q', type: 'number', link: free.id }
    ]

    realignInputLinkSlots(graph, [[target.id, nodeData]])

    expect({
      graphLinkIds: [...graph.links.keys()],
      inputLinkIds: target.inputs.map(
        (_, slot) =>
          useLinkStore().getInputSlotLink(graphScopeOf(graph), target.id, slot)
            ?.id
      )
    }).toEqual({
      graphLinkIds: [blocked.id, free.id],
      inputLinkIds: [blocked.id, free.id, undefined]
    })
    expect(source.onConnectionsChange).toHaveBeenCalledWith(
      NodeSlotType.OUTPUT,
      0,
      false,
      squatter,
      source.outputs[0]
    )
    expect(target.onConnectionsChange).toHaveBeenCalledWith(
      NodeSlotType.INPUT,
      0,
      false,
      squatter,
      target.inputs[0]
    )
    expect(incrementVersion).toHaveBeenCalledOnce()
  })
})

describe('realignInputLinkSlots', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('rekeys a serialized link', () => {
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'number')
    const target = new LGraphNode('Target')
    target.addInput('first', 'number')
    target.addInput('second', 'number')
    graph.add(source)
    graph.add(target)
    const link = source.connect(0, target, 0)!
    const nodeData = target.serialize()
    nodeData.inputs = [
      { ...nodeData.inputs![0], link: null },
      { ...nodeData.inputs![1], link: link.id }
    ]

    realignInputLinkSlots(graph, [[target.id, nodeData]])

    const store = useLinkStore()
    expect(link.target_slot).toBe(1)
    expect(
      store.getInputSlotLink(graphScopeOf(graph), target.id, 0)
    ).toBeUndefined()
    expect(store.getInputSlotLink(graphScopeOf(graph), target.id, 1)?.id).toBe(
      link.id
    )
  })

  it('rejects all moves when one link cannot be realigned', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const graph = new LGraph()
    const source = new LGraphNode('Source')
    source.addOutput('out', 'number')
    const target = new LGraphNode('Target')
    target.addInput('first', 'number')
    target.addInput('occupied', 'number')
    target.addInput('third', 'number')
    target.addInput('destination', 'number')
    graph.add(source)
    graph.add(target)
    const blocked = source.connect(0, target, 0)!
    source.connect(0, target, 1)
    const movable = source.connect(0, target, 2)!
    const nodeData = target.serialize()
    nodeData.inputs = [
      { ...nodeData.inputs![0], name: 'occupied', link: blocked.id },
      { ...nodeData.inputs![1], name: 'removed', link: null },
      { ...nodeData.inputs![2], link: null },
      { ...nodeData.inputs![3], link: movable.id }
    ]

    realignInputLinkSlots(graph, [[target.id, nodeData]])

    expect(blocked.target_slot).toBe(0)
    expect(movable.target_slot).toBe(2)
    expect(console.error).toHaveBeenCalledWith(
      'Failed to realign input link slots',
      expect.objectContaining({ code: 'occupied-target' })
    )
  })
})
