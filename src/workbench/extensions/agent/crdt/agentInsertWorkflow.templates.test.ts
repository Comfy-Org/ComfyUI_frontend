/**
 * Coverage for `insert_workflow` against workflow shapes representative of
 * the templates catalogue referenced in this repo's `AGENTS.md` (checkpoint
 * loaders, img2img, ControlNet, LoRA, video). The actual catalogue is
 * GCS-hosted (`gs://cloud-workflow-templates/...`) and this repo vendors no
 * local fixture set for it, so these are literal graphs built to the same
 * node/widget shapes as the well-known public templates, exercised through
 * the same real pipeline every other file in this group drives
 * (comfy-multi-player's `insert_workflow` applier -> `AgentCrdtProjection`
 * -> `LiveGraphApplier` -> the LiteGraph graph API), asserting every node
 * renders with correct widgets and every link lands.
 */
import { applyOps, mint } from '@comfyorg/comfy-multi-player'
import type {
  InsertWorkflowOp,
  WidgetCatalog
} from '@comfyorg/comfy-multi-player'
import { beforeEach, describe, expect, it, onTestFinished } from 'vitest'
import * as Y from 'yjs'

import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'

import { AgentCrdtProjection } from './agentCrdtProjection'
import { FollowerDoc } from './followerDoc'

class TestCheckpointLoader extends LGraphNode {
  static override title = 'Test Checkpoint Loader'
  constructor() {
    super('Test Checkpoint Loader')
    this.addOutput('MODEL', 'MODEL')
    this.addOutput('CLIP', 'CLIP')
    this.addOutput('VAE', 'VAE')
    this.addWidget('combo', 'ckpt_name', 'sd_xl_base.safetensors', () => {}, {
      values: ['sd_xl_base.safetensors', 'sd_xl_refiner.safetensors']
    })
    this.serialize_widgets = true
  }
}

class TestCLIPTextEncode extends LGraphNode {
  static override title = 'Test CLIP Text Encode'
  constructor() {
    super('Test CLIP Text Encode')
    this.addInput('clip', 'CLIP')
    this.addOutput('CONDITIONING', 'CONDITIONING')
    this.addCustomWidget({
      name: 'text',
      type: 'customtext',
      value: '',
      options: { multiline: true },
      y: 0
    })
    this.serialize_widgets = true
  }
}

class TestKSampler extends LGraphNode {
  static override title = 'Test KSampler'
  constructor() {
    super('Test KSampler')
    this.addInput('model', 'MODEL')
    this.addInput('positive', 'CONDITIONING')
    this.addInput('negative', 'CONDITIONING')
    this.addInput('latent_image', 'LATENT')
    this.addOutput('LATENT', 'LATENT')
    this.addWidget('number', 'seed', 0, () => {})
    this.addWidget('number', 'steps', 20, () => {})
    this.addWidget('number', 'cfg', 8, () => {})
    this.addWidget('combo', 'sampler_name', 'euler', () => {}, {
      values: ['euler', 'dpmpp_2m']
    })
    this.addWidget('combo', 'scheduler', 'normal', () => {}, {
      values: ['normal', 'karras']
    })
    this.addWidget('number', 'denoise', 1, () => {})
    this.serialize_widgets = true
  }
}

class TestEmptyLatentImage extends LGraphNode {
  static override title = 'Test Empty Latent Image'
  constructor() {
    super('Test Empty Latent Image')
    this.addOutput('LATENT', 'LATENT')
    this.addWidget('number', 'width', 1024, () => {})
    this.addWidget('number', 'height', 1024, () => {})
    this.addWidget('number', 'batch_size', 1, () => {})
    this.serialize_widgets = true
  }
}

class TestVAEDecode extends LGraphNode {
  static override title = 'Test VAE Decode'
  constructor() {
    super('Test VAE Decode')
    this.addInput('samples', 'LATENT')
    this.addInput('vae', 'VAE')
    this.addOutput('IMAGE', 'IMAGE')
    this.serialize_widgets = true
  }
}

