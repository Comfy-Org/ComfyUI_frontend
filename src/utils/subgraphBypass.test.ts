import { beforeEach, describe, expect, it } from 'vitest'

import {
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createBoundaryLinkedSubgraph,
  createTestRootGraph,
  createTestSubgraph,
  createTestSubgraphNode,
  resetSubgraphFixtureState
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { graphToPrompt } from './executionUtil'

describe('graphToPrompt subgraph host mode', () => {
  beforeEach(() => {
    resetSubgraphFixtureState()
  })

  it('excludes interior nodes when the host is bypassed', async () => {
    const { rootGraph, host, interior } = createBoundaryLinkedSubgraph()

    const consumer = new LGraphNode('Consumer')
    consumer.comfyClass = 'Consumer'
    consumer.addInput('in', '*')
    rootGraph.add(consumer)

    const interiorId = `${host.id}:${interior.id}`
    expect(interiorId).toBe('12:5')

    host.mode = LGraphEventMode.BYPASS

    const { output } = await graphToPrompt(rootGraph)
    console.log('BYPASS host output keys:', Object.keys(output))
    expect(output[interiorId], 'interior node must be excluded').toBeUndefined()
    expect(output[String(host.id)], 'host must be excluded').toBeUndefined()
  })

  it('excludes interior nodes when the host is muted', async () => {
    const { rootGraph, host, interior } = createBoundaryLinkedSubgraph()

    const interiorId = `${host.id}:${interior.id}`
    host.mode = LGraphEventMode.NEVER

    const { output } = await graphToPrompt(rootGraph)
    console.log('MUTED host output keys:', Object.keys(output))
    expect(output[interiorId], 'interior node must be excluded').toBeUndefined()
  })

  it('includes interior nodes when the host is active', async () => {
    const { rootGraph, host, interior } = createBoundaryLinkedSubgraph()

    const interiorId = `${host.id}:${interior.id}`
    host.mode = LGraphEventMode.ALWAYS

    const { output } = await graphToPrompt(rootGraph)
    console.log('ACTIVE host output keys:', Object.keys(output))
    expect(output[interiorId], 'interior node must be included').toBeDefined()
  })

  it('nested: bypassed outer host excludes nested inner nodes too', async () => {
    const rootGraph = createTestSubgraph({
      rootGraph: undefined,
      inputs: [{ name: 'a', type: '*' }],
      outputs: [{ name: 'out', type: '*' }]
    }).rootGraph

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
    console.log('NESTED outer bypass keys:', Object.keys(output))
    expect(output[`100:200:${deepNode.id}`]).toBeUndefined()
    expect(output['100:200']).toBeUndefined()
  })

  it('nested: bypassed INNER host excludes its contents', async () => {
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

    hostB.mode = LGraphEventMode.BYPASS
    const { output } = await graphToPrompt(rootGraph)
    console.log('NESTED inner bypass keys:', Object.keys(output))
    expect(output['100:200'], 'inner host B must be excluded').toBeUndefined()
    expect(
      output[`100:200:${bLeaf.id}`],
      'contents of bypassed inner host must be excluded'
    ).toBeUndefined()
    expect(
      output[`100:${aLeaf.id}`],
      'sibling node of A must be included'
    ).toBeDefined()
  })
})
