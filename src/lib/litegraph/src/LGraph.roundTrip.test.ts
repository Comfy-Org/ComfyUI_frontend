import { fromAny } from '@total-typescript/shoehorn'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type { ISerialisedGraph } from '@/lib/litegraph/src/litegraph'

import floatingLink from './__fixtures__/assets/floatingLink.json'
import linkedNodes from './__fixtures__/assets/linkedNodes.json'
import reroutesComplex from './__fixtures__/assets/reroutesComplex.json'

/**
 * Loading a workflow and saving it again must not lose entities.
 *
 * The existing round-trip tests compare a second serialisation to the first,
 * which proves the output is a fixed point but says nothing about whether the
 * *input* survived. These assert the property users actually depend on: open a
 * workflow, save it, and everything you had is still there.
 *
 * Serialisation deliberately normalises — schema version is rewritten and
 * conflicting ids are reassigned — so this compares entity sets rather than
 * bytes. It compares them whole: a count survives an entity being renumbered,
 * repointed at a different slot, or replaced outright.
 *
 * The fixture node types must be registered. Without them `createNode` returns
 * null, every node takes the error branch, and `serialize()` echoes the input
 * object straight back — so the output is derived from the input by
 * construction and no assertion about nodes can fail. `roundTrip` asserts no
 * node carries `has_errors` so that can never silently return.
 */

const FIXTURE_NODE_TYPES = {
  VAEDecode: {
    inputs: [
      ['samples', 'LATENT'],
      ['vae', 'VAE']
    ],
    outputs: [['IMAGE', 'IMAGE']],
    widgets: []
  },
  SaveImage: {
    inputs: [['images', 'IMAGE']],
    outputs: [],
    widgets: [['filename_prefix', 'ComfyUI']]
  },
  InvertMask: {
    inputs: [['mask', 'MASK']],
    outputs: [['MASK', 'MASK']],
    widgets: []
  }
} as const satisfies Record<
  string,
  {
    inputs: readonly (readonly [string, string])[]
    outputs: readonly (readonly [string, string])[]
    widgets: readonly (readonly [string, string])[]
  }
>

const originalNodeTypes = Object.fromEntries(
  Object.keys(FIXTURE_NODE_TYPES).map((type) => [
    type,
    LiteGraph.registered_node_types[type]
  ])
)
const originalFixtureNode = LiteGraph.Nodes.FixtureNode

beforeAll(() => {
  for (const [type, shape] of Object.entries(FIXTURE_NODE_TYPES)) {
    class FixtureNode extends LGraphNode {
      constructor(title?: string) {
        super(title ?? type)
        this.serialize_widgets = true
        for (const [name, slotType] of shape.inputs)
          this.addInput(name, slotType)
        for (const [name, slotType] of shape.outputs)
          this.addOutput(name, slotType)
        for (const [name, value] of shape.widgets)
          this.addWidget('text', name, value, () => {})
      }
    }
    LiteGraph.registerNodeType(type, FixtureNode)
  }
})

afterAll(() => {
  for (const type of Object.keys(FIXTURE_NODE_TYPES)) {
    const originalNodeType = originalNodeTypes[type]
    if (originalNodeType)
      LiteGraph.registered_node_types[type] = originalNodeType
    else delete LiteGraph.registered_node_types[type]
  }

  if (originalFixtureNode) LiteGraph.Nodes.FixtureNode = originalFixtureNode
  else delete LiteGraph.Nodes.FixtureNode
})

interface RoundTripFixture {
  name: string
  graph: ISerialisedGraph
}

const fixtures: RoundTripFixture[] = [
  {
    name: 'linked nodes',
    graph: fromAny<ISerialisedGraph, unknown>(linkedNodes)
  },
  {
    name: 'floating link',
    graph: fromAny<ISerialisedGraph, unknown>(floatingLink)
  },
  {
    name: 'complex reroutes',
    graph: fromAny<ISerialisedGraph, unknown>(reroutesComplex)
  }
]

function roundTrip(source: ISerialisedGraph) {
  const loaded = new LGraph(structuredClone(source))
  expect(loaded.nodes.filter((n) => n.has_errors)).toEqual([])
  const serialized = loaded.serialize()
  loaded.clear()
  return serialized
}

/**
 * Nodes compared whole. By id alone, a regression that drops every input,
 * output, widget value or title still passes.
 */
function nodeKeys(graph: Pick<ISerialisedGraph, 'nodes'>) {
  return (graph.nodes ?? [])
    .map((node) =>
      JSON.stringify({
        id: node.id,
        type: node.type,
        inputs: (node.inputs ?? []).map((i) => [
          i.name,
          i.type,
          i.link ?? null
        ]),
        outputs: (node.outputs ?? []).map((o) => [
          o.name,
          o.type,
          [...(o.links ?? [])].sort(ascending)
        ]),
        widgets_values: node.widgets_values?.length ? node.widgets_values : null
      })
    )
    .sort()
}