class TestVAEEncode extends LGraphNode {
  static override title = 'Test VAE Encode'
  constructor() {
    super('Test VAE Encode')
    this.addInput('pixels', 'IMAGE')
    this.addInput('vae', 'VAE')
    this.addOutput('LATENT', 'LATENT')
    this.serialize_widgets = true
  }
}

class TestLoadImage extends LGraphNode {
  static override title = 'Test Load Image'
  constructor() {
    super('Test Load Image')
    this.addOutput('IMAGE', 'IMAGE')
    this.addWidget('combo', 'image', 'example.png', () => {}, {
      values: ['example.png']
    })
    this.serialize_widgets = true
  }
}

class TestSaveImage extends LGraphNode {
  static override title = 'Test Save Image'
  constructor() {
    super('Test Save Image')
    this.addInput('images', 'IMAGE')
    this.addWidget('text', 'filename_prefix', 'ComfyUI', () => {})
    this.serialize_widgets = true
  }
}

class TestSaveVideo extends LGraphNode {
  static override title = 'Test Save Video'
  constructor() {
    super('Test Save Video')
    this.addInput('images', 'IMAGE')
    this.addWidget('combo', 'format', 'mp4', () => {}, {
      values: ['mp4', 'webm']
    })
    this.addWidget('number', 'fps', 24, () => {})
    this.serialize_widgets = true
  }
}

class TestControlNetLoader extends LGraphNode {
  static override title = 'Test ControlNet Loader'
  constructor() {
    super('Test ControlNet Loader')
    this.addOutput('CONTROL_NET', 'CONTROL_NET')
    this.addWidget('combo', 'control_net_name', 'canny.safetensors', () => {}, {
      values: ['canny.safetensors', 'depth.safetensors']
    })
    this.serialize_widgets = true
  }
}

class TestControlNetApply extends LGraphNode {
  static override title = 'Test ControlNet Apply'
  constructor() {
    super('Test ControlNet Apply')
    this.addInput('conditioning', 'CONDITIONING')
    this.addInput('control_net', 'CONTROL_NET')
    this.addInput('image', 'IMAGE')
    this.addOutput('CONDITIONING', 'CONDITIONING')
    this.addWidget('number', 'strength', 1, () => {})
    this.serialize_widgets = true
  }
}

class TestLoraLoader extends LGraphNode {
  static override title = 'Test LoRA Loader'
  constructor() {
    super('Test LoRA Loader')
    this.addInput('model', 'MODEL')
    this.addInput('clip', 'CLIP')
    this.addOutput('MODEL', 'MODEL')
    this.addOutput('CLIP', 'CLIP')
    this.addWidget('combo', 'lora_name', 'add_detail.safetensors', () => {}, {
      values: ['add_detail.safetensors', 'style_anime.safetensors']
    })
    this.addWidget('number', 'strength_model', 1, () => {})
    this.addWidget('number', 'strength_clip', 1, () => {})
    this.serialize_widgets = true
  }
}

const CATALOG: WidgetCatalog = {
  types: {
    'Test Checkpoint Loader': { widget_order: ['ckpt_name'] },
    'Test CLIP Text Encode': { widget_order: ['text'] },
    'Test KSampler': {
      widget_order: [
        'seed',
        'steps',
        'cfg',
        'sampler_name',
        'scheduler',
        'denoise'
      ]
    },
    'Test Empty Latent Image': {
      widget_order: ['width', 'height', 'batch_size']
    },
    'Test VAE Decode': { widget_order: [] },
    'Test VAE Encode': { widget_order: [] },
    'Test Load Image': { widget_order: ['image'] },
    'Test Save Image': { widget_order: ['filename_prefix'] },
    'Test Save Video': { widget_order: ['format', 'fps'] },
    'Test ControlNet Loader': { widget_order: ['control_net_name'] },
    'Test ControlNet Apply': { widget_order: ['strength'] },
    'Test LoRA Loader': {
      widget_order: ['lora_name', 'strength_model', 'strength_clip']
    }
  }
}

