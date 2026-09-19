import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
// Mirrors the production bridge in AgentPanelRoot.vue, which takes the same
// exemption to drive the real layout store.
// eslint-disable-next-line import-x/no-restricted-paths
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
// eslint-disable-next-line import-x/no-restricted-paths
import { LayoutSource } from '@/renderer/core/layout/types'
import { transformInputSpecV1ToV2 } from '@/schemas/nodeDef/migration'
import type { InputSpec } from '@/schemas/nodeDefSchema'
import { useLitegraphService } from '@/services/litegraphService'
import type { GraphScope } from '@/types/graphScopeId'
import { graphScopeOf } from '@/types/graphScopeId'
import { graphToPrompt } from '@/utils/executionUtil'

import { reconcileAgentAdapters } from './agentNodeMaterializer'
import { EcsFollowerAdapter } from './ecsFollowerAdapter'
import { FollowerDoc } from './followerDoc'
import { createGraphMutations } from './graphMutations'

vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

/**
 * The prompt a user queues from the canvas after the agent built the graph
 * must match the graph the agent built. These replay the exact ops comfy-cli
 * emits for two graphs that failed on Comfy Cloud with
 * `prompt_outputs_failed_validation` after a canvas Run.
 */

/** Declares an input through the same service a registered node def uses. */
function addSpecInput(
  node: LGraphNode,
  name: string,
  spec: InputSpec,
  isOptional = false
) {
  useLitegraphService().addNodeInput(
    node,
    transformInputSpecV1ToV2(spec, { name, isOptional })
  )
}

class VideoSource extends LGraphNode {
  constructor() {
    super('Video Source')
    this.addOutput('VIDEO', 'VIDEO')
  }
}

class AudioSource extends LGraphNode {
  constructor() {
    super('Audio Source')
    this.addOutput('AUDIO', 'AUDIO')
  }
}

/** comfy_extras ConcatenateVideo: prefix autogrow + COMBO + optional AUDIO. */
class ConcatenateVideo extends LGraphNode {
  constructor() {
    super('Concatenate Video')
    this.widgets = []
    addSpecInput(this, 'videos', [
      'COMFY_AUTOGROW_V3',
      {
        template: {
          input: { required: { video: ['VIDEO', {}] } },
          prefix: 'video',
          min: 1,
          max: 100
        }
      }
    ])
    addSpecInput(this, 'codec', [
      'COMBO',
      { default: 'auto', options: ['auto', 'h264', 'av1'] }
    ])
    addSpecInput(this, 'complete_audio', ['AUDIO', {}], true)
    this.addOutput('VIDEO', 'VIDEO')
    this.serialize_widgets = true
  }
}

class SaveVideo extends LGraphNode {
  static override title = 'Save Video'
  constructor() {
    super('Save Video')
    this.addInput('video', 'VIDEO')
  }
}

/** comfy_extras EmptyHunyuanLatentVideo: four INT widgets. */
class EmptyHunyuanLatentVideo extends LGraphNode {
  constructor() {
    super('Empty Hunyuan Latent Video')
    this.widgets = []
    for (const [name, value] of [
      ['width', 848],
      ['height', 480],
      ['length', 25],
      ['batch_size', 1]
    ] as const) {
      addSpecInput(this, name, ['INT', { default: value, min: 1 }])
    }
    this.addOutput('LATENT', 'LATENT')
    this.serialize_widgets = true
  }
}

class SaveLatent extends LGraphNode {
  constructor() {
    super('Save Latent')
    this.addInput('samples', 'LATENT')
  }
}

const OUTPUT_NODES = ['SaveVideo', 'SaveLatent']

const CATALOG: WidgetCatalog = {
  types: {
    VideoSource: { widget_order: [] },
    AudioSource: { widget_order: [] },
    ConcatenateVideo: { widget_order: ['codec'] },
    SaveVideo: { widget_order: [] },
    EmptyHunyuanLatentVideo: {
      widget_order: ['width', 'height', 'length', 'batch_size']
    },
    SaveLatent: { widget_order: [] }
  }
}

function remoteMutations(scope: GraphScope) {
  return createGraphMutations({
    getScope: () => scope,
    layout: {
      createNode(scope, nodeId, { position, size }, context) {
        layoutStore.applyOperation({
          type: 'createNode',
          graphId: scope.rootGraphId,
          ownerGraphId: scope.owningGraphId,
          nodeId,
          layout: {
            id: nodeId,
            position,
            size,
            bounds: { x: position.x, y: position.y, ...size },
            zIndex: layoutStore.allocateZIndex(),
            visible: true
          },
          source: LayoutSource.AgentRemote,
          actor: context.actor,
          opId: context.opId,
          timestamp: Date.now()
        })
      },
      deleteNodes() {}
    }
  })
}

function agentOperation(id: string, version: number, payload: object) {
  return {
    op_id: id,
    actor: 'agent:test',
    base_version: version,
    stamp: [version, 'agent:test', id],
    ...payload
  }
}

