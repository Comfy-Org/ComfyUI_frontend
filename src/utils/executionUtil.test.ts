import { describe, expect, it, onTestFinished } from 'vitest'

import type { CurveData } from '@comfyorg/graph-model/curve'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import {
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'
import {
  createTestSubgraph,
  createTestSubgraphNode
} from '@/lib/litegraph/src/subgraph/__fixtures__/subgraphHelpers'
import { createComfyApi } from '@/platform/nodeApi/v4/comfyApi'
import {
  addBackendNode,
  addNodeOfType
} from '@/platform/nodeApi/v4/execution/__fixtures__/promptGraphs'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { graphToPrompt } from './executionUtil'
import { registerTestPack } from '@/platform/nodeApi/v4/__tests__/testPack'

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

  it('omits a widget whose options.serialize is false, keeping its siblings', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'KSampler')
    node.addWidget('number', 'seed', 42, () => undefined, {})
    node.addWidget(
      'combo',
      'control_after_generate',
      'fixed',
      () => undefined,
      {
        values: ['fixed', 'increment'],
        serialize: false
      }
    )
    node.addWidget('number', 'steps', 20, () => undefined, {})

    expect(await promptInputs(graph, node)).toEqual({ seed: 42, steps: 20 })
  })

  it('includes a widget excluded from the workflow file by widget.serialize', async () => {
    const graph = new LGraph()
    const node = addNode(graph, 'KSampler')
    node.addWidget('number', 'seed', 42, () => undefined, {})
    const preview = node.addWidget('number', 'preview', 7, () => undefined, {})
    preview.serialize = false

    expect(await promptInputs(graph, node)).toEqual({ seed: 42, preview: 7 })
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

describe('graphToPrompt with the node API', () => {
  function workflowWithoutResolvers(definePlainFrontendType: () => void) {
    definePlainFrontendType()
    const graph = new LGraph()
    const source = addBackendNode(graph, 'Source', { outputs: ['text'] })
    const direct = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
    direct.addWidget('number', 'seed', 42, () => undefined, {})
    source.connect(0, direct, 0)

    for (const mode of [LGraphEventMode.BYPASS, LGraphEventMode.NEVER]) {
      const between = addBackendNode(graph, 'Between', {
        inputs: ['in'],
        outputs: ['out']
      })
      between.mode = mode
      const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
      source.connect(0, between, 0)
      between.connect(0, consumer, 0)
    }

    const legacyVirtual = addBackendNode(graph, 'LegacyReroute', {
      inputs: ['in'],
      outputs: ['out']
    })
    legacyVirtual.isVirtualNode = true
    const plain = addNodeOfType(graph, 'Pack/Plain')
    const afterVirtual = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
    source.connect(0, legacyVirtual, 0)
    legacyVirtual.connect(0, plain, 0)
    plain.connect(0, afterVirtual, 0)

    const subgraph = createTestSubgraph({
      rootGraph: graph,
      inputs: [{ name: 'text', type: 'STRING' }]
    })
    graph.subgraphs.set(subgraph.id, subgraph)
    const inner = addBackendNode(subgraph, 'Inner', { inputs: ['x'] })
    subgraph.inputNode.slots[0].connect(inner.inputs[0], inner)
    const linked = createTestSubgraphNode(subgraph)
    graph.add(linked)
    source.connect(0, linked, 0)
    const widgetFed = createTestSubgraphNode(subgraph)
    graph.add(widgetFed)
    const id = widgetId(graph.id, widgetFed.id, 'text')
    useWidgetValueStore().registerWidget(id, {
      type: 'text',
      value: 'typed',
      options: {}
    })
    widgetFed.inputs[0].widgetId = id
    return graph
  }

  it.for([
    { packs: 'no pack resolves a type', resolves: false },
    { packs: 'a pack resolves a type it does not use', resolves: true }
  ])(
    'builds the same prompt for a workflow with no resolved node when $packs',
    async ({ resolves }) => {
      const { comfy, host } = createComfyApi({ getGraph: () => null })
      const packId = registerTestPack({ comfy, host })
      const graph = workflowWithoutResolvers(() => {
        onTestFinished(
          comfy.defs.define(packId, {
            type: 'Pack/Plain',
            execution: 'frontend',
            inputs: [{ name: 'in', type: 'STRING' }],
            outputs: [{ name: 'out', type: 'STRING' }]
          })
        )
        if (resolves) {
          onTestFinished(
            comfy.defs.define(packId, {
              type: 'Pack/Unused',
              execution: 'frontend',
              outputs: [{ name: 'out', type: 'STRING' }],
              resolve: () => ({ 0: { literal: 'unused' } })
            })
          )
        }
      })

      const { output: alone } = await graphToPrompt(graph)
      const { output: withApi } = await graphToPrompt(graph, {
        frontendExecution: host.frontendExecution
      })

      expect(Object.values(alone).map(({ inputs }) => inputs)).toEqual([
        {},
        { seed: 42, x: ['1', 0] },
        { x: ['1', 0] },
        {},
        { x: ['1', 0] },
        { x: 'typed' },
        { x: ['1', 0] }
      ])
      expect(withApi).toEqual(alone)
    }
  )

  it('leaves out of a node the inputs its onPromptSerialize hooks name', async () => {
    const { comfy, host } = createComfyApi({ getGraph: () => null })
    const packId = registerTestPack({ comfy, host })
    onTestFinished(
      comfy.defs.define(packId, { type: 'Pack/Stash', execution: 'backend' })
    )
    onTestFinished(
      comfy.defs.extend(packId, 'Pack/Stash', (builder) =>
        builder.onPromptSerialize(() => ({ omitInputs: ['text'] }))
      )
    )
    const graph = new LGraph()
    const stash = addNodeOfType(graph, 'Pack/Stash')
    stash.addWidget('text', 'text', 'typed', () => undefined, {})
    stash.addWidget('number', 'seed', 3, () => undefined, {})

    const { output } = await graphToPrompt(graph, {
      frontendExecution: host.frontendExecution
    })

    expect(output[String(stash.id)].inputs).toEqual({ seed: 3 })
  })

  it('builds the inputs a resolved node feeds from what its resolver answers', async () => {
    const { comfy, host } = createComfyApi({ getGraph: () => null })
    const packId = registerTestPack({ comfy, host })
    onTestFinished(
      comfy.defs.define(packId, {
        type: 'Pack/Constant',
        execution: 'frontend',
        outputs: [{ name: 'out', type: 'STRING' }],
        resolve: () => ({ 0: { literal: 'answered' } })
      })
    )
    const graph = new LGraph()
    const constant = addNodeOfType(graph, 'Pack/Constant')
    const consumer = addBackendNode(graph, 'Consumer', { inputs: ['x'] })
    constant.connect(0, consumer, 0)

    const { output } = await graphToPrompt(graph, {
      frontendExecution: host.frontendExecution
    })

    expect(output[String(consumer.id)].inputs).toEqual({ x: 'answered' })
  })
})
