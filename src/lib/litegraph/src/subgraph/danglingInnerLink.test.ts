import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest'

import {
  SUBGRAPH_INPUT_ID,
  SUBGRAPH_OUTPUT_ID
} from '@/lib/litegraph/src/constants'
import {
  LGraphNode,
  LiteGraph,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { NodeSlotType } from '@/lib/litegraph/src/types/globalEnums'
import type {
  ExportedSubgraph,
  ISerialisedNode
} from '@/lib/litegraph/src/types/serialisation'
import type { reportError } from '@/platform/telemetry/reportError'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

import {
  createTestRootGraph,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

const mockReportError = vi.hoisted(() => vi.fn<typeof reportError>())
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mockReportError
}))

const KEPT = 'group.kept'
const DROPPED = 'group.dropped'
/** Deliberately never registered, to stand in for an uninstalled custom node. */
const UNREGISTERED_TYPE = 'test/NotInstalled'

class DanglingSourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'DanglingSource')
    this.addOutput('out', 'number')
  }

  override onConnectionsChange(): void {}
}

/** Lays out only `group.kept`, as a dynamic combo's selected option would. */
class ShrunkHostNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'ShrunkHost')
    this.addInput(KEPT, 'number')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = (data.inputs ?? []).filter((input) => input.name === KEPT)
    super.configure(data)
  }
}

/** Lays out no child inputs at all — the shrink-to-zero end of the same path. */
class EmptyHostNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'EmptyHost')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = []
    super.configure(data)
  }
}

/** Declares no slots and is described with none: nothing was ever dropped. */
class OpaqueHostNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'OpaqueHost')
  }
}

/**
 * Drops a serialized input *and* a serialized output. The dropped input is what
 * arms the prune, so the surviving output-side dangler is actually exercised —
 * output slots are never repointed by name, so it must be left alone.
 */
class BothSidesShrunkNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'BothSidesShrunk')
    this.addInput(KEPT, 'number')
    this.addOutput(KEPT, 'number')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = (data.inputs ?? []).filter((input) => input.name === KEPT)
    data.outputs = (data.outputs ?? []).filter((output) => output.name === KEPT)
    super.configure(data)
  }
}

class SinkNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'Sink')
    this.addInput('in', 'number')
  }
}

const TEST_NODE_TYPES = {
  'test/DanglingSource': DanglingSourceNode,
  'test/ShrunkHost': ShrunkHostNode,
  'test/EmptyHost': EmptyHostNode,
  'test/OpaqueHost': OpaqueHostNode,
  'test/BothSidesShrunk': BothSidesShrunkNode,
  'test/Sink': SinkNode
}

beforeEach(() => {
  resetSubgraphFixtureState()
  mockReportError.mockClear()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  for (const [type, constructor] of Object.entries(TEST_NODE_TYPES)) {
    LiteGraph.registerNodeType(type, constructor)
  }
  onTestFinished(() => {
    for (const type of Object.keys(TEST_NODE_TYPES)) {
      delete LiteGraph.registered_node_types[type]
    }
  })
})

let definitionCounter = 0

function nextDefinitionId(): string {
  definitionCounter += 1
  return `ab222222-2222-4222-8222-${String(definitionCounter).padStart(12, '0')}`
}

function serialisedNode(
  id: number,
  type: string,
  inputs: ISerialisedNode['inputs'],
  outputs: ISerialisedNode['outputs']
): ISerialisedNode {
  return {
    id,
    type,
    pos: [id * 100, 0],
    size: [140, 60],
    flags: {},
    order: id,
    mode: 0,
    inputs,
    outputs,
    properties: {}
  }
}

function subgraphShell(
  nodes: ISerialisedNode[],
  links: ExportedSubgraph['links'],
  inputs: ExportedSubgraph['inputs'] = []
): ExportedSubgraph {
  return {
    id: nextDefinitionId(),
    version: 1,
    revision: 0,
    state: { lastNodeId: 9, lastLinkId: 9, lastGroupId: 0, lastRerouteId: 0 },
    name: 'Dangling Inner Link',
    config: {},
    inputNode: { id: SUBGRAPH_INPUT_ID, bounding: [0, 0, 120, 60] },
    outputNode: { id: SUBGRAPH_OUTPUT_ID, bounding: [300, 0, 120, 60] },
    inputs,
    outputs: [],
    widgets: [],
    nodes,
    links
  }
}

