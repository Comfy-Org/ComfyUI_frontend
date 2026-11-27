import { assert, beforeEach, expect, it, vi } from 'vitest'

import {
  LegacyWidget,
  LGraphNode,
  SubgraphNode
} from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'

import {
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from './__fixtures__/subgraphHelpers'

beforeEach(() => {
  resetSubgraphFixtureState()
})

function createPromotedHost() {
  const subgraph = createTestSubgraph({
    inputs: [{ name: 'value', type: 'INT' }]
  })
  const interior = new LGraphNode('Interior')
  const input = interior.addInput('value', 'INT')
  const widget = new LegacyWidget({
    name: 'value',
    type: 'number',
    value: 17,
    y: 0,
    options: {},
    node: interior
  })
  interior.widgets = [widget]
  input.widget = { name: widget.name }
  subgraph.add(interior)
  const slot = subgraph.inputs[0]
  slot.connect(input, interior)
  const host = createTestSubgraphNode(subgraph)
  subgraph.rootGraph.add(host)
  const promoted = host.widgets[0]
  assert.exists(promoted)
  return { subgraph, host, slot, promoted }
}

it.for([
  {
    retirement: 'reconfiguration',
    retire: (node: SubgraphNode) => node.configure(node.serialize())
  },
  {
    retirement: 'normal removal',
    retire: (node: SubgraphNode) =>
      node.rootGraph.remove(node, { preserveSubgraphDefinitions: true })
  }
])(
  'does not dispose a promoted widget twice after $retirement',
  async ({ retire }) => {
    const { host, slot, promoted } = createPromotedHost()
    const onRemove = vi.fn()
    promoted.onRemove = onRemove

    slot.disconnect()
    retire(host)
    await Promise.resolve()

    expect(onRemove).toHaveBeenCalledOnce()
  }
)

it('stops a retired definition input from disposing its former host widget', async () => {
  const { host, slot, subgraph, promoted } = createPromotedHost()
  subgraph.removeInput(slot)
  expect(host.inputs).toHaveLength(0)
  const onRemove = vi.fn()
  promoted.onRemove = onRemove

  slot.events.dispatch('input-disconnected', { input: slot })
  await Promise.resolve()

  expect(onRemove).not.toHaveBeenCalled()
})

it.for([
  {
    removal: 'node removal',
    remove: (graph: LGraph, node: SubgraphNode) =>
      graph.remove(node, { preserveSubgraphDefinitions: true })
  },
  {
    removal: 'graph teardown',
    remove: (graph: LGraph) => graph.clear()
  }
])(
  'ends core observation during $removal despite an overridden removal hook',
  ({ remove }) => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'INT' }]
    })
    const removed = vi.fn()
    class ExtensionHost extends SubgraphNode {
      override onRemoved(): void {
        removed()
      }
    }
    const host = new ExtensionHost(subgraph.rootGraph, subgraph, {
      id: -1,
      type: subgraph.id,
      pos: [0, 0],
      size: [100, 100],
      inputs: [],
      outputs: [],
      flags: {},
      order: 0,
      mode: 0
    })
    subgraph.rootGraph.add(host)

    remove(subgraph.rootGraph, host)
    subgraph.addInput('after-removal', 'INT')

    expect(removed).toHaveBeenCalledOnce()
    expect(host.graph).toBeNull()
    expect(host.inputs.map(({ name }) => name)).toEqual(['value'])
  }
)

it.for([
  {
    removal: 'node removal',
    remove: (graph: LGraph, node: SubgraphNode) =>
      graph.remove(node, { preserveSubgraphDefinitions: true }),
    siblingInputs: ['value', 'after-removal']
  },
  {
    removal: 'graph teardown',
    remove: (graph: LGraph) => graph.clear(),
    siblingInputs: ['value']
  }
])(
  'closes the removed lifetimes when a hook throws during $removal',
  ({ remove, siblingInputs }) => {
    const subgraph = createTestSubgraph({
      inputs: [{ name: 'value', type: 'INT' }]
    })
    const first = createTestSubgraphNode(subgraph)
    const sibling = createTestSubgraphNode(subgraph)
    const cause = new Error('Extension removal failed')
    first.onRemoved = () => {
      throw cause
    }
    subgraph.rootGraph.add(first)
    subgraph.rootGraph.add(sibling)

    expect(() => remove(subgraph.rootGraph, first)).toThrow(cause)
    subgraph.addInput('after-removal', 'INT')

    expect(first.graph).toBeNull()
    expect(first.inputs.map(({ name }) => name)).toEqual(['value'])
    expect(sibling.inputs.map(({ name }) => name)).toEqual(siblingInputs)
  }
)

it('closes a node added by a removal hook before graph teardown detaches it', () => {
  const subgraph = createTestSubgraph({
    inputs: [{ name: 'value', type: 'INT' }]
  })
  const first = createTestSubgraphNode(subgraph)
  const late = createTestSubgraphNode(subgraph)
  first.onRemoved = () => {
    subgraph.rootGraph.add(late)
  }
  subgraph.rootGraph.add(first)

  subgraph.rootGraph.clear()
  subgraph.addInput('after-removal', 'INT')

  expect(late.graph).toBeNull()
  expect(late.inputs.map(({ name }) => name)).toEqual(['value'])
})
