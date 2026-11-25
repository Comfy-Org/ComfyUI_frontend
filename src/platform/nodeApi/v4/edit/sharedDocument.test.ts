import {
  assert,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished
} from 'vitest'

import { registerDocBoundRootGraphProbe } from '@/lib/litegraph/src/docBoundGraphs'
import { onGraphIntent } from '@/lib/litegraph/src/graphIntents'
import type { GraphIntentEvent } from '@/lib/litegraph/src/graphIntents'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode,
  enableSubgraphNodeCreation
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import type { Comfy, NodeHandle } from '@/platform/nodeApi/v4/types'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

interface Pair {
  source: NodeHandle
  target: NodeHandle
}

const EDITS_WITHOUT_INTENT: readonly [
  string,
  (pair: Pair) => unknown,
  false | undefined
][] = [
  [
    'an input modify',
    ({ target }) => target.inputs.at(0)?.modify({ label: 'L' }),
    false
  ],
  [
    'an output modify',
    ({ source }) => source.outputs.at(0)?.modify({ name: 'renamed' }),
    false
  ],
  ['inputs.add', ({ target }) => target.inputs.add('extra', 'INT'), undefined],
  [
    'outputs.add',
    ({ source }) => source.outputs.add('extra', 'INT'),
    undefined
  ],
  ['inputs.remove', ({ target }) => target.inputs.remove('b'), false],
  ['outputs.remove', ({ source }) => source.outputs.remove('b'), false],
  ['inputs.reorder', ({ target }) => target.inputs.reorder(['b', 'a']), false],
  [
    'outputs.reorder',
    ({ source }) => source.outputs.reorder(['b', 'a']),
    false
  ],
  [
    'moveLinksTo',
    ({ source }) => source.outputs.at(0)?.moveLinksTo('b'),
    undefined
  ]
]

describe('edits on a graph bound to a shared document', () => {
  let root: LGraph
  let shown: LGraph
  let comfy: Comfy
  let steps: string[]
  let boundRootGraphId: string | null

  beforeEach(() => {
    root = new LGraph()
    shown = root
    steps = []
    boundRootGraphId = null
    ;({ comfy } = createComfyApi({
      getGraph: () => shown,
      history: () => ({
        beforeChange: () => steps.push('before'),
        afterChange: () => steps.push('after')
      })
    }))
    onTestFinished(registerDocBoundRootGraphProbe(() => boundRootGraphId))
  })

  function wiredPair(graph: LGraph): Pair {
    const source = new LGraphNode('Source')
    source.addOutput('a', 'INT')
    source.addOutput('b', 'INT')
    const target = new LGraphNode('Target')
    target.addInput('a', 'INT')
    target.addInput('b', 'INT')
    graph.add(source)
    graph.add(target)
    source.connect(0, target, 0)
    const scope = [comfy.graph.root(), ...comfy.graph.subgraphs()].find(
      (candidate) => candidate?.id === graph.id
    )
    const sourceHandle = scope?.node(String(source.id))
    const targetHandle = scope?.node(String(target.id))
    assert(sourceHandle && targetHandle)
    return { source: sourceHandle, target: targetHandle }
  }

  function subgraphInterior(): LGraph {
    const subgraph = createTestSubgraph({ rootGraph: root })
    root.subgraphs.set(subgraph.id, subgraph)
    root.add(createTestSubgraphNode(subgraph, { parentGraph: root }))
    return subgraph
  }

  it.for(EDITS_WITHOUT_INTENT)(
    'refuses %s, changing nothing and making no undo step',
    ([, edit, refused]) => {
      const pair = wiredPair(root)
      boundRootGraphId = root.id
      const saved = JSON.stringify(root.serialize())
      const version = root._version

      expect(edit(pair)).toBe(refused)

      expect(JSON.stringify(root.serialize())).toBe(saved)
      expect(root._version).toBe(version)
      expect(steps).toEqual([])
    }
  )

  it('refuses an edit inside a subgraph of the shared document, changing nothing', () => {
    const interior = subgraphInterior()
    const { target } = wiredPair(interior)
    boundRootGraphId = root.id
    const saved = JSON.stringify(root.serialize())

    expect(target.inputs.reorder(['b', 'a'])).toBe(false)

    expect(JSON.stringify(root.serialize())).toBe(saved)
    expect(steps).toEqual([])
  })

  it('applies the edit when another document is the shared one', () => {
    const { target } = wiredPair(root)
    boundRootGraphId = new LGraph().id

    expect(target.inputs.reorder(['b', 'a'])).toBe(true)

    expect(target.inputs.names()).toEqual(['b', 'a'])
    expect(Array.from(root.links.values(), (link) => link.target_slot)).toEqual(
      [1]
    )
    expect(steps).toEqual(['before', 'after'])
  })

  it("refuses reordering a subgraph node's inputs", () => {
    onTestFinished(enableSubgraphNodeCreation(root))
    const inner = new LGraphNode('Inner')
    inner.addInput('a', 'INT')
    inner.addInput('b', 'INT')
    root.add(inner)
    for (const index of [0, 1]) {
      const source = new LGraphNode('Source')
      source.addOutput('value', 'INT')
      root.add(source)
      source.connect(0, inner, index)
    }
    const { node } = root.convertToSubgraph(new Set([inner]))
    const handle = comfy.graph.node(String(node.id))
    boundRootGraphId = root.id

    expect(handle?.inputs.reorder(['b', 'a'])).toBe(false)
    expect(node.subgraph.inputs.map(({ name }) => name)).toEqual(['a', 'b'])
    expect(steps).toEqual([])
  })

  it('applies the edits that raise a graph intent', () => {
    const { source, target } = wiredPair(root)
    boundRootGraphId = root.id
    const intents: GraphIntentEvent['type'][] = []
    onTestFinished(onGraphIntent((event) => intents.push(event.type)))

    expect(target.setTitle('Renamed')).toBe(true)
    expect(source.outputs.at(1)?.connectTo(target.id, 'b')).toBeDefined()
    expect(source.outputs.at(0)?.disconnect()).toBe(true)

    expect(intents).toEqual(['set_node_field', 'connect', 'disconnect'])
    expect(root.links.size).toBe(1)
  })

  it('still throws for an argument the edit cannot use', () => {
    const { source, target } = wiredPair(root)
    boundRootGraphId = root.id

    expectRefusal(() => target.inputs.reorder(['a']), 'reorder')
    expectRefusal(() => source.outputs.add('a', 'INT'), 'add')
  })

  it('leaves an order the slots already have as it is', () => {
    const { target } = wiredPair(root)
    boundRootGraphId = root.id

    expect(target.inputs.reorder(['a', 'b'])).toBe(true)
    expect(steps).toEqual([])
  })
})