interface HostOptions {
  hostType: string
  hostInputs?: ISerialisedNode['inputs']
  /** Anchor the second link on the subgraph's own input instead of the source. */
  fromBoundary?: boolean
  /** Point the boundary end of that link at a slot index that does not exist. */
  boundaryOriginSlot?: number
}

/**
 * A subgraph whose second inner link targets `group.dropped`. `group.kept` sits
 * at the slot it already occupies, so realignment has nothing to move — the
 * case where the orphaned link is never swept up.
 */
function shrunkHostDefinition({
  hostType,
  hostInputs = [
    { name: KEPT, type: 'number', link: 1 },
    { name: DROPPED, type: 'number', link: 2 }
  ],
  fromBoundary = false,
  boundaryOriginSlot = 0
}: HostOptions): ExportedSubgraph {
  return subgraphShell(
    [
      serialisedNode(
        1,
        'test/DanglingSource',
        [],
        [{ name: 'out', type: 'number', links: fromBoundary ? [1] : [1, 2] }]
      ),
      serialisedNode(2, hostType, hostInputs, [])
    ],
    [
      {
        id: 1,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: 'number'
      },
      {
        id: 2,
        origin_id: fromBoundary ? SUBGRAPH_INPUT_ID : 1,
        origin_slot: fromBoundary ? boundaryOriginSlot : 0,
        target_id: 2,
        target_slot: 1,
        type: 'number'
      }
    ],
    fromBoundary
      ? [{ id: 'boundary', name: 'boundary', type: 'number', linkIds: [2] }]
      : []
  )
}

/**
 * Node 2 drops both a serialized input and a serialized output. Link 4 dangles
 * on its missing input; link 2 dangles on its missing *output* while landing on
 * a perfectly good input of node 3.
 */
function bothSidesShrunkDefinition(): ExportedSubgraph {
  return subgraphShell(
    [
      serialisedNode(
        1,
        'test/DanglingSource',
        [],
        [{ name: 'out', type: 'number', links: [3, 4] }]
      ),
      serialisedNode(
        2,
        'test/BothSidesShrunk',
        [
          { name: KEPT, type: 'number', link: 3 },
          { name: DROPPED, type: 'number', link: 4 }
        ],
        [
          { name: KEPT, type: 'number', links: [1] },
          { name: DROPPED, type: 'number', links: [2] }
        ]
      ),
      serialisedNode(
        3,
        'test/Sink',
        [{ name: 'in', type: 'number', link: 1 }],
        []
      ),
      serialisedNode(
        4,
        'test/Sink',
        [{ name: 'in', type: 'number', link: 2 }],
        []
      )
    ],
    [
      {
        id: 3,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 0,
        type: 'number'
      },
      {
        id: 4,
        origin_id: 1,
        origin_slot: 0,
        target_id: 2,
        target_slot: 1,
        type: 'number'
      },
      {
        id: 1,
        origin_id: 2,
        origin_slot: 0,
        target_id: 3,
        target_slot: 0,
        type: 'number'
      },
      {
        id: 2,
        origin_id: 2,
        origin_slot: 1,
        target_id: 4,
        target_slot: 0,
        type: 'number'
      }
    ]
  )
}

/** Node 3's type is never registered; node 2 shrinks so the prune actually runs. */
function uninstalledNodeDefinition(): ExportedSubgraph {
  return subgraphShell(
    [
      serialisedNode(
        1,
        'test/DanglingSource',
        [],
        [{ name: 'out', type: 'number', links: [1, 2, 3, 4] }]
      ),
      serialisedNode(
        2,
        'test/ShrunkHost',
        [
          { name: KEPT, type: 'number', link: 1 },
          { name: DROPPED, type: 'number', link: 2 }
        ],
        []
      ),
      serialisedNode(
        3,
        UNREGISTERED_TYPE,
        [
          { name: 'first', type: 'number', link: 3 },
          { name: 'second', type: 'number', link: 4 }
        ],
        []
      )
    ],
    [1, 2, 3, 4].map((id) => ({
      id,
      origin_id: 1,
      origin_slot: 0,
      target_id: id <= 2 ? 2 : 3,
      target_slot: id % 2 === 1 ? 0 : 1,
      type: 'number'
    }))
  )
}

