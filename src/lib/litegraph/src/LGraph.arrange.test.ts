import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'

beforeEach(() => setActivePinia(createTestingPinia({ stubActions: false })))

function createNode(title: string, position: [number, number]): LGraphNode {
  const node = new LGraphNode(title)
  node.addInput('in', '*')
  node.addOutput('out', '*')
  node.setPos(...position)
  node.setSize([140, 80])
  return node
}

function createCrossedGraph() {
  const graph = new LGraph()
  const sourceA = createNode('Source A', [0, 0])
  const sourceB = createNode('Source B', [0, 200])
  const sourceC = createNode('Source C', [0, 400])
  const targetA = createNode('Target A', [500, 0])
  const targetB = createNode('Target B', [500, 200])
  targetA.addInput('in 2', '*')
  for (const node of [sourceA, sourceB, sourceC, targetA, targetB])
    graph.add(node)
  sourceA.connect(0, targetA, 0)
  sourceC.connect(0, targetA, 1)
  sourceB.connect(0, targetB, 0)
  return { graph, sourceA, sourceB, sourceC, targetA, targetB }
}

describe('LGraph.arrange', () => {
  it('orders connected branches to remove avoidable crossings', () => {
    const { graph, sourceA, sourceB, sourceC, targetA, targetB } =
      createCrossedGraph()

    graph.arrange()

    expect(sourceB.pos[1]).toBeLessThan(sourceA.pos[1])
    expect(sourceA.pos[1]).toBeLessThan(sourceC.pos[1])
    expect(targetB.pos[1]).toBeLessThan(targetA.pos[1])
    expect(targetA.pos[0]).toBeGreaterThan(sourceA.pos[0])
  })

  it('produces a stable layout when arranged repeatedly', () => {
    const { graph } = createCrossedGraph()

    graph.arrange()
    const firstLayout = graph.nodes.map((node) => [...node.pos])
    graph.arrange()

    expect(graph.nodes.map((node) => [...node.pos])).toEqual(firstLayout)
  })

  it('keeps disconnected nodes in their original layer slot', () => {
    const graph = new LGraph()
    const sourceA = createNode('Source A', [0, 0])
    const note = createNode('Disconnected note', [0, 100])
    const sourceB = createNode('Source B', [0, 200])
    const sourceC = createNode('Source C', [0, 400])
    const targetA = createNode('Target A', [500, 0])
    const targetB = createNode('Target B', [500, 200])
    targetA.addInput('in 2', '*')
    for (const node of [sourceA, note, sourceB, sourceC, targetA, targetB])
      graph.add(node)
    sourceA.connect(0, targetA, 0)
    sourceC.connect(0, targetA, 1)
    sourceB.connect(0, targetB, 0)

    graph.arrange()

    const firstLayer = [sourceA, note, sourceB, sourceC].sort(
      (left, right) => left.pos[1] - right.pos[1]
    )
    expect(firstLayer[1]).toBe(note)
  })

  it('preserves the existing order when the graph is already crossing-free', () => {
    const graph = new LGraph()
    const sourceA = createNode('Source A', [0, 0])
    const sourceB = createNode('Source B', [0, 200])
    const targetA = createNode('Target A', [500, 0])
    const targetB = createNode('Target B', [500, 200])
    for (const node of [sourceA, sourceB, targetA, targetB]) graph.add(node)
    sourceA.connect(0, targetA, 0)
    sourceB.connect(0, targetB, 0)

    graph.arrange()

    expect(sourceA.pos[1]).toBeLessThan(sourceB.pos[1])
    expect(targetA.pos[1]).toBeLessThan(targetB.pos[1])
  })

  it('keeps an existing branch stable when another branch is added', () => {
    const graph = new LGraph()
    const firstSource = createNode('First source', [0, 0])
    const firstProcess = createNode('First process', [0, 0])
    const firstOutput = createNode('First output', [0, 0])
    for (const node of [firstSource, firstProcess, firstOutput]) graph.add(node)
    firstSource.connect(0, firstProcess, 0)
    firstProcess.connect(0, firstOutput, 0)
    graph.arrange()
    const firstBranchPositions = [firstSource, firstProcess, firstOutput].map(
      (node) => [...node.pos]
    )

    const secondSource = createNode('Second source', [0, 0])
    const secondProcess = createNode('Second process', [0, 0])
    const secondOutput = createNode('Second output', [0, 0])
    for (const node of [secondSource, secondProcess, secondOutput])
      graph.add(node)
    secondSource.connect(0, secondProcess, 0)
    secondProcess.connect(0, secondOutput, 0)
    graph.arrange()

    expect(
      [firstSource, firstProcess, firstOutput].map((node) => [...node.pos])
    ).toEqual(firstBranchPositions)
    expect(secondSource.pos[1]).toBeGreaterThan(firstSource.pos[1])
    expect(secondProcess.pos[1]).toBeGreaterThan(firstProcess.pos[1])
    expect(secondOutput.pos[1]).toBeGreaterThan(firstOutput.pos[1])
  })

  it('counts crossings between skip links and adjacent-layer links', () => {
    const graph = new LGraph()
    const skipSource = createNode('Skip source', [0, 0])
    const fillerSource = createNode('Filler source', [0, 0])
    const shortSource = createNode('Short source', [0, 0])
    const lowerSource = createNode('Lower source', [0, 0])
    const filler = createNode('Filler', [0, 0])
    const shortOrigin = createNode('Short origin', [0, 0])
    const lowerOrigin = createNode('Lower origin', [0, 0])
    const upperTarget = createNode('Upper target', [0, 0])
    const lowerTarget = createNode('Lower target', [0, 0])
    lowerTarget.addInput('skip', '*')
    for (const node of [
      skipSource,
      fillerSource,
      shortSource,
      lowerSource,
      filler,
      shortOrigin,
      lowerOrigin,
      upperTarget,
      lowerTarget
    ])
      graph.add(node)
    skipSource.connect(0, lowerTarget, 1)
    fillerSource.connect(0, filler, 0)
    shortSource.connect(0, shortOrigin, 0)
    lowerSource.connect(0, lowerOrigin, 0)
    shortOrigin.connect(0, upperTarget, 0)
    lowerOrigin.connect(0, lowerTarget, 0)

    graph.arrange()

    expect(fillerSource.pos[1]).toBeLessThan(skipSource.pos[1])
    expect(shortOrigin.pos[1]).toBeLessThan(lowerOrigin.pos[1])
    expect(upperTarget.pos[1]).toBeLessThan(lowerTarget.pos[1])
  })

  it('keeps heterogeneous nodes separated within a layer', () => {
    const graph = new LGraph()
    const first = createNode('First', [0, 0])
    const second = createNode('Second', [0, 20])
    first.setSize([200, 260])
    second.setSize([120, 60])
    graph.add(first)
    graph.add(second)

    graph.arrange(40)

    expect(second.pos[1] - first.pos[1]).toBe(
      first.size[1] + 40 + LiteGraph.NODE_TITLE_HEIGHT
    )
  })

  it('applies the same crossing reduction to vertical layouts', () => {
    const { graph, sourceA, sourceB, sourceC, targetA, targetB } =
      createCrossedGraph()

    graph.arrange(80, LiteGraph.VERTICAL_LAYOUT)

    expect(sourceB.pos[0]).toBeLessThan(sourceA.pos[0])
    expect(sourceA.pos[0]).toBeLessThan(sourceC.pos[0])
    expect(targetB.pos[0]).toBeLessThan(targetA.pos[0])
    expect(targetA.pos[1]).toBeGreaterThan(sourceA.pos[1])
  })

  it('lays out cyclic nodes without overlapping them', () => {
    const graph = new LGraph()
    const first = createNode('First', [0, 0])
    const second = createNode('Second', [0, 0])
    graph.add(first)
    graph.add(second)
    first.connect(0, second, 0)
    second.connect(0, first, 0)

    graph.arrange()

    expect(first.pos).not.toEqual(second.pos)
    expect(first.pos[0]).toBe(second.pos[0])
  })
})