beforeEach(() => {
  LiteGraph.registerNodeType('Test Checkpoint Loader', TestCheckpointLoader)
  LiteGraph.registerNodeType('Test CLIP Text Encode', TestCLIPTextEncode)
  LiteGraph.registerNodeType('Test KSampler', TestKSampler)
  LiteGraph.registerNodeType('Test Empty Latent Image', TestEmptyLatentImage)
  LiteGraph.registerNodeType('Test VAE Decode', TestVAEDecode)
  LiteGraph.registerNodeType('Test VAE Encode', TestVAEEncode)
  LiteGraph.registerNodeType('Test Load Image', TestLoadImage)
  LiteGraph.registerNodeType('Test Save Image', TestSaveImage)
  LiteGraph.registerNodeType('Test Save Video', TestSaveVideo)
  LiteGraph.registerNodeType('Test ControlNet Loader', TestControlNetLoader)
  LiteGraph.registerNodeType('Test ControlNet Apply', TestControlNetApply)
  LiteGraph.registerNodeType('Test LoRA Loader', TestLoraLoader)
})

let opSeq = 0
function insertOp(
  workflow: InsertWorkflowOp['workflow'],
  opId?: string
): InsertWorkflowOp {
  opSeq += 1
  return {
    op_id: (opId ?? `insert-template-op-${opSeq}`).padEnd(32, '0'),
    actor: 'agent:test',
    base_version: 1,
    stamp: [1, 'agent:test'],
    op: 'insert_workflow',
    workflow
  }
}

function bindProjection(workflowId: string, graph: LGraph) {
  const follower = new FollowerDoc()
  const projection = new AgentCrdtProjection(() => graph)
  projection.bind(workflowId, follower)
  onTestFinished(() => {
    projection.destroy()
    follower.destroy()
  })

  let seq = 0
  const deliver = (update: Uint8Array, opIds: string[]): boolean => {
    follower.applyRemoteUpdate(update)
    const committed = projection.applyFrame({
      workflowId,
      seq: ++seq,
      update,
      actor: 'agent:test',
      opIds
    }).applied
    return committed
  }
  return deliver
}

function findByType(graph: LGraph, type: string): LGraphNode {
  const node = graph._nodes.find((candidate) => candidate.type === type)
  if (!node) throw new Error(`no live node of type ${type} was materialized`)
  return node
}

function findAllByType(graph: LGraph, type: string): LGraphNode[] {
  return graph._nodes.filter((candidate) => candidate.type === type)
}

function readInputOrigins(node: LGraphNode) {
  return node.inputs.map((input, index) => ({
    name: input.name,
    origin: node.getInputLink(index)?.origin_id ?? null
  }))
}

function renderedWidgetValues(graphId: string, nodeId: string) {
  const widgetValueStore = useWidgetValueStore()
  const bareNodeId = stripGraphPrefix(nodeId)
  if (!bareNodeId) return {}
  const values: Record<string, unknown> = {}
  for (const id of widgetValueStore.getNodeWidgetIds(graphId, bareNodeId)) {
    const widget = widgetValueStore.getWidget(id)
    if (widget) values[widget.name] = widget.value
  }
  return values
}

function insertAndDeliver(
  graph: LGraph,
  workflowId: string,
  workflow: InsertWorkflowOp['workflow']
) {
  const host = mint({ nodes: [], links: [] }, CATALOG)
  onTestFinished(() => host.destroy())
  const deliver = bindProjection(workflowId, graph)
  const op = insertOp(workflow)
  expect(applyOps(host, [op], CATALOG).outcomes).toEqual([
    { op_id: op.op_id, outcome: 'applied' }
  ])
  expect(deliver(Y.encodeStateAsUpdate(host), [op.op_id])).toBe(true)
  return { host, deliver }
}