/**
 * The real in-repo producer: `SubgraphNode._internalConfigureAfterSlots` drops
 * any input without a matching boundary slot, *after* slots materialize and
 * outside `replaceNodeInputs`, so its link is never disconnected. Here the
 * outer definition's nested node still lists an input the inner definition no
 * longer exposes.
 */
function nestedDefinitions(): [ExportedSubgraph, ExportedSubgraph] {
  const inner: ExportedSubgraph = {
    ...subgraphShell([], []),
    name: 'Inner',
    inputs: [{ id: 'kept', name: KEPT, type: 'number', linkIds: [] }]
  }
  const outer: ExportedSubgraph = {
    ...subgraphShell(
      [
        serialisedNode(
          1,
          'test/DanglingSource',
          [],
          [{ name: 'out', type: 'number', links: [1, 2] }]
        ),
        serialisedNode(
          2,
          inner.id,
          [
            { name: KEPT, type: 'number', link: 1 },
            { name: DROPPED, type: 'number', link: 2 }
          ],
          []
        )
      ],
      [
        {
          id: 1,
          origin_id: 1,
          origin_slot: 0,
          target_id: 2,
          target_slot: 0,
          type: 'number'
        },
        {
          id: 2,
          origin_id: 1,
          origin_slot: 0,
          target_id: 2,
          target_slot: 1,
          type: 'number'
        }
      ]
    ),
    name: 'Outer'
  }
  return [inner, outer]
}

function loadDefinition(definition: ExportedSubgraph): {
  subgraph: Subgraph
  subgraphNode: SubgraphNode
  unpack: () => boolean
} {
  const rootGraph = createTestRootGraph()
  onTestFinished(enableSubgraphNodeCreation(rootGraph))

  const subgraph = rootGraph.createSubgraph(definition)
  const subgraphNode = LiteGraph.createNode(subgraph.id)
  if (!(subgraphNode instanceof SubgraphNode))
    throw new Error('Subgraph node type was not registered')
  rootGraph.add(subgraphNode)

  return {
    subgraph,
    subgraphNode,
    unpack: () => rootGraph.unpackSubgraph(subgraphNode)
  }
}

const loadHost = (options: HostOptions) =>
  loadDefinition(shrunkHostDefinition(options))

