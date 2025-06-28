import {
  type INodeOutputSlot,
  type LGraph,
  type LGraphNode,
  LLink,
  LiteGraph,
  type Point
} from '@comfyorg/litegraph'
import type { IBaseWidget } from '@comfyorg/litegraph/dist/types/widgets'
import _ from 'lodash'

import { parseFilePath } from '@/utils/formatUtil'

import { app } from './app'

const fluxKontextGroupNode = {
  nodes: [
    {
      id: -1,
      type: 'Reroute',
      pos: [2354.87890625, -127.23468780517578],
      size: [75, 26],
      flags: {},
      order: 20,
      mode: 0,
      inputs: [{ name: '', type: '*', link: null }],
      outputs: [{ name: '', type: '*', links: null }],
      properties: { showOutputText: false, horizontal: false },
      index: 0
    },
    {
      id: -1,
      type: 'ReferenceLatent',
      pos: [2730, -220],
      size: [197.712890625, 46],
      flags: {},
      order: 22,
      mode: 0,
      inputs: [
        {
          localized_name: 'conditioning',
          name: 'conditioning',
          type: 'CONDITIONING',
          link: null
        },
        {
          localized_name: 'latent',
          name: 'latent',
          shape: 7,
          type: 'LATENT',
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'CONDITIONING',
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          links: []
        }
      ],
      properties: {
        'Node name for S&R': 'ReferenceLatent',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      index: 1
    },
    {
      id: -1,
      type: 'VAEDecode',
      pos: [3270, -110],
      size: [210, 46],
      flags: {},
      order: 25,
      mode: 0,
      inputs: [
        {
          localized_name: 'samples',
          name: 'samples',
          type: 'LATENT',
          link: null
        },
        {
          localized_name: 'vae',
          name: 'vae',
          type: 'VAE',
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'IMAGE',
          name: 'IMAGE',
          type: 'IMAGE',
          slot_index: 0,
          links: []
        }
      ],
      properties: {
        'Node name for S&R': 'VAEDecode',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      index: 2
    },
    {
      id: -1,
      type: 'KSampler',
      pos: [2930, -110],
      size: [315, 262],
      flags: {},
      order: 24,
      mode: 0,
      inputs: [
        {
          localized_name: 'model',
          name: 'model',
          type: 'MODEL',
          link: null
        },
        {
          localized_name: 'positive',
          name: 'positive',
          type: 'CONDITIONING',
          link: null
        },
        {
          localized_name: 'negative',
          name: 'negative',
          type: 'CONDITIONING',
          link: null
        },
        {
          localized_name: 'latent_image',
          name: 'latent_image',
          type: 'LATENT',
          link: null
        },
        {
          localized_name: 'seed',
          name: 'seed',
          type: 'INT',
          widget: { name: 'seed' },
          link: null
        },
        {
          localized_name: 'steps',
          name: 'steps',
          type: 'INT',
          widget: { name: 'steps' },
          link: null
        },
        {
          localized_name: 'cfg',
          name: 'cfg',
          type: 'FLOAT',
          widget: { name: 'cfg' },
          link: null
        },
        {
          localized_name: 'sampler_name',
          name: 'sampler_name',
          type: 'COMBO',
          widget: { name: 'sampler_name' },
          link: null
        },
        {
          localized_name: 'scheduler',
          name: 'scheduler',
          type: 'COMBO',
          widget: { name: 'scheduler' },
          link: null
        },
        {
          localized_name: 'denoise',
          name: 'denoise',
          type: 'FLOAT',
          widget: { name: 'denoise' },
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'LATENT',
          name: 'LATENT',
          type: 'LATENT',
          slot_index: 0,
          links: []
        }
      ],
      properties: {
        'Node name for S&R': 'KSampler',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      widgets_values: [972054013131369, 'fixed', 20, 1, 'euler', 'simple', 1],
      index: 3
    },
    {
      id: -1,
      type: 'FluxGuidance',
      pos: [2940, -220],
      size: [211.60000610351562, 58],
      flags: {},
      order: 23,
      mode: 0,
      inputs: [
        {
          localized_name: 'conditioning',
          name: 'conditioning',
          type: 'CONDITIONING',
          link: null
        },
        {
          localized_name: 'guidance',
          name: 'guidance',
          type: 'FLOAT',
          widget: { name: 'guidance' },
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'CONDITIONING',
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          slot_index: 0,
          links: []
        }
      ],
      properties: {
        'Node name for S&R': 'FluxGuidance',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      widgets_values: [2.5],
      index: 4
    },
    {
      id: -1,
      type: 'SaveImage',
      pos: [3490, -110],
      size: [985.3012084960938, 1060.3828125],
      flags: {},
      order: 26,
      mode: 0,
      inputs: [
        {
          localized_name: 'images',
          name: 'images',
          type: 'IMAGE',
          link: null
        },
        {
          localized_name: 'filename_prefix',
          name: 'filename_prefix',
          type: 'STRING',
          widget: { name: 'filename_prefix' },
          link: null
        }
      ],
      outputs: [],
      properties: { cnr_id: 'comfy-core', ver: '0.3.38' },
      widgets_values: ['ComfyUI'],
      index: 5
    },
    {
      id: -1,
      type: 'CLIPTextEncode',
      pos: [2500, -110],
      size: [422.84503173828125, 164.31304931640625],
      flags: {},
      order: 12,
      mode: 0,
      inputs: [
        {
          localized_name: 'clip',
          name: 'clip',
          type: 'CLIP',
          link: null
        },
        {
          localized_name: 'text',
          name: 'text',
          type: 'STRING',
          widget: { name: 'text' },
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'CONDITIONING',
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          slot_index: 0,
          links: []
        }
      ],
      title: 'CLIP Text Encode (Positive Prompt)',
      properties: {
        'Node name for S&R': 'CLIPTextEncode',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      widgets_values: ['there is a bright light'],
      color: '#232',
      bgcolor: '#353',
      index: 6
    },
    {
      id: -1,
      type: 'CLIPTextEncode',
      pos: [2504.1435546875, 97.9598617553711],
      size: [422.84503173828125, 164.31304931640625],
      flags: { collapsed: true },
      order: 13,
      mode: 0,
      inputs: [
        {
          localized_name: 'clip',
          name: 'clip',
          type: 'CLIP',
          link: null
        },
        {
          localized_name: 'text',
          name: 'text',
          type: 'STRING',
          widget: { name: 'text' },
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'CONDITIONING',
          name: 'CONDITIONING',
          type: 'CONDITIONING',
          slot_index: 0,
          links: []
        }
      ],
      title: 'CLIP Text Encode (Negative Prompt)',
      properties: {
        'Node name for S&R': 'CLIPTextEncode',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      widgets_values: [''],
      color: '#322',
      bgcolor: '#533',
      index: 7
    },
    {
      id: -1,
      type: 'UNETLoader',
      pos: [2630, -370],
      size: [270, 82],
      flags: {},
      order: 6,
      mode: 0,
      inputs: [
        {
          localized_name: 'unet_name',
          name: 'unet_name',
          type: 'COMBO',
          widget: { name: 'unet_name' },
          link: null
        },
        {
          localized_name: 'weight_dtype',
          name: 'weight_dtype',
          type: 'COMBO',
          widget: { name: 'weight_dtype' },
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'MODEL',
          name: 'MODEL',
          type: 'MODEL',
          links: []
        }
      ],
      properties: {
        'Node name for S&R': 'UNETLoader',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      widgets_values: ['flux1-kontext-dev.safetensors', 'default'],
      color: '#223',
      bgcolor: '#335',
      index: 8
    },
    {
      id: -1,
      type: 'DualCLIPLoader',
      pos: [2100, -290],
      size: [337.76861572265625, 130],
      flags: {},
      order: 8,
      mode: 0,
      inputs: [
        {
          localized_name: 'clip_name1',
          name: 'clip_name1',
          type: 'COMBO',
          widget: { name: 'clip_name1' },
          link: null
        },
        {
          localized_name: 'clip_name2',
          name: 'clip_name2',
          type: 'COMBO',
          widget: { name: 'clip_name2' },
          link: null
        },
        {
          localized_name: 'type',
          name: 'type',
          type: 'COMBO',
          widget: { name: 'type' },
          link: null
        },
        {
          localized_name: 'device',
          name: 'device',
          shape: 7,
          type: 'COMBO',
          widget: { name: 'device' },
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'CLIP',
          name: 'CLIP',
          type: 'CLIP',
          links: []
        }
      ],
      properties: {
        'Node name for S&R': 'DualCLIPLoader',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      widgets_values: [
        'clip_l.safetensors',
        't5xxl_fp8_e4m3fn_scaled.safetensors',
        'flux',
        'default'
      ],
      color: '#223',
      bgcolor: '#335',
      index: 9
    },
    {
      id: -1,
      type: 'VAELoader',
      pos: [2960, -370],
      size: [270, 58],
      flags: {},
      order: 7,
      mode: 0,
      inputs: [
        {
          localized_name: 'vae_name',
          name: 'vae_name',
          type: 'COMBO',
          widget: { name: 'vae_name' },
          link: null
        }
      ],
      outputs: [
        {
          localized_name: 'VAE',
          name: 'VAE',
          type: 'VAE',
          links: []
        }
      ],
      properties: {
        'Node name for S&R': 'VAELoader',
        cnr_id: 'comfy-core',
        ver: '0.3.38'
      },
      widgets_values: ['ae.safetensors'],
      color: '#223',
      bgcolor: '#335',
      index: 10
    }
  ],
  links: [
    [6, 0, 1, 0, 72, 'CONDITIONING'],
    [0, 0, 1, 1, 66, '*'],
    [3, 0, 2, 0, 69, 'LATENT'],
    [10, 0, 2, 1, 76, 'VAE'],
    [8, 0, 3, 0, 74, 'MODEL'],
    [4, 0, 3, 1, 70, 'CONDITIONING'],
    [7, 0, 3, 2, 73, 'CONDITIONING'],
    [0, 0, 3, 3, 66, '*'],
    [1, 0, 4, 0, 67, 'CONDITIONING'],
    [2, 0, 5, 0, 68, 'IMAGE'],
    [9, 0, 6, 0, 75, 'CLIP'],
    [9, 0, 7, 0, 75, 'CLIP']
  ],
  external: [],
  config: {
    '0': {},
    '1': {},
    '2': { output: { '0': { visible: true } } },
    '3': {
      output: { '0': { visible: true } },
      input: {
        denoise: { visible: false },
        cfg: { visible: false }
      }
    },
    '4': {},
    '5': {},
    '6': {},
    '7': { input: { text: { visible: false } } },
    '8': { input: { weight_dtype: { visible: false } } },
    '9': { input: { type: { visible: false }, device: { visible: false } } },
    '10': {}
  }
}

export async function ensureGraphHasFluxKontextGroupNode(
  graph: LGraph & { extra: { groupNodes?: Record<string, any> } }
) {
  graph.extra ??= {}
  graph.extra.groupNodes ??= {}
  if (graph.extra.groupNodes['FLUX.1 Kontext Image Edit']) return

  graph.extra.groupNodes['FLUX.1 Kontext Image Edit'] =
    structuredClone(fluxKontextGroupNode)

  // Lazy import to avoid circular dependency issues
  const { GroupNodeConfig } = await import('@/extensions/core/groupNode')
  await GroupNodeConfig.registerFromWorkflow(
    {
      'FLUX.1 Kontext Image Edit':
        graph.extra.groupNodes['FLUX.1 Kontext Image Edit']
    },
    []
  )
}

export async function addFluxKontextGroupNode(fromNode: LGraphNode) {
  const { canvas } = app
  const { graph } = canvas
  if (!graph) throw new TypeError('Graph is not initialized')
  await ensureGraphHasFluxKontextGroupNode(graph)

  const node = LiteGraph.createNode('workflow>FLUX.1 Kontext Image Edit')
  if (!node) throw new TypeError('Failed to create node')

  const pos = getPosToRightOfNode(fromNode)

  graph.add(node)
  node.pos = pos
  app.canvas.processSelect(node, undefined)

  connectPreviousLatent(fromNode, node)

  const symb = Object.getOwnPropertySymbols(node)[0]
  // @ts-expect-error It's there -- promise.
  node[symb].populateWidgets()

  setWidgetValues(node)
}

function setWidgetValues(node: LGraphNode) {
  const seedInput = node.widgets?.find((x) => x.name === 'seed')
  if (!seedInput) throw new TypeError('Seed input not found')
  seedInput.value = Math.floor(Math.random() * 1_125_899_906_842_624)

  const firstClip = node.widgets?.find((x) => x.name === 'clip_name1')
  setPreferredValue('t5xxl_fp8_e4m3fn_scaled.safetensors', 't5xxl', firstClip)

  const secondClip = node.widgets?.find((x) => x.name === 'clip_name2')
  setPreferredValue('clip_l.safetensors', 'clip_l', secondClip)

  const unet = node.widgets?.find((x) => x.name === 'unet_name')
  setPreferredValue('flux1-dev-kontext_fp8_scaled.safetensors', 'kontext', unet)

  const vae = node.widgets?.find((x) => x.name === 'vae_name')
  setPreferredValue('ae.safetensors', 'ae.s', vae)
}

function setPreferredValue(
  preferred: string,
  match: string,
  widget: IBaseWidget | undefined
): void {
  if (!widget) throw new TypeError('Widget not found')

  const { values } = widget.options
  if (!Array.isArray(values)) return

  // Match against filename portion only
  const mapped = values.map((x) => parseFilePath(x).filename)
  const value =
    mapped.find((x) => x === preferred) ??
    mapped.find((x) => x.includes?.(match))
  widget.value = value ?? preferred
}

function getPosToRightOfNode(fromNode: LGraphNode) {
  const nodes = app.canvas.graph?.nodes
  if (!nodes) throw new TypeError('Could not get graph nodes')

  const pos = [
    fromNode.pos[0] + fromNode.size[0] + 100,
    fromNode.pos[1]
  ] satisfies Point

  while (nodes.find((x) => isPointTooClose(x.pos, pos))) {
    pos[0] += 20
    pos[1] += 20
  }

  return pos
}

function connectPreviousLatent(fromNode: LGraphNode, toEditNode: LGraphNode) {
  const { canvas } = app
  const { graph } = canvas
  if (!graph) throw new TypeError('Graph is not initialized')

  const l = findNearestOutputOfType([fromNode], 'LATENT')
  if (!l) {
    const imageOutput = findNearestOutputOfType([fromNode], 'IMAGE')
    if (!imageOutput) throw new TypeError('No image output found')

    const vaeEncode = LiteGraph.createNode('VAEEncode')
    if (!vaeEncode) throw new TypeError('Failed to create node')

    const { node: imageNode, index: imageIndex } = imageOutput
    graph.add(vaeEncode)
    vaeEncode.pos = getPosToRightOfNode(fromNode)
    vaeEncode.pos[1] -= 200

    vaeEncode.connect(0, toEditNode, 0)
    imageNode.connect(imageIndex, vaeEncode, 0)
    return
  }

  const { node, index } = l

  node.connect(index, toEditNode, 0)
}

function getInputNodes(node: LGraphNode): LGraphNode[] {
  return node.inputs
    .map((x) => LLink.resolve(x.link, app.graph)?.outputNode)
    .filter((x) => !!x)
}

function getOutputOfType(
  node: LGraphNode,
  type: string
): {
  output: INodeOutputSlot
  index: number
} {
  const index = node.outputs.findIndex((x) => x.type === type)
  const output = node.outputs[index]
  return { output, index }
}

function findNearestOutputOfType(
  nodes: Iterable<LGraphNode>,
  type: string = 'LATENT',
  depth: number = 0
): { node: LGraphNode; index: number } | undefined {
  for (const node of nodes) {
    const { output, index } = getOutputOfType(node, type)
    if (output) return { node, index }
  }

  if (depth < 3) {
    const closestNodes = new Set([...nodes].flatMap((x) => getInputNodes(x)))
    const res = findNearestOutputOfType(closestNodes, type, depth + 1)
    if (res) return res
  }
}

function isPointTooClose(a: Point, b: Point, precision: number = 5) {
  return Math.abs(a[0] - b[0]) < precision && Math.abs(a[1] - b[1]) < precision
}
