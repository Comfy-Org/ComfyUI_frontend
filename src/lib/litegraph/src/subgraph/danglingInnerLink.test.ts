import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'

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
import { NodeSlotType } from '@comfyorg/graph-model/globalEnums'
import type {
  ExportedSubgraph,
  ISerialisedNode,
  SerialisableLLink
} from '@comfyorg/graph-model/serialisation'
import { toLinkId } from '@comfyorg/graph-model/linkId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

import {
  createTestRootGraph,
  createTestSubgraphData,
  enableSubgraphNodeCreation,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

const KEPT = 'group.kept'
const DROPPED = 'group.dropped'
const UNREGISTERED_TYPE = 'test/NotInstalled'
const ORPHAN = toLinkId(2)
const SURVIVOR = toLinkId(1)

class DanglingSourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'DanglingSource')
    this.addOutput('out', 'number')
  }

  override onConnectionsChange(): void {}
}

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

class DuplicateNameHostNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'DuplicateNameHost')
    this.addInput(KEPT, 'number')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = (data.inputs ?? []).slice(0, 1)
    super.configure(data)
  }
}

class HookedShrunkHostNode extends ShrunkHostNode {
  override onAfterGraphConfigured(): void {}
}

class EmptyHostNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'EmptyHost')
  }

  override configure(data: ISerialisedNode): void {
    data.inputs = []
    super.configure(data)
  }
}

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

class RenamingSinkNode extends LGraphNode {
  override configure(data: ISerialisedNode): void {
    data.inputs = (data.inputs ?? []).map((input) => ({ ...input, name: 'in' }))
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
  'test/DuplicateNameHost': DuplicateNameHostNode,
  'test/HookedShrunkHost': HookedShrunkHostNode,
  'test/EmptyHost': EmptyHostNode,
  'test/BothSidesShrunk': BothSidesShrunkNode,
  'test/Sink': SinkNode,
  'test/RenamingSink': RenamingSinkNode
}

beforeEach(() => {
  resetSubgraphFixtureState()
  for (const [type, constructor] of Object.entries(TEST_NODE_TYPES)) {
    LiteGraph.registerNodeType(type, constructor)
  }
})

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

function link(
  id: number,
  origin_id: SerialisableLLink['origin_id'],
  origin_slot: number,
  target_id: SerialisableLLink['target_id'],
  target_slot: number
): SerialisableLLink {
  return { id, origin_id, origin_slot, target_id, target_slot, type: 'number' }
}

interface HostOptions {
  hostType: string
  hostInputs?: ISerialisedNode['inputs']
  boundaryOriginSlot?: number
  boundaryLinkIds?: number[]
}

function shrunkHostDefinition({
  hostType,
  hostInputs = [
    { name: KEPT, type: 'number', link: 1 },
    { name: DROPPED, type: 'number', link: 2 }
  ],
  boundaryOriginSlot,
  boundaryLinkIds = [2]
}: HostOptions): ExportedSubgraph {
  const fromBoundary = boundaryOriginSlot !== undefined
  return createTestSubgraphData({
    nodes: [
      serialisedNode(
        1,
        'test/DanglingSource',
        [],
        [{ name: 'out', type: 'number', links: fromBoundary ? [1] : [1, 2] }]
      ),
      serialisedNode(2, hostType, hostInputs, [])
    ],
    links: [
      link(1, 1, 0, 2, 0),
      fromBoundary
        ? link(2, SUBGRAPH_INPUT_ID, boundaryOriginSlot, 2, 1)
        : link(2, 1, 0, 2, 1)
    ],
    inputs: fromBoundary
      ? [
          {
            id: 'boundary',
            name: 'boundary',
            type: 'number',
            linkIds: boundaryLinkIds
          }
        ]
      : []
  })
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
  assert.instanceOf(subgraphNode, SubgraphNode)
  rootGraph.add(subgraphNode)

  return {
    subgraph,
    subgraphNode,
    unpack: () => rootGraph.unpackSubgraph(subgraphNode)
  }
}

function loadHost(options: HostOptions) {
  return loadDefinition(shrunkHostDefinition(options))
}

describe('a node that drops a serialized input on load', () => {
  it('prunes the orphaned link but keeps the one that still resolves', () => {
    const { subgraph } = loadHost({ hostType: 'test/ShrunkHost' })

    expect([...subgraph.links.keys()]).toEqual([SURVIVOR])
    expect(subgraph.links.get(SURVIVOR)?.target_slot).toBe(0)
  })

  it('unpacks afterwards', () => {
    const { unpack } = loadHost({ hostType: 'test/ShrunkHost' })

    expect(unpack()).toBe(true)
  })

  it('prunes every orphaned link when the node drops all of its inputs', () => {
    const { subgraph, unpack } = loadHost({ hostType: 'test/EmptyHost' })

    expect([...subgraph.links.keys()]).toEqual([])
    expect(unpack()).toBe(true)
  })

  it('prunes the second of two same-named inputs when only one is restored', () => {
    const { subgraph } = loadHost({
      hostType: 'test/DuplicateNameHost',
      hostInputs: [
        { name: KEPT, type: 'number', link: 1 },
        { name: KEPT, type: 'number', link: 2 }
      ]
    })

    expect([...subgraph.links.keys()]).toEqual([SURVIVOR])
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
      expect.objectContaining({ id: ORPHAN }),
      expect.objectContaining({ name: 'out' })
    )
  })
})

