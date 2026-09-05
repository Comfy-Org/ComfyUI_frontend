import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { CurveData } from '@/components/curve/types'
import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

function addNode(
  graph: LGraph,
  comfyClass: string,
  properties: Record<string, unknown> = {}
) {
  const node = new LGraphNode(comfyClass)
  node.comfyClass = comfyClass
  Object.assign(node.properties, properties)
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

describe('graphToPrompt _meta pack identity', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('carries cnr_id and ver from node properties', async () => {
    const graph = new LGraph()
    const packNode = addNode(graph, 'PackNode', {
      cnr_id: 'some-pack',
      ver: '1.2.0'
    })
    const auxNode = addNode(graph, 'AuxNode', { aux_id: 'aux/pack' })
    const bareNode = addNode(graph, 'BareNode')

    const { output } = await graphToPrompt(graph)

    expect(output[String(packNode.id)]._meta).toEqual({
      title: 'PackNode',
      cnr_id: 'some-pack',
      ver: '1.2.0'
    })
    expect(output[String(auxNode.id)]._meta).toEqual({
      title: 'AuxNode',
      cnr_id: 'aux/pack'
    })
    expect(output[String(bareNode.id)]._meta).toEqual({ title: 'BareNode' })
  })
})