describe('a node that drops a serialized input on load', () => {
  it('prunes the orphaned link but keeps the one that still resolves', () => {
    const { subgraph } = loadHost({ hostType: 'test/ShrunkHost' })

    expect(subgraph.links.has(toLinkId(2))).toBe(false)
    expect(subgraph.links.get(toLinkId(1))?.target_slot).toBe(0)
  })

  it('unpacks without reporting an unresolvable inner link', () => {
    const { unpack } = loadHost({ hostType: 'test/ShrunkHost' })

    expect(unpack()).toBe(true)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('materializes the inner nodes into the parent graph on unpack', () => {
    const { subgraphNode, unpack } = loadHost({ hostType: 'test/ShrunkHost' })
    const rootGraph = subgraphNode.graph!

    unpack()

    expect(rootGraph.getNodeById(subgraphNode.id)).toBeNull()
    expect(rootGraph.nodes.map((node) => node.constructor.name).sort()).toEqual(
      ['DanglingSourceNode', 'ShrunkHostNode']
    )
  })

  it('prunes every orphaned link when the node drops all of its inputs', () => {
    const { subgraph, unpack } = loadHost({ hostType: 'test/EmptyHost' })

    expect([...subgraph.links.keys()]).toEqual([])
    expect(unpack()).toBe(true)
    expect(mockReportError).not.toHaveBeenCalled()
  })

  it('tells the surviving origin its connection went away', () => {
    const onConnectionsChange = vi.spyOn(
      DanglingSourceNode.prototype,
      'onConnectionsChange'
    )

    loadHost({ hostType: 'test/ShrunkHost' })

    expect(onConnectionsChange).toHaveBeenCalledWith(
      NodeSlotType.OUTPUT,
      0,
      false,
      expect.objectContaining({ id: toLinkId(2) }),
      expect.objectContaining({ name: 'out' })
    )
  })
})

describe('pruning a link anchored on a subgraph boundary slot', () => {
  it('clears the pruned id from the boundary slot', () => {
    const { subgraph } = loadHost({
      hostType: 'test/ShrunkHost',
      fromBoundary: true
    })
    const [boundaryInput] = subgraph.inputs

    expect(subgraph.links.has(toLinkId(2))).toBe(false)
    expect([...boundaryInput.linkIds]).toEqual([])
    expect(boundaryInput.isConnected).toBe(false)
  })

  it('serializes no boundary link id that the link map lacks', () => {
    const { subgraph } = loadHost({
      hostType: 'test/ShrunkHost',
      fromBoundary: true
    })

    const serialised = subgraph.asSerialisable()
    const serialisedLinkIds = new Set(
      (serialised.links ?? []).map((link) => link.id)
    )
    const danglingBoundaryIds = (serialised.inputs ?? []).flatMap((input) =>
      (input.linkIds ?? []).filter((id) => !serialisedLinkIds.has(id))
    )

    expect(danglingBoundaryIds).toEqual([])
  })

  it('still clears the id when the boundary slot index is out of range', () => {
    const { subgraph } = loadHost({
      hostType: 'test/ShrunkHost',
      fromBoundary: true,
      boundaryOriginSlot: 7
    })
    const [boundaryInput] = subgraph.inputs

    expect(subgraph.links.has(toLinkId(2))).toBe(false)
    expect([...boundaryInput.linkIds]).toEqual([])
  })
})

describe('links the prune deliberately leaves alone', () => {
  it('keeps a dangling output link on a node whose input also shrank', () => {
    const { subgraph } = loadDefinition(bothSidesShrunkDefinition())
    const host = subgraph.getNodeById(toNodeId(2))

    expect(host?.inputs.map((input) => input.name)).toEqual([KEPT])
    expect(host?.outputs.map((output) => output.name)).toEqual([KEPT])
    expect(subgraph.links.has(toLinkId(4))).toBe(false)
    expect([...subgraph.links.keys()].sort((a, b) => a - b)).toEqual([
      toLinkId(1),
      toLinkId(2),
      toLinkId(3)
    ])
  })

  it('keeps the links of an uninstalled node type', () => {
    const { subgraph } = loadDefinition(uninstalledNodeDefinition())

    expect(subgraph.links.has(toLinkId(2))).toBe(false)
    expect(
      subgraph.getNodeById(toNodeId(3))?.inputs.map((i) => i.name)
    ).toEqual(['first', 'second'])
    expect(subgraph.links.has(toLinkId(3))).toBe(true)
    expect(subgraph.links.has(toLinkId(4))).toBe(true)
  })

  it('keeps them when the workflow described the node no inputs', () => {
    const { subgraph } = loadHost({
      hostType: 'test/OpaqueHost',
      hostInputs: []
    })

    expect(subgraph.getNodeById(toNodeId(2))?.inputs).toEqual([])
    expect([...subgraph.links.keys()]).toEqual([toLinkId(1), toLinkId(2)])
  })
})

describe('a nested subgraph node that lost a boundary input', () => {
  it('prunes the link its dropped input left behind', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const [inner, outer] = nestedDefinitions()

    const [, loadedOuter] = rootGraph.createSubgraphs([inner, outer])

    expect(
      loadedOuter.getNodeById(toNodeId(2))?.inputs.map((input) => input.name)
    ).toEqual([KEPT])
    expect([...loadedOuter.links.keys()]).toEqual([toLinkId(1)])
  })

  it('unpacks afterwards without reporting an unresolvable inner link', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const [inner, outer] = nestedDefinitions()
    const [, loadedOuter] = rootGraph.createSubgraphs([inner, outer])

    const outerNode = LiteGraph.createNode(loadedOuter.id)
    if (!(outerNode instanceof SubgraphNode))
      throw new Error('Subgraph node type was not registered')
    rootGraph.add(outerNode)

    expect(rootGraph.unpackSubgraph(outerNode)).toBe(true)
    expect(mockReportError).not.toHaveBeenCalled()
  })
})

describe('a boundary slot carrying the pruned id twice', () => {
  it('leaves no copy of it behind', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const definition = shrunkHostDefinition({
      hostType: 'test/ShrunkHost',
      fromBoundary: true
    })
    definition.inputs = [
      { id: 'boundary', name: 'boundary', type: 'number', linkIds: [2, 2] }
    ]

    const subgraph = rootGraph.createSubgraph(definition)
    const [boundaryInput] = subgraph.inputs

    expect(subgraph.links.has(toLinkId(2))).toBe(false)
    expect([...boundaryInput.linkIds]).toEqual([])
    expect(boundaryInput.isConnected).toBe(false)
  })
})