/** Runs comfy-cli's ops through the doc host applier and the live follower. */
function followAgent(graph: LGraph) {
  const host = mint({ nodes: [], links: [] }, CATALOG)
  const follower = new FollowerDoc()
  const adapter = new EcsFollowerAdapter(remoteMutations(graphScopeOf(graph)))
  adapter.bind('workflow', follower)
  let seq = 0
  let initial = true
  const deliver = (payload: object) => {
    const before = Y.encodeStateVector(host)
    const opId = `agent-op-${++seq}`
    const { outcomes } = applyOps(
      host,
      [agentOperation(opId, seq, payload)] as Parameters<typeof applyOps>[1],
      CATALOG
    )
    expect(outcomes).toEqual([{ op_id: opId, outcome: 'applied' }])
    const update = initial
      ? Y.encodeStateAsUpdate(host)
      : Y.encodeStateAsUpdate(host, before)
    initial = false
    follower.applyRemoteUpdate(update)
    expect(
      adapter.applyFrame({
        workflowId: 'workflow',
        seq,
        update,
        actor: 'agent:test',
        opIds: [opId]
      })
    ).toBe(true)
    reconcileAgentAdapters(graph)
  }
  const destroy = () => {
    adapter.destroy()
    follower.destroy()
    host.destroy()
  }
  return { deliver, destroy }
}

/** comfy-cli's add_node: the node snapshot exactly as `workflow apply` emits it. */
function addNode(
  id: number,
  type: string,
  node: {
    inputs?: object[]
    outputs?: object[]
    widgets_values?: unknown[]
  }
) {
  return {
    op: 'add_node',
    node_id: id,
    class_type: type,
    pos: [id * 100, 0],
    node: {
      id,
      type,
      pos: [id * 100, 0],
      size: [200, 100],
      inputs: [],
      outputs: [],
      ...node
    }
  }
}

async function queuedPrompt(graph: LGraph) {
  const { output } = await graphToPrompt(graph)
  return output
}

beforeEach(() => {
  LiteGraph.registerNodeType('VideoSource', VideoSource)
  LiteGraph.registerNodeType('AudioSource', AudioSource)
  LiteGraph.registerNodeType('ConcatenateVideo', ConcatenateVideo)
  LiteGraph.registerNodeType('SaveVideo', SaveVideo)
  LiteGraph.registerNodeType('EmptyHunyuanLatentVideo', EmptyHunyuanLatentVideo)
  LiteGraph.registerNodeType('SaveLatent', SaveLatent)
  for (const type of OUTPUT_NODES) {
    const ctor = LiteGraph.registered_node_types[type] as unknown as {
      nodeData?: { output_node: boolean }
    }
    ctor.nodeData = { output_node: true }
  }
})

describe('canvas prompt after the agent builds a graph', () => {
  it('wires autogrow slots and a concrete-slot link to the inputs the agent named', async () => {
    const graph = new LGraph()
    const { deliver, destroy } = followAgent(graph)

    deliver(
      addNode(1, 'VideoSource', {
        outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }]
      })
    )
    deliver(
      addNode(2, 'VideoSource', {
        outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }]
      })
    )
    deliver(
      addNode(3, 'AudioSource', {
        outputs: [{ name: 'AUDIO', type: 'AUDIO', links: [] }]
      })
    )
    deliver(
      addNode(4, 'ConcatenateVideo', {
        inputs: [
          { name: 'videos', type: 'COMFY_AUTOGROW_V3', link: null },
          { name: 'complete_audio', type: 'AUDIO', link: null }
        ],
        outputs: [{ name: 'VIDEO', type: 'VIDEO', links: [] }],
        widgets_values: ['auto']
      })
    )
    deliver(
      addNode(5, 'SaveVideo', {
        inputs: [{ name: 'video', type: 'VIDEO', link: null }]
      })
    )
    const link = (id: number, from: number, type: string) => ({
      op: 'connect',
      link_id: id,
      from_node: from,
      from_slot: 0,
      to_node: 4,
      link_type: type
    })
    deliver({
      ...link(11, 1, 'VIDEO'),
      to_slot: null,
      grow: { name: 'videos.video0', type: 'VIDEO' }
    })
    deliver({
      ...link(12, 2, 'VIDEO'),
      to_slot: null,
      grow: { name: 'videos.video1', type: 'VIDEO' }
    })
    deliver({ ...link(13, 3, 'AUDIO'), to_slot: 1, grow: null })
    deliver({
      op: 'connect',
      link_id: 14,
      from_node: 4,
      from_slot: 0,
      to_node: 5,
      to_slot: 0,
      grow: null,
      link_type: 'VIDEO'
    })

    const prompt = await queuedPrompt(graph)
    expect(prompt['4'].inputs).toEqual({
      'videos.video0': ['1', 0],
      'videos.video1': ['2', 0],
      complete_audio: ['3', 0],
      codec: 'auto'
    })
    destroy()
  })

  it('submits the widget values of a node the agent added', async () => {
    const graph = new LGraph()
    const { deliver, destroy } = followAgent(graph)

    deliver(
      addNode(1, 'EmptyHunyuanLatentVideo', {
        outputs: [{ name: 'LATENT', type: 'LATENT', links: [] }],
        widgets_values: [640, 480, 25, 1]
      })
    )
    deliver(
      addNode(2, 'SaveLatent', {
        inputs: [{ name: 'samples', type: 'LATENT', link: null }]
      })
    )
    deliver({
      op: 'connect',
      link_id: 21,
      from_node: 1,
      from_slot: 0,
      to_node: 2,
      to_slot: 0,
      grow: null,
      link_type: 'LATENT'
    })

    const prompt = await queuedPrompt(graph)
    expect(prompt['1'].inputs).toEqual({
      width: 640,
      height: 480,
      length: 25,
      batch_size: 1
    })
    destroy()
  })
})