function ascending(a: number | string, b: number | string) {
  return String(a).localeCompare(String(b), undefined, { numeric: true })
}

/**
 * Compared whole. Ids alone survive a regression that flattens every
 * `parentId`, empties every `linkIds`, or resets every `pos` — which is most of
 * what the reroute fixture is for.
 */
function rerouteKeys(graph: Pick<ISerialisedGraph, 'extra'>) {
  return (graph.extra?.reroutes ?? [])
    .map((reroute) =>
      JSON.stringify({
        id: reroute.id,
        parentId: reroute.parentId ?? null,
        pos: reroute.pos ?? null,
        linkIds: [...(reroute.linkIds ?? [])].sort(ascending),
        floating: reroute.floating ?? null
      })
    )
    .sort()
}

/**
 * Reroute-to-link association is not on the link in schema 0.4 — `serialize()`
 * rebuilds it into `extra.linkExtensions`, so it needs its own assertion.
 */
function linkExtensionKeys(graph: Pick<ISerialisedGraph, 'extra'>) {
  return (graph.extra?.linkExtensions ?? [])
    .map((ext) =>
      JSON.stringify({ id: ext.id, parentId: ext.parentId ?? null })
    )
    .sort()
}

/**
 * A comparison against an empty collection passes whether or not the code
 * works. Every assertion below runs through this so a fixture that later loses
 * its reroutes degrades into a failure rather than a silent no-op.
 */
function expectPreserved(before: string[], after: string[]) {
  expect(before.length).toBeGreaterThan(0)
  expect(after).toEqual(before)
}

/**
 * Links and groups are compared whole, not counted. A count survives a link
 * being renumbered, repointed at a different slot, or replaced outright.
 */
function linkKeys(graph: Pick<ISerialisedGraph, 'links'>) {
  return (graph.links ?? []).map((link) => JSON.stringify(link)).sort()
}

function floatingLinkKeys(graph: Pick<ISerialisedGraph, 'floatingLinks'>) {
  return (graph.floatingLinks ?? []).map((link) => JSON.stringify(link)).sort()
}

function groupKeys(graph: Pick<ISerialisedGraph, 'groups'>) {
  return (graph.groups ?? [])
    .map(({ id, title, bounding }) => JSON.stringify({ id, title, bounding }))
    .sort()
}

/**
 * Every fixture ships with `groups: []`, so a group assertion against them
 * unmodified compares nothing to nothing.
 */
function withGroups(graph: ISerialisedGraph): ISerialisedGraph {
  return {
    ...structuredClone(graph),
    groups: [
      { id: 1, title: 'first', bounding: [0, 0, 140, 90] },
      { id: 2, title: 'second', bounding: [200, 40, 180, 120] }
    ]
  }
}

describe('LGraph round trip preserves the input', () => {
  for (const { name, graph } of fixtures) {
    describe(name, () => {
      test('keeps every node, whole', () => {
        const before = nodeKeys(graph)
        const after = nodeKeys(roundTrip(graph))

        expectPreserved(before, after)
      })

      test.skipIf(linkKeys(graph).length === 0)(
        'keeps every link, with its endpoints',
        () => {
          expectPreserved(linkKeys(graph), linkKeys(roundTrip(graph)))
        }
      )

      test.skipIf(floatingLinkKeys(graph).length === 0)(
        'keeps every floating link, with its endpoints',
        () => {
          expectPreserved(
            floatingLinkKeys(graph),
            floatingLinkKeys(roundTrip(graph))
          )
        }
      )

      test.skipIf(rerouteKeys(graph).length === 0)(
        'keeps every reroute, with its parent, position and links',
        () => {
          expectPreserved(rerouteKeys(graph), rerouteKeys(roundTrip(graph)))
        }
      )

      test.skipIf(
        linkExtensionKeys(graph).length === 0 || rerouteKeys(graph).length === 0
      )('keeps the reroute-to-link association in extra.linkExtensions', () => {
        expectPreserved(
          linkExtensionKeys(graph),
          linkExtensionKeys(roundTrip(graph))
        )
      })

      test('keeps every group, by identity and bounds', () => {
        const grouped = withGroups(graph)

        expectPreserved(groupKeys(grouped), groupKeys(roundTrip(grouped)))
      })

      test('does not mutate the workflow it was given', () => {
        const untouched = structuredClone(graph)
        const subject = structuredClone(graph)

        new LGraph(subject).serialize()

        expect(subject).toEqual(untouched)
      })

      test('is stable when saved twice', () => {
        const once = roundTrip(graph)
        const twice = new LGraph(structuredClone(once)).serialize()

        expect(twice).toEqual(once)
      })
    })
  }
})