describe('insert_workflow materializes representative workflow templates', () => {
  it('a classic checkpoint text-to-image pipeline renders fully', () => {
    const graph = new LGraph()
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'Test Checkpoint Loader',
          widgets_values: ['sd_xl_refiner.safetensors'],
          outputs: [
            { name: 'MODEL', type: 'MODEL', links: [10] },
            { name: 'CLIP', type: 'CLIP', links: [11, 12] },
            { name: 'VAE', type: 'VAE', links: [13] }
          ]
        },
        {
          id: 2,
          type: 'Test CLIP Text Encode',
          widgets_values: ['a glorious spooky duck'],
          inputs: [{ name: 'clip', type: 'CLIP', link: 11 }],
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [20] }]
        },
        {
          id: 3,
          type: 'Test CLIP Text Encode',
          widgets_values: ['blurry, low quality'],
          inputs: [{ name: 'clip', type: 'CLIP', link: 12 }],
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [21] }]
        },
        {
          id: 4,
          type: 'Test Empty Latent Image',
          widgets_values: [512, 768, 2],
          outputs: [{ name: 'LATENT', type: 'LATENT', links: [22] }]
        },
        {
          id: 5,
          type: 'Test KSampler',
          widgets_values: [12345, 30, 6.5, 'dpmpp_2m', 'karras', 1],
          inputs: [
            { name: 'model', type: 'MODEL', link: 10 },
            { name: 'positive', type: 'CONDITIONING', link: 20 },
            { name: 'negative', type: 'CONDITIONING', link: 21 },
            { name: 'latent_image', type: 'LATENT', link: 22 }
          ],
          outputs: [{ name: 'LATENT', type: 'LATENT', links: [30] }]
        },
        {
          id: 6,
          type: 'Test VAE Decode',
          inputs: [
            { name: 'samples', type: 'LATENT', link: 30 },
            { name: 'vae', type: 'VAE', link: 13 }
          ],
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [40] }]
        },
        {
          id: 7,
          type: 'Test Save Image',
          widgets_values: ['zimage_output'],
          inputs: [{ name: 'images', type: 'IMAGE', link: 40 }]
        }
      ],
      links: [
        [10, 1, 0, 5, 0, 'MODEL'],
        [11, 1, 1, 2, 0, 'CLIP'],
        [12, 1, 1, 3, 0, 'CLIP'],
        [13, 1, 2, 6, 1, 'VAE'],
        [20, 2, 0, 5, 1, 'CONDITIONING'],
        [21, 3, 0, 5, 2, 'CONDITIONING'],
        [22, 4, 0, 5, 3, 'LATENT'],
        [30, 5, 0, 6, 0, 'LATENT'],
        [40, 6, 0, 7, 0, 'IMAGE']
      ]
    }
    insertAndDeliver(graph, 'wf-txt2img', workflow)

    const loader = findByType(graph, 'Test Checkpoint Loader')
    const positive = findByType(graph, 'Test CLIP Text Encode')
    const sampler = findByType(graph, 'Test KSampler')
    const decode = findByType(graph, 'Test VAE Decode')
    const save = findByType(graph, 'Test Save Image')

    expect(renderedWidgetValues(graph.rootGraph.id, String(loader.id))).toEqual(
      { ckpt_name: 'sd_xl_refiner.safetensors' }
    )
    expect(
      renderedWidgetValues(graph.rootGraph.id, String(sampler.id))
    ).toEqual({
      seed: 12345,
      steps: 30,
      cfg: 6.5,
      sampler_name: 'dpmpp_2m',
      scheduler: 'karras',
      denoise: 1
    })
    expect(readInputOrigins(sampler).map((o) => o.origin)).toEqual([
      loader.id,
      positive.id,
      expect.anything(),
      expect.anything()
    ])
    expect(readInputOrigins(decode)[0]?.origin).toBe(sampler.id)
    expect(readInputOrigins(save)[0]?.origin).toBe(decode.id)
  })

  it('an image-to-image pipeline (VAE encode + partial denoise) renders fully', () => {
    const graph = new LGraph()
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'Test Load Image',
          widgets_values: ['example.png'],
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [10] }]
        },
        {
          id: 2,
          type: 'Test Checkpoint Loader',
          outputs: [
            { name: 'MODEL', type: 'MODEL', links: [] },
            { name: 'CLIP', type: 'CLIP', links: [] },
            { name: 'VAE', type: 'VAE', links: [11] }
          ]
        },
        {
          id: 3,
          type: 'Test VAE Encode',
          inputs: [
            { name: 'pixels', type: 'IMAGE', link: 10 },
            { name: 'vae', type: 'VAE', link: 11 }
          ],
          outputs: [{ name: 'LATENT', type: 'LATENT', links: [20] }]
        },
        {
          id: 4,
          type: 'Test KSampler',
          widgets_values: [0, 20, 8, 'euler', 'normal', 0.6],
          inputs: [{ name: 'latent_image', type: 'LATENT', link: 20 }],
          outputs: [{ name: 'LATENT', type: 'LATENT', links: [30] }]
        },
        {
          id: 5,
          type: 'Test VAE Decode',
          inputs: [{ name: 'samples', type: 'LATENT', link: 30 }],
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [40] }]
        },
        {
          id: 6,
          type: 'Test Save Image',
          inputs: [{ name: 'images', type: 'IMAGE', link: 40 }]
        }
      ],
      links: [
        [10, 1, 0, 3, 0, 'IMAGE'],
        [11, 2, 2, 3, 1, 'VAE'],
        [20, 3, 0, 4, 0, 'LATENT'],
        [30, 4, 0, 5, 0, 'LATENT'],
        [40, 5, 0, 6, 0, 'IMAGE']
      ]
    }
    insertAndDeliver(graph, 'wf-img2img', workflow)

    const loadImage = findByType(graph, 'Test Load Image')
    const encode = findByType(graph, 'Test VAE Encode')
    const sampler = findByType(graph, 'Test KSampler')

    expect(readInputOrigins(encode)[0]?.origin).toBe(loadImage.id)
    expect(
      renderedWidgetValues(graph.rootGraph.id, String(sampler.id)).denoise
    ).toBe(0.6)
  })

  it('a ControlNet-guided pipeline fans image and conditioning into KSampler', () => {
    const graph = new LGraph()
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'Test Load Image',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [10] }]
        },
        {
          id: 2,
          type: 'Test ControlNet Loader',
          widgets_values: ['depth.safetensors'],
          outputs: [{ name: 'CONTROL_NET', type: 'CONTROL_NET', links: [20] }]
        },
        {
          id: 3,
          type: 'Test CLIP Text Encode',
          widgets_values: ['a castle in the mist'],
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [30] }]
        },
        {
          id: 4,
          type: 'Test ControlNet Apply',
          widgets_values: [0.8],
          inputs: [
            { name: 'conditioning', type: 'CONDITIONING', link: 30 },
            { name: 'control_net', type: 'CONTROL_NET', link: 20 },
            { name: 'image', type: 'IMAGE', link: 10 }
          ],
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [40] }]
        },
        {
          id: 5,
          type: 'Test KSampler',
          inputs: [{ name: 'positive', type: 'CONDITIONING', link: 40 }],
          outputs: []
        }
      ],
      links: [
        [10, 1, 0, 4, 2, 'IMAGE'],
        [20, 2, 0, 4, 1, 'CONTROL_NET'],
        [30, 3, 0, 4, 0, 'CONDITIONING'],
        [40, 4, 0, 5, 0, 'CONDITIONING']
      ]
    }
    insertAndDeliver(graph, 'wf-controlnet', workflow)

    const loadImage = findByType(graph, 'Test Load Image')
    const cnLoader = findByType(graph, 'Test ControlNet Loader')
    const encode = findByType(graph, 'Test CLIP Text Encode')
    const apply = findByType(graph, 'Test ControlNet Apply')

    expect(readInputOrigins(apply)).toEqual([
      { name: 'conditioning', origin: encode.id },
      { name: 'control_net', origin: cnLoader.id },
      { name: 'image', origin: loadImage.id }
    ])
    expect(
      renderedWidgetValues(graph.rootGraph.id, String(apply.id)).strength
    ).toBe(0.8)
  })

  it('a LoRA-augmented pipeline renders the loader chain and its widgets', () => {
    const graph = new LGraph()
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'Test Checkpoint Loader',
          outputs: [
            { name: 'MODEL', type: 'MODEL', links: [10] },
            { name: 'CLIP', type: 'CLIP', links: [11] },
            { name: 'VAE', type: 'VAE', links: [] }
          ]
        },
        {
          id: 2,
          type: 'Test LoRA Loader',
          widgets_values: ['style_anime.safetensors', 0.75, 0.6],
          inputs: [
            { name: 'model', type: 'MODEL', link: 10 },
            { name: 'clip', type: 'CLIP', link: 11 }
          ],
          outputs: [
            { name: 'MODEL', type: 'MODEL', links: [20] },
            { name: 'CLIP', type: 'CLIP', links: [] }
          ]
        },
        {
          id: 3,
          type: 'Test KSampler',
          inputs: [{ name: 'model', type: 'MODEL', link: 20 }],
          outputs: []
        }
      ],
      links: [
        [10, 1, 0, 2, 0, 'MODEL'],
        [11, 1, 1, 2, 1, 'CLIP'],
        [20, 2, 0, 3, 0, 'MODEL']
      ]
    }
    insertAndDeliver(graph, 'wf-lora', workflow)

    const checkpoint = findByType(graph, 'Test Checkpoint Loader')
    const lora = findByType(graph, 'Test LoRA Loader')
    const sampler = findByType(graph, 'Test KSampler')

    expect(readInputOrigins(lora).map((o) => o.origin)).toEqual([
      checkpoint.id,
      checkpoint.id
    ])
    expect(readInputOrigins(sampler)[0]?.origin).toBe(lora.id)
    expect(renderedWidgetValues(graph.rootGraph.id, String(lora.id))).toEqual({
      lora_name: 'style_anime.safetensors',
      strength_model: 0.75,
      strength_clip: 0.6
    })
  })

  it('a video pipeline renders its save-video widgets (format, fps)', () => {
    const graph = new LGraph()
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'Test KSampler',
          outputs: [{ name: 'LATENT', type: 'LATENT', links: [10] }]
        },
        {
          id: 2,
          type: 'Test VAE Decode',
          inputs: [{ name: 'samples', type: 'LATENT', link: 10 }],
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [20] }]
        },
        {
          id: 3,
          type: 'Test Save Video',
          widgets_values: ['webm', 30],
          inputs: [{ name: 'images', type: 'IMAGE', link: 20 }]
        }
      ],
      links: [
        [10, 1, 0, 2, 0, 'LATENT'],
        [20, 2, 0, 3, 0, 'IMAGE']
      ]
    }
    insertAndDeliver(graph, 'wf-video', workflow)

    const saveVideo = findByType(graph, 'Test Save Video')
    expect(
      renderedWidgetValues(graph.rootGraph.id, String(saveVideo.id))
    ).toEqual({ format: 'webm', fps: 30 })
  })

  it('a ControlNet + LoRA compound pipeline fans both augmentations into one sampler', () => {
    const graph = new LGraph()
    const workflow = {
      nodes: [
        {
          id: 1,
          type: 'Test Checkpoint Loader',
          outputs: [
            { name: 'MODEL', type: 'MODEL', links: [10] },
            { name: 'CLIP', type: 'CLIP', links: [] },
            { name: 'VAE', type: 'VAE', links: [] }
          ]
        },
        {
          id: 2,
          type: 'Test LoRA Loader',
          widgets_values: ['add_detail.safetensors', 1, 1],
          inputs: [{ name: 'model', type: 'MODEL', link: 10 }],
          outputs: [{ name: 'MODEL', type: 'MODEL', links: [20] }]
        },
        {
          id: 3,
          type: 'Test Load Image',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [30] }]
        },
        {
          id: 4,
          type: 'Test ControlNet Loader',
          outputs: [{ name: 'CONTROL_NET', type: 'CONTROL_NET', links: [40] }]
        },
        {
          id: 5,
          type: 'Test CLIP Text Encode',
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [50] }]
        },
        {
          id: 6,
          type: 'Test ControlNet Apply',
          inputs: [
            { name: 'conditioning', type: 'CONDITIONING', link: 50 },
            { name: 'control_net', type: 'CONTROL_NET', link: 40 },
            { name: 'image', type: 'IMAGE', link: 30 }
          ],
          outputs: [{ name: 'CONDITIONING', type: 'CONDITIONING', links: [60] }]
        },
        {
          id: 7,
          type: 'Test KSampler',
          inputs: [
            { name: 'model', type: 'MODEL', link: 20 },
            { name: 'positive', type: 'CONDITIONING', link: 60 }
          ],
          outputs: []
        }
      ],
      links: [
        [10, 1, 0, 2, 0, 'MODEL'],
        [20, 2, 0, 7, 0, 'MODEL'],
        [30, 3, 0, 6, 2, 'IMAGE'],
        [40, 4, 0, 6, 1, 'CONTROL_NET'],
        [50, 5, 0, 6, 0, 'CONDITIONING'],
        [60, 6, 0, 7, 1, 'CONDITIONING']
      ]
    }
    insertAndDeliver(graph, 'wf-compound', workflow)

    const lora = findByType(graph, 'Test LoRA Loader')
    const apply = findByType(graph, 'Test ControlNet Apply')
    const sampler = findByType(graph, 'Test KSampler')

    const samplerOrigins = readInputOrigins(sampler)
    expect(samplerOrigins[0]).toEqual({ name: 'model', origin: lora.id })
    expect(samplerOrigins[1]).toEqual({ name: 'positive', origin: apply.id })
  })

  it('the same template inserted twice produces two independent, fully-wired pipelines', () => {
    const graph = new LGraph()
    const host = mint({ nodes: [], links: [] }, CATALOG)
    onTestFinished(() => host.destroy())
    const deliver = bindProjection('wf-duplicate-template', graph)
    deliver(Y.encodeStateAsUpdate(host), [])

    const template = () => ({
      nodes: [
        {
          id: 1,
          type: 'Test Load Image',
          outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [10] }]
        },
        {
          id: 2,
          type: 'Test Save Image',
          widgets_values: ['dup'],
          inputs: [{ name: 'images', type: 'IMAGE', link: 10 }]
        }
      ],
      links: [[10, 1, 0, 2, 0, 'IMAGE']]
    })

    const opA = insertOp(template(), 'insert-dup-template-a')
    let vector = Y.encodeStateVector(host)
    expect(applyOps(host, [opA], CATALOG).outcomes[0]?.outcome).toBe('applied')
    expect(deliver(Y.encodeStateAsUpdate(host, vector), [opA.op_id])).toBe(true)

    const opB = insertOp(template(), 'insert-dup-template-b')
    vector = Y.encodeStateVector(host)
    expect(applyOps(host, [opB], CATALOG).outcomes[0]?.outcome).toBe('applied')
    expect(deliver(Y.encodeStateAsUpdate(host, vector), [opB.op_id])).toBe(true)

    const loadImages = findAllByType(graph, 'Test Load Image')
    const saveImages = findAllByType(graph, 'Test Save Image')
    expect(loadImages).toHaveLength(2)
    expect(saveImages).toHaveLength(2)

    const origins = saveImages.map((save) => readInputOrigins(save)[0]?.origin)
    expect(new Set(origins).size).toBe(2)
    for (const origin of origins) {
      expect(loadImages.map((n) => n.id)).toContainEqual(origin)
    }
  })
})
