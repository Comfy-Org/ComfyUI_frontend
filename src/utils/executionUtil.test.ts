import { afterEach, assert, describe, expect, it } from 'vitest'

import type { CurveData } from '@comfyorg/graph-model/curve'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraphData,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createComfyApi } from '@/platform/nodeApi/comfyApi'
import type { Comfy } from '@/platform/nodeApi/comfyApi'
import type { NodeDefinition } from '@/platform/nodeApi/defsRegistry'

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

describe('graphToPrompt registered projections', () => {
  const disposers: Array<() => void> = []

  afterEach(() => {
    disposers.splice(0).forEach((dispose) => dispose())
  })

  function defineNode(graph: LGraph, comfy: Comfy, definition: NodeDefinition) {
    disposers.push(comfy.defs.define(definition))
    const node = LiteGraph.createNode(definition.type)
    assert.exists(node)
    graph.add(node)
    return node
  }

  it('awaits omissions in the owning graph while retaining saved connections', async () => {
    const graph = new LGraph()
    const comfy = createComfyApi(() => graph)
    const subgraph = graph.createSubgraph(createTestSubgraphData())
    const target = defineNode(subgraph, comfy, {
      type: 'PromptProjectionTarget',
      inputs: [
        { name: 'optional_image', type: 'IMAGE' },
        { name: 'mask', type: 'MASK' }
      ],
      widgets: [{ type: 'boolean', name: 'omit_image', value: true }],
      onPromptSerialize: async (node) => {
        await Promise.resolve()
        return {
          omitInputs: node.widgets.get('omit_image')?.getValue()
            ? ['optional_image']
            : []
        }
      }
    })
    const source = addNode(subgraph, 'ProjectionSource')
    source.addOutput('image', 'IMAGE')
    source.addOutput('mask', 'MASK')
    source.connect(0, target, 0)
    source.connect(1, target, 1)

    const visibleTarget = LiteGraph.createNode('PromptProjectionTarget')
    assert.exists(visibleTarget)
    graph.add(visibleTarget)
    const visibleToggle = visibleTarget.widgets?.find(
      (widget) => widget.name === 'omit_image'
    )
    assert.exists(visibleToggle)
    visibleToggle.value = false
    const host = createTestSubgraphNode(subgraph)
    graph.add(host)
    const before = graph.serialize()

    const { workflow, output } = await graphToPrompt(graph)

    expect(output[`${host.id}:${target.id}`].inputs).toEqual({
      omit_image: true,
      mask: [`${host.id}:${source.id}`, 1]
    })
    expect(output[String(visibleTarget.id)].inputs).toEqual({
      omit_image: false
    })
    expect(workflow.definitions?.subgraphs).toEqual(
      before.definitions?.subgraphs
    )
    expect(graph.serialize()).toEqual(before)

    const toggle = target.widgets?.find(
      (widget) => widget.name === 'omit_image'
    )
    assert.exists(toggle)
    toggle.value = false
    const retained = await graphToPrompt(graph)
    expect(
      retained.output[`${host.id}:${target.id}`].inputs.optional_image
    ).toEqual([`${host.id}:${source.id}`, 0])
  })

  it('composes async resolvers and suppliers for each placement without graph edits', async () => {
    const graph = new LGraph()
    const comfy = createComfyApi(() => graph)
    const subgraph = graph.createSubgraph(createTestSubgraphData())
    const source = addNode(subgraph, 'ResolutionSource')
    source.addOutput('image', 'IMAGE')
    const relay = defineNode(subgraph, comfy, {
      type: 'PromptAsyncRelay',
      execution: 'frontend',
      inputs: [{ name: 'image', type: 'IMAGE' }],
      outputs: [{ name: 'image', type: 'IMAGE' }],
      resolve: async ({ self }) => {
        await Promise.resolve()
        return { image: { forwardTo: { nodeId: self.id, input: 0 } } }
      }
    })
    const literal = defineNode(subgraph, comfy, {
      type: 'PromptLiteralArray',
      execution: 'frontend',
      outputs: [{ name: 'values', type: 'VALUES' }],
      resolve: () => ({ values: { literal: [10, 20] } })
    })
    const supplier = defineNode(subgraph, comfy, {
      type: 'PromptImageSupplier',
      execution: 'frontend',
      inputs: [{ name: 'image', type: 'IMAGE' }],
      supply: async ({ unconnectedInputs }) => {
        await Promise.resolve()
        return unconnectedInputs()
          .filter((input) => input.name === 'supplied_image')
          .map((input) => ({
            to: { nodeId: input.nodeId, input: input.input },
            from: { forwardInput: 0 }
          }))
      }
    })
    const target = addNode(subgraph, 'ResolutionTarget')
    target.addInput('image', 'IMAGE')
    target.addInput('supplied_image', 'IMAGE')
    target.addInput('values', 'VALUES')
    source.connect(0, relay, 0)
    relay.connect(0, target, 0)
    relay.connect(0, supplier, 0)
    literal.connect(0, target, 2)
    const first = createTestSubgraphNode(subgraph)
    graph.add(first)
    const second = createTestSubgraphNode(subgraph)
    graph.add(second)
    const before = graph.serialize()

    const { workflow, output } = await graphToPrompt(graph)

    expect(output[`${first.id}:${target.id}`].inputs).toEqual({
      image: [`${first.id}:${source.id}`, 0],
      supplied_image: [`${first.id}:${source.id}`, 0],
      values: { __value__: [10, 20] }
    })
    expect(output[`${second.id}:${target.id}`].inputs).toEqual({
      image: [`${second.id}:${source.id}`, 0],
      supplied_image: [`${second.id}:${source.id}`, 0],
      values: { __value__: [10, 20] }
    })
    expect(Object.keys(output)).toHaveLength(4)
    expect(workflow.definitions?.subgraphs).toEqual(
      before.definitions?.subgraphs
    )
    expect(graph.serialize()).toEqual(before)
  })
})

describe('graphToPrompt widget serialization', () => {
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
      aux_id: 'aux/pack'
    })
    expect(output[String(bareNode.id)]._meta).toEqual({ title: 'BareNode' })
  })

  it('omits non-string pack identity properties', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'InvalidIdentityNode', {
      cnr_id: {},
      aux_id: [],
      ver: 123
    })

    const { output } = await graphToPrompt(graph)

    expect(output[String(node.id)]._meta).toEqual({
      title: 'InvalidIdentityNode'
    })
  })

  it.for([123, ''])(
    'preserves aux_id separately when cnr_id is %j',
    async (cnrId) => {
      const graph = new LGraph()
      const node = addNode(graph, 'FallbackIdentityNode', {
        cnr_id: cnrId,
        aux_id: 'aux/pack'
      })

      const { output } = await graphToPrompt(graph)

      expect(output[String(node.id)]._meta).toEqual({
        title: 'FallbackIdentityNode',
        aux_id: 'aux/pack'
      })
    }
  )
})