describe('pruning a link anchored on a subgraph boundary slot', () => {
  it.for([
    { case: 'in range', boundaryOriginSlot: 0, boundaryLinkIds: [2] },
    { case: 'slot out of range', boundaryOriginSlot: 7, boundaryLinkIds: [2] },
    { case: 'id listed twice', boundaryOriginSlot: 0, boundaryLinkIds: [2, 2] }
  ])('clears the pruned id from the boundary slot ($case)', (row) => {
    const { subgraph } = loadHost({ hostType: 'test/ShrunkHost', ...row })

    expect(subgraph.links.has(ORPHAN)).toBe(false)
    expect([...subgraph.inputs[0].linkIds]).toEqual([])
  })
})

describe('links the prune deliberately leaves alone', () => {
  it('keeps a dangling output link on a node whose input also shrank', () => {
    const { subgraph } = loadDefinition(
      createTestSubgraphData({
        nodes: [
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
        links: [
          link(1, 2, 0, 3, 0),
          link(2, 2, 1, 4, 0),
          link(3, 1, 0, 2, 0),
          link(4, 1, 0, 2, 1)
        ]
      })
    )

    expect([...subgraph.links.keys()]).toEqual([
      toLinkId(1),
      toLinkId(2),
      toLinkId(3)
    ])
  })

  it('keeps the links of a node that may lay out inputs in a graph hook', () => {
    const { subgraph } = loadHost({ hostType: 'test/HookedShrunkHost' })

    expect([...subgraph.links.keys()]).toEqual([SURVIVOR, ORPHAN])
  })

  it('keeps a link whose target input still exists under a new name', () => {
    const { subgraph } = loadDefinition(
      createTestSubgraphData({
        nodes: [
          serialisedNode(
            1,
            'test/DanglingSource',
            [],
            [{ name: 'out', type: 'number', links: [] }]
          ),
          serialisedNode(
            2,
            'test/RenamingSink',
            [{ name: 'renamed', type: 'number', link: 5 }],
            []
          )
        ],
        links: [link(5, 1, 3, 2, 0)]
      })
    )

    expect([...subgraph.links.keys()]).toEqual([toLinkId(5)])
  })

  it('keeps the links of an uninstalled node described with no inputs', () => {
    const { subgraph } = loadDefinition(
      createTestSubgraphData({
        nodes: [
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
          serialisedNode(3, UNREGISTERED_TYPE, [], [])
        ],
        links: [
          link(1, 1, 0, 2, 0),
          link(2, 1, 0, 2, 1),
          link(3, 1, 0, 3, 0),
          link(4, 1, 0, 3, 1)
        ]
      })
    )

    expect([...subgraph.links.keys()]).toEqual([
      toLinkId(1),
      toLinkId(3),
      toLinkId(4)
    ])
  })
})

describe('a link whose endpoint node does not exist', () => {
  function definitionWithOutputLink(
    outputLink: SerialisableLLink
  ): ExportedSubgraph {
    return createTestSubgraphData({
      nodes: [
        serialisedNode(
          1,
          'test/DanglingSource',
          [],
          [{ name: 'out', type: 'number', links: [1] }]
        ),
        serialisedNode(
          2,
          'test/Sink',
          [{ name: 'in', type: 'number', link: 1 }],
          []
        )
      ],
      links: [link(1, 1, 0, 2, 0), outputLink],
      outputs: [
        {
          id: 'images',
          name: 'images',
          type: 'number',
          linkIds: [outputLink.id]
        }
      ]
    })
  }

  it('prunes a subgraph output link whose origin node is missing', () => {
    const { subgraph, unpack } = loadDefinition(
      definitionWithOutputLink(link(5, 632, 0, SUBGRAPH_OUTPUT_ID, 0))
    )

    expect([...subgraph.links.keys()]).toEqual([toLinkId(1)])
    expect([...subgraph.outputs[0].linkIds]).toEqual([])
    expect(unpack()).toBe(true)
  })

  it('prunes a link from an out-of-range subgraph input slot', () => {
    const { subgraph } = loadDefinition(
      definitionWithOutputLink(
        link(5, SUBGRAPH_INPUT_ID, 3, SUBGRAPH_OUTPUT_ID, 0)
      )
    )

    expect([...subgraph.links.keys()]).toEqual([toLinkId(1)])
    expect([...subgraph.outputs[0].linkIds]).toEqual([])
  })

  it('prunes a link whose target node is missing', () => {
    const { subgraph } = loadDefinition(
      definitionWithOutputLink(link(5, 1, 0, 404, 0))
    )

    expect([...subgraph.links.keys()]).toEqual([toLinkId(1)])
  })

  it('keeps a healthy subgraph output link', () => {
    const { subgraph } = loadDefinition(
      definitionWithOutputLink(link(5, 1, 0, SUBGRAPH_OUTPUT_ID, 0))
    )

    expect([...subgraph.links.keys()]).toEqual([toLinkId(1), toLinkId(5)])
    expect([...subgraph.outputs[0].linkIds]).toEqual([toLinkId(5)])
  })
})

describe('a nested subgraph node that lost a boundary input', () => {
  function nestedDefinitions(): [ExportedSubgraph, ExportedSubgraph] {
    const inner = createTestSubgraphData({
      name: 'Inner',
      inputs: [{ id: 'kept', name: KEPT, type: 'number', linkIds: [] }]
    })
    const outer = createTestSubgraphData({
      name: 'Outer',
      nodes: [
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
      links: [link(1, 1, 0, 2, 0), link(2, 1, 0, 2, 1)]
    })
    return [inner, outer]
  }

  it('prunes the link its dropped input left behind, and unpacks', () => {
    const rootGraph = createTestRootGraph()
    onTestFinished(enableSubgraphNodeCreation(rootGraph))
    const [, loadedOuter] = rootGraph.createSubgraphs(nestedDefinitions())

    expect(
      loadedOuter.getNodeById(toNodeId(2))?.inputs.map((input) => input.name)
    ).toEqual([KEPT])
    expect([...loadedOuter.links.keys()]).toEqual([SURVIVOR])

    const outerNode = LiteGraph.createNode(loadedOuter.id)
    assert.instanceOf(outerNode, SubgraphNode)
    rootGraph.add(outerNode)

    expect(rootGraph.unpackSubgraph(outerNode)).toBe(true)
  })
})
