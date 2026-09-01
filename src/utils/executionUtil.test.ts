import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { CurveData } from '@/components/curve/types'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

function addNode(graph: LGraph, comfyClass: string) {
  const node = new LGraphNode(comfyClass)
  node.comfyClass = comfyClass
  graph.add(node)
  return node
}

function curveData(): CurveData {
  return {
    points: [
      [0, 0],
      [1, 1]
    ],
    interpolation: 'monotone_cubic'
  }
}

async function promptInputs(graph: LGraph, node: LGraphNode) {
  const { output } = await graphToPrompt(graph)
  return output[String(node.id)].inputs
}

describe('graphToPrompt widget serialization', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('tags curve widget values with the CURVE type marker', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'CurveEditor')
    const curve = curveData()
    node.addWidget('curve', 'curve', curve, () => undefined, {})

    expect(await promptInputs(graph, node)).toEqual({
      curve: { __type__: 'CURVE', __value__: curve }
    })
  })

  it('omits a curve widget that serializes to no value', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'CurveEditor')
    const widget = node.addWidget(
      'curve',
      'curve',
      curveData(),
      () => undefined,
      {}
    )
    widget.serializeValue = () => undefined

    const inputs = await promptInputs(graph, node)
    expect(JSON.parse(JSON.stringify(inputs))).toEqual({})
  })

  it('wraps array values of other widgets without a type marker', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'MultiSelectNode')
    node.addWidget('multiselect', 'tags', ['a', 'b'], () => undefined, {})

    expect(await promptInputs(graph, node)).toEqual({
      tags: { __value__: ['a', 'b'] }
    })
  })

  it('leaves scalar widget values unwrapped', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'KSampler')
    node.addWidget('number', 'seed', 42, () => undefined, {})

    expect(await promptInputs(graph, node)).toEqual({ seed: 42 })
  })

  it('sends a null widget value through to the prompt', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'KSampler')
    const widget = node.addWidget(
      'text',
      'prompt',
      'hello',
      () => undefined,
      {}
    )
    widget.value = null

    const inputs = await promptInputs(graph, node)

    expect(inputs).toHaveProperty('prompt')
    expect(inputs.prompt).toBeNull()
  })

  it('omits a null widget value when options.serialize is false', async () => {
    // Control arm for the test above: the prompt path filters on
    // `options.serialize`, not on nullness.
    const graph = new LGraph()
    const node = addNode(graph, 'KSampler')
    const widget = node.addWidget('text', 'prompt', 'hello', () => undefined, {
      serialize: false
    })
    widget.value = null

    expect(await promptInputs(graph, node)).not.toHaveProperty('prompt')
  })
})

describe('graphToPrompt', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('excludes nodes with isVirtualNode from API output', async () => {
    const graph = new LGraph()
    const realNode = new LGraphNode('RealNode')
    realNode.comfyClass = 'KSampler'
    graph.add(realNode)

    const virtualNode = new LGraphNode('VirtualNode')
    virtualNode.isVirtualNode = true
    virtualNode.comfyClass = 'Note'
    graph.add(virtualNode)

    const { output } = await graphToPrompt(graph)

    expect(output[String(virtualNode.id)]).toBeUndefined()
    expect(output[String(realNode.id)]).toBeDefined()
    expect(output[String(realNode.id)].class_type).toBe('KSampler')
  })

  it('produces empty output when all nodes are virtual', async () => {
    const graph = new LGraph()

    const note = new LGraphNode('Note')
    note.isVirtualNode = true
    note.comfyClass = 'Note'
    graph.add(note)

    const mdNote = new LGraphNode('MarkdownNote')
    mdNote.isVirtualNode = true
    mdNote.comfyClass = 'MarkdownNote'
    graph.add(mdNote)

    const { output } = await graphToPrompt(graph)

    expect(Object.keys(output)).toHaveLength(0)
  })

  it('includes virtual nodes in workflow JSON for save fidelity', async () => {
    const graph = new LGraph()

    const note = new LGraphNode('Note')
    note.isVirtualNode = true
    note.comfyClass = 'Note'
    graph.add(note)

    const realNode = new LGraphNode('RealNode')
    realNode.comfyClass = 'KSampler'
    graph.add(realNode)

    const { workflow, output } = await graphToPrompt(graph)

    expect(
      workflow.nodes.some((n) => n.id === note.id),
      'Workflow JSON should preserve virtual nodes by ID'
    ).toBe(true)
    expect(output[String(note.id)]).toBeUndefined()
  })

  it('preserves multiple non-virtual nodes', async () => {
    const graph = new LGraph()

    const node1 = new LGraphNode('Node1')
    node1.comfyClass = 'KSampler'
    graph.add(node1)

    const node2 = new LGraphNode('Node2')
    node2.comfyClass = 'SaveImage'
    graph.add(node2)

    const { output } = await graphToPrompt(graph)

    expect(Object.keys(output)).toHaveLength(2)
    expect(output[String(node1.id)].class_type).toBe('KSampler')
    expect(output[String(node2.id)].class_type).toBe('SaveImage')
  })
})
