import { createTestingPinia } from '@pinia/testing'
import { fromPartial } from '@total-typescript/shoehorn'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ISerialisedGraph,
  SerialisableGraph
} from '@/lib/litegraph/src/types/serialisation'
import { toLinkId } from '@/types/linkId'
import { toNodeId } from '@/types/nodeId'

/**
 * A saved workflow carries two views of every connection: the link records in
 * `graph.links`, and the legacy mirrors on the slots (`input.link`,
 * `output.links`). Third-party link-repair tools - rgthree's `link_fixer` is
 * the one with reach - detect a corrupt workflow by finding a disagreement
 * between the two and then write the mirror back.
 *
 * On this branch the mirrors are derived from the records rather than stored
 * (`NodeInputSlot.link` returns `linkIdOf(this)`, and the constructor strips
 * the serialized mirror before `Object.assign`), so a disagreement present in
 * the file does not survive the load: the record wins and the mirror is
 * reconstructed from it. These tests pin that, because it decides what a
 * repair tool can still see.
 *
 * Measured on `main` at 296fc5cd07 with the same fixture, both mirrors keep
 * the corruption through load and through a save/reload round trip. The
 * difference is the branch's, not the fixture's.
 *
 * Arm names match `qa/fixtures/soak-badlinks.json` in the ECS soak plan, which
 * is built on the same three corruptions.
 */

const CORRUPT_WORKFLOW = fromPartial<ISerialisedGraph>({
  last_node_id: 3,
  last_link_id: 99,
  version: 0.4,
  config: {},
  extra: {},
  groups: [],
  nodes: [
    {
      id: 1,
      type: 'source',
      pos: [0, 0],
      size: [140, 60],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      // Arm B: link 3 is a live record out of this slot, but the saved
      // mirror lists only link 2.
      outputs: [
        { name: 'a', type: 'number', links: [2], slot_index: 0 },
        { name: 'b', type: 'number', links: [], slot_index: 1 }
      ]
    },
    {
      id: 2,
      type: 'sink',
      pos: [300, 0],
      size: [140, 60],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [{ name: 'in', type: 'number', link: 2 }],
      outputs: []
    },
    {
      id: 3,
      type: 'sink',
      pos: [300, 120],
      size: [140, 60],
      flags: {},
      order: 2,
      mode: 0,
      // Arm A: link 3 is a live record into this slot, but the saved mirror
      // was nulled.
      inputs: [{ name: 'in', type: 'number', link: null }],
      outputs: []
    }
  ],
  links: [
    [2, 1, 0, 2, 0, 'number'],
    [3, 1, 0, 3, 0, 'number'],
    // Arm C: an orphan record; neither endpoint exists.
    [99, 404, 0, 405, 0, 'number']
  ]
})

class SourceNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'source', 'source')
    this.addOutput('a', 'number')
    this.addOutput('b', 'number')
  }
}

class SinkNode extends LGraphNode {
  constructor(title?: string) {
    super(title ?? 'sink', 'sink')
    this.addInput('in', 'number')
  }
}

function load(data: ISerialisedGraph | SerialisableGraph) {
  const graph = new LGraph()
  graph.configure(structuredClone(data))
  return graph
}

function mirrors(graph: LGraph) {
  return {
    inputOfNode3: graph.getNodeById(toNodeId(3))?.inputs[0]?.link ?? null,
    outputsOfNode1: graph
      .getNodeById(toNodeId(1))
      ?.outputs.map((output) => [...(output.links ?? [])])
  }
}

beforeEach(() => {
  setActivePinia(createTestingPinia({ stubActions: false }))
  LiteGraph.registerNodeType('source', SourceNode)
  LiteGraph.registerNodeType('sink', SinkNode)
})

describe('legacy slot mirrors are rebuilt from link records on load', () => {
  it('rebuilds an input mirror the saved file left null', () => {
    const graph = load(CORRUPT_WORKFLOW)

    expect(graph.links.has(toLinkId(3))).toBe(true)
    expect(mirrors(graph).inputOfNode3).toBe(3)
  })

  it('rebuilds an output mirror the saved file omitted an id from', () => {
    const graph = load(CORRUPT_WORKFLOW)

    expect(mirrors(graph).outputsOfNode1).toEqual([[2, 3], []])
  })

  it('keeps an orphan link record whose endpoints do not exist', () => {
    // The one corruption a repair tool can still find after the load, and the
    // only arm of the soak fixture that still exercises `link_fixer`'s
    // destroy path.
    const graph = load(CORRUPT_WORKFLOW)

    expect(graph.links.has(toLinkId(99))).toBe(true)
  })

  it('persists the rebuilt mirrors through a save and reload', () => {
    const reloaded = load(load(CORRUPT_WORKFLOW).serialize())

    expect(mirrors(reloaded)).toEqual({
      inputOfNode3: 3,
      outputsOfNode1: [[2, 3], []]
    })
  })
})
