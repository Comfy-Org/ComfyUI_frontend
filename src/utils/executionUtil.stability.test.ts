import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  LGraph,
  LGraphEventMode,
  LGraphNode
} from '@/lib/litegraph/src/litegraph'

import { graphToPrompt } from './executionUtil'

/**
 * Characterization baseline for the API prompt (QA-13).
 *
 * The ECS migration's premise is that it preserves behavior. `output` is the
 * payload that actually reaches the backend, so any change to it is a
 * user-visible execution difference. These assertions describe what `main`
 * produces today; a post-migration diff here is a real regression, not a new
 * assertion.
 */

function addNode(graph: LGraph, comfyClass: string): LGraphNode {
  const node = new LGraphNode(comfyClass)
  node.comfyClass = comfyClass
  graph.add(node)
  return node
}

/** The wire form: what `JSON.stringify` would actually put on the request. */
function wire(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value))
}

/**
 * A small but representative graph: widget values, a chain of links, and a
 * branch that feeds a node which is muted.
 */
function buildGraph() {
  const graph = new LGraph()

  const loader = addNode(graph, 'CheckpointLoaderSimple')
  loader.addOutput('MODEL', 'MODEL')
  loader.addOutput('CLIP', 'CLIP')
  loader.addWidget('combo', 'ckpt_name', 'v1-5.safetensors', () => undefined, {
    values: ['v1-5.safetensors', 'v2-1.safetensors']
  })

  const encode = addNode(graph, 'CLIPTextEncode')
  encode.addInput('clip', 'CLIP')
  encode.addOutput('CONDITIONING', 'CONDITIONING')
  encode.addWidget('text', 'text', 'a photo of a cat', () => undefined, {})

  const sampler = addNode(graph, 'KSampler')
  sampler.addInput('model', 'MODEL')
  sampler.addInput('positive', 'CONDITIONING')
  sampler.addWidget('number', 'seed', 42, () => undefined, {})
  sampler.addWidget('number', 'steps', 20, () => undefined, {})

  loader.connect(0, sampler, 0)
  loader.connect(1, encode, 0)
  encode.connect(0, sampler, 1)

  return { graph, loader, encode, sampler }
}

describe('graphToPrompt API prompt stability', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('produces an identical payload when called twice on the same graph', async () => {
    const { graph } = buildGraph()

    const first = await graphToPrompt(graph)
    const second = await graphToPrompt(graph)

    expect(wire(second.output)).toEqual(wire(first.output))
    expect(wire(second.workflow)).toEqual(wire(first.workflow))
    // Byte-stable, not merely deeply equal: key order is part of the payload
    // and `toEqual` would not see it change.
    expect(JSON.stringify(second.output)).toBe(JSON.stringify(first.output))
    expect(JSON.stringify(second.workflow)).toBe(JSON.stringify(first.workflow))
  })

  it('serializes the graph to the expected API prompt', async () => {
    const { graph, loader, encode, sampler } = buildGraph()

    const { output } = await graphToPrompt(graph)

    expect(wire(output)).toEqual({
      [String(loader.id)]: {
        inputs: { ckpt_name: 'v1-5.safetensors' },
        class_type: 'CheckpointLoaderSimple',
        _meta: { title: 'CheckpointLoaderSimple' }
      },
      [String(encode.id)]: {
        inputs: { text: 'a photo of a cat', clip: [String(loader.id), 1] },
        class_type: 'CLIPTextEncode',
        _meta: { title: 'CLIPTextEncode' }
      },
      [String(sampler.id)]: {
        inputs: {
          seed: 42,
          steps: 20,
          model: [String(loader.id), 0],
          positive: [String(encode.id), 0]
        },
        class_type: 'KSampler',
        _meta: { title: 'KSampler' }
      }
    })
  })

  it('keeps every non-muted node under its own id, keyed as a string', async () => {
    const { graph, loader, encode, sampler } = buildGraph()

    const { output } = await graphToPrompt(graph)

    expect(Object.keys(output).sort()).toEqual(
      [loader.id, encode.id, sampler.id].map(String).sort()
    )
  })

  it('expresses a link as [origin node id string, origin slot number]', async () => {
    const { graph, loader, sampler } = buildGraph()

    const { output } = await graphToPrompt(graph)
    const { model } = output[String(sampler.id)].inputs

    expect(model).toEqual([String(loader.id), 0])
  })

  it('drops a muted node and the inputs that pointed at it', async () => {
    const { graph, encode, sampler } = buildGraph()
    encode.mode = LGraphEventMode.NEVER

    const { output } = await graphToPrompt(graph)

    expect(output[String(encode.id)]).toBeUndefined()
    expect(output[String(sampler.id)].inputs).not.toHaveProperty('positive')
    expect(output[String(sampler.id)].inputs).toHaveProperty('model')
  })

  it('carries the workflow half of the payload alongside the prompt', async () => {
    const { graph, loader, encode, sampler } = buildGraph()

    const { workflow } = await graphToPrompt(graph)

    // The two halves disagree on id type by design: runtime ids are branded
    // strings, and `serializeNodeId` narrows integer-like ids back to numbers
    // for the workflow, while the prompt keys them as strings.
    expect(workflow.nodes.map((node) => node.id)).toEqual([1, 2, 3])
    expect([loader.id, encode.id, sampler.id]).toEqual(['1', '2', '3'])
    expect(workflow.links).toHaveLength(3)
    expect(workflow.extra?.frontendVersion).toBe(__COMFYUI_FRONTEND_VERSION__)
  })
})
