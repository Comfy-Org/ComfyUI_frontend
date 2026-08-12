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
})
