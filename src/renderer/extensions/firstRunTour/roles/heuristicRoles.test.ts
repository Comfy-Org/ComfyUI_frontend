import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { createTestRootGraph } from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'

import { heuristicRoles } from './heuristicRoles'

class OutputNode extends LGraphNode {
  static override nodeData = { output_node: true }
}

function addNode(
  graph: LGraph,
  type: string,
  options: {
    title?: string
    prompts?: string[]
    out?: string[]
    in?: string[]
  } = {}
) {
  const node = new LGraphNode(type, type)
  if (options.title) node.title = options.title
  for (const name of options.prompts ?? [])
    node.addWidget('text', name, '', () => {}, { multiline: true })
  for (const type_ of options.out ?? []) node.addOutput(type_, type_)
  for (const name of options.in ?? []) node.addInput(name, 'CONDITIONING')
  graph.add(node)
  return node
}

function addSink(graph: LGraph) {
  const producer = addNode(graph, 'VAEDecode', { out: ['IMAGE'] })
  const sink = new OutputNode('SaveImage', 'SaveImage')
  sink.addInput('images', 'IMAGE')
  graph.add(sink)
  producer.connect(0, sink, 0)
  return sink
}

describe('heuristicRoles', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('takes the prompt wired to positive when negative comes first', () => {
    const graph = createTestRootGraph()
    addSink(graph)
    const sampler = addNode(graph, 'KSampler', { in: ['positive', 'negative'] })
    const negative = addNode(graph, 'CLIPTextEncode', {
      prompts: ['text'],
      out: ['CONDITIONING']
    })
    const positive = addNode(graph, 'CLIPTextEncode', {
      prompts: ['text'],
      out: ['CONDITIONING']
    })
    negative.connect(0, sampler, 1)
    positive.connect(0, sampler, 0)
    expect(heuristicRoles(graph)?.prompt).toBe(positive)
  })

  it('keeps a node carrying a negative box alongside a prompt box', () => {
    const graph = createTestRootGraph()
    addSink(graph)
    const node = addNode(graph, 'WanApi', {
      prompts: ['negative_prompt', 'prompt']
    })
    expect(heuristicRoles(graph)?.prompt).toBe(node)
  })

  it('offers no prompt when the only text box is negative', () => {
    const graph = createTestRootGraph()
    addSink(graph)
    addNode(graph, 'CLIPTextEncode', {
      title: 'Negative Prompt',
      prompts: ['text']
    })
    expect(heuristicRoles(graph)?.prompt).toBeNull()
  })

  it('offers no prompt when two candidates tie', () => {
    const graph = createTestRootGraph()
    addSink(graph)
    addNode(graph, 'A', { prompts: ['value'] })
    addNode(graph, 'B', { prompts: ['value'] })
    expect(heuristicRoles(graph)?.prompt).toBeNull()
  })

  it('gives a graph with no wired output node no tour', () => {
    const graph = createTestRootGraph()
    addNode(graph, 'CLIPTextEncode', { prompts: ['text'] })
    expect(heuristicRoles(graph)).toBeNull()
  })
})
