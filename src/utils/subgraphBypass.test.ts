import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphEventMode, LGraphNode } from '@/lib/litegraph/src/litegraph'
import {
  createBoundaryLinkedSubgraph,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { graphToPrompt } from './executionUtil'

const nestedInnerHostModeCases = [
  { label: 'muted', mode: LGraphEventMode.NEVER, includesInnerNodes: false },
  {
    label: 'bypassed',
    mode: LGraphEventMode.BYPASS,
    includesInnerNodes: false
  },
  { label: 'active', mode: LGraphEventMode.ALWAYS, includesInnerNodes: true }
] as const

function buildHostWiring() {
  const { rootGraph, subgraph, host, interior } = createBoundaryLinkedSubgraph()

  const source = new LGraphNode('Source')
  source.comfyClass = 'Source'
  source.addOutput('out', '*')
  rootGraph.add(source)

  interior.addOutput('out', '*')
  subgraph.addOutput('out', '*')
  subgraph.outputNode.slots[0].connect(interior.outputs[0], interior)

  const consumer = new LGraphNode('Consumer')
  consumer.comfyClass = 'Consumer'
  consumer.addInput('in', '*')
  rootGraph.add(consumer)

  source.connect(0, host, 0)
  host.connect(0, consumer, 0)

  return { rootGraph, host, interior, source, consumer }
}

describe('graphToPrompt subgraph host mode', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  it('excludes interior nodes when the host is bypassed', async () => {
    const { rootGraph, host, interior, source, consumer } = buildHostWiring()

    const interiorId = `${host.id}:${interior.id}`
    expect(interiorId).toBe('12:5')

    host.mode = LGraphEventMode.BYPASS

    const { output } = await graphToPrompt(rootGraph)
    expect(output[interiorId], 'interior node must be excluded').toBeUndefined()
    expect(output[String(host.id)], 'host must be excluded').toBeUndefined()
    expect(output[String(consumer.id)]?.inputs['in']).toEqual([
      String(source.id),
      0
    ])
  })

  it('excludes interior nodes when the host is muted', async () => {
    const { rootGraph, host, interior, consumer } = buildHostWiring()

    const interiorId = `${host.id}:${interior.id}`
    host.mode = LGraphEventMode.NEVER

    const { output } = await graphToPrompt(rootGraph)
    expect(output[interiorId], 'interior node must be excluded').toBeUndefined()
    expect(output[String(consumer.id)]?.inputs['in']).toBeUndefined()
  })

  it('includes interior nodes when the host is active', async () => {
    const { rootGraph, host, interior, consumer } = buildHostWiring()

    const interiorId = `${host.id}:${interior.id}`
    host.mode = LGraphEventMode.ALWAYS

    const { output } = await graphToPrompt(rootGraph)
    expect(output[interiorId], 'interior node must be included').toBeDefined()
    expect(output[String(consumer.id)]?.inputs['in']).toEqual([interiorId, 0])
  })

  it('nested: bypassed outer host excludes nested inner nodes too', async () => {
    const rootGraph = createTestRootGraph()

    const sub1 = createTestSubgraph({
      rootGraph,
      name: 'Outer',
      inputs: [{ name: 'a', type: '*' }],
      outputs: [{ name: 'out', type: '*' }]
    })
    const host1 = createTestSubgraphNode(sub1, { id: 100 })
    rootGraph.add(host1)

    const sub2 = createTestSubgraph({
      rootGraph,
      name: 'Inner'
    })
    const host2 = createTestSubgraphNode(sub2, { id: 200 })
    sub1.add(host2)

    const deepNode = new LGraphNode('Deep')
    deepNode.addInput('in', '*')
    sub2.add(deepNode)

    host1.mode = LGraphEventMode.BYPASS
    const { output } = await graphToPrompt(rootGraph)
    expect(output[`100:200:${deepNode.id}`]).toBeUndefined()
    expect(output['100:200']).toBeUndefined()
  })

  it.for(nestedInnerHostModeCases)(
    'nested: inner host in $label mode',
    async ({ mode, includesInnerNodes }) => {
      const rootGraph = createTestRootGraph()
      const subA = createTestSubgraph({ rootGraph, name: 'A' })
      const hostA = createTestSubgraphNode(subA, { id: 100 })
      rootGraph.add(hostA)

      const subB = createTestSubgraph({ rootGraph, name: 'B' })
      const hostB = createTestSubgraphNode(subB, { parentGraph: subA, id: 200 })
      subA.add(hostB)

      const aLeaf = new LGraphNode('ALeaf')
      aLeaf.addInput('in', '*')
      subA.add(aLeaf)

      const bLeaf = new LGraphNode('BLeaf')
      bLeaf.addInput('in', '*')
      subB.add(bLeaf)

      hostB.mode = mode
      const { output } = await graphToPrompt(rootGraph)

      expect(
        Object.hasOwn(output, '100:200'),
        'inner host B is virtual and must not be serialized'
      ).toBe(false)
      expect(
        Object.hasOwn(output, `100:200:${bLeaf.id}`),
        'contents of inner host B must follow its mode'
      ).toBe(includesInnerNodes)
      expect(
        output[`100:${aLeaf.id}`],
        'sibling node of A must be included'
      ).toBeDefined()
    }
  )
})
