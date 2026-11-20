import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

type SlotSpec = readonly [name: string, type: string]

interface GraphNode {
  id: number
  type: string
  pos: [number, number]
  size: [number, number]
  flags: Record<string, never>
  order: number
  mode: number
  inputs: { name: string; type: string; link: number | null }[]
  outputs: { name: string; type: string; links: number[]; slot_index: number }[]
  properties: Record<string, never>
  widgets_values: (string | number)[]
}

type GraphLink = [number, number, number, number, number, string]

const BLOCK_SIZE = 10
const BLOCK_WIDTH = 1600
const BLOCK_HEIGHT = 1000
const PROMPT =
  'a cinematic photograph of a lighthouse on a rocky coast at dusk, volumetric light, film grain, 35mm'
const NEGATIVE_PROMPT = 'blurry, low quality, watermark'

class GraphBuilder {
  readonly nodes: GraphNode[] = []
  readonly links: GraphLink[] = []

  add(
    type: string,
    pos: [number, number],
    size: [number, number],
    inputs: readonly SlotSpec[],
    outputs: readonly SlotSpec[],
    widgetsValues: (string | number)[]
  ): number {
    const id = this.nodes.length + 1
    this.nodes.push({
      id,
      type,
      pos,
      size,
      flags: {},
      order: id,
      mode: 0,
      inputs: inputs.map(([name, slotType]) => ({
        name,
        type: slotType,
        link: null
      })),
      outputs: outputs.map(([name, slotType], slotIndex) => ({
        name,
        type: slotType,
        links: [],
        slot_index: slotIndex
      })),
      properties: {},
      widgets_values: widgetsValues
    })
    return id
  }

  link(fromId: number, fromSlot: number, toId: number, toSlot: number) {
    const id = this.links.length + 1
    const output = this.nodes[fromId - 1].outputs[fromSlot]
    output.links.push(id)
    this.nodes[toId - 1].inputs[toSlot].link = id
    this.links.push([id, fromId, fromSlot, toId, toSlot, output.type])
  }
}

function addPipelineBlock(
  graph: GraphBuilder,
  x: number,
  y: number,
  seed: number,
  imageName: string
) {
  const checkpoint = graph.add(
    'CheckpointLoaderSimple',
    [x, y],
    [315, 98],
    [],
    [
      ['MODEL', 'MODEL'],
      ['CLIP', 'CLIP'],
      ['VAE', 'VAE']
    ],
    ['nodes2-acceptance-perf.safetensors']
  )
  const positive = graph.add(
    'CLIPTextEncode',
    [x + 360, y],
    [400, 200],
    [['clip', 'CLIP']],
    [['CONDITIONING', 'CONDITIONING']],
    [PROMPT]
  )
  const negative = graph.add(
    'CLIPTextEncode',
    [x + 360, y + 250],
    [400, 200],
    [['clip', 'CLIP']],
    [['CONDITIONING', 'CONDITIONING']],
    [NEGATIVE_PROMPT]
  )
  const latent = graph.add(
    'EmptyLatentImage',
    [x, y + 170],
    [315, 106],
    [],
    [['LATENT', 'LATENT']],
    [1024, 1024, 1]
  )
  const sampler = graph.add(
    'KSampler',
    [x + 800, y],
    [315, 262],
    [
      ['model', 'MODEL'],
      ['positive', 'CONDITIONING'],
      ['negative', 'CONDITIONING'],
      ['latent_image', 'LATENT']
    ],
    [['LATENT', 'LATENT']],
    [seed, 'fixed', 20, 7, 'euler', 'normal', 1]
  )
  const decode = graph.add(
    'VAEDecode',
    [x + 1150, y],
    [210, 46],
    [
      ['samples', 'LATENT'],
      ['vae', 'VAE']
    ],
    [['IMAGE', 'IMAGE']],
    []
  )
  const preview = graph.add(
    'PreviewImage',
    [x + 1150, y + 100],
    [300, 250],
    [['images', 'IMAGE']],
    [],
    []
  )
  const loadImage = graph.add(
    'LoadImage',
    [x, y + 500],
    [315, 314],
    [],
    [
      ['IMAGE', 'IMAGE'],
      ['MASK', 'MASK']
    ],
    [imageName, 'image']
  )
  const scale = graph.add(
    'ImageScale',
    [x + 360, y + 500],
    [315, 130],
    [['image', 'IMAGE']],
    [['IMAGE', 'IMAGE']],
    ['nearest-exact', 512, 512, 'disabled']
  )
  const save = graph.add(
    'SaveImage',
    [x + 720, y + 500],
    [315, 270],
    [['images', 'IMAGE']],
    [],
    ['ComfyUI']
  )
  graph.link(checkpoint, 0, sampler, 0)
  graph.link(checkpoint, 1, positive, 0)
  graph.link(checkpoint, 1, negative, 0)
  graph.link(positive, 0, sampler, 1)
  graph.link(negative, 0, sampler, 2)
  graph.link(latent, 0, sampler, 3)
  graph.link(sampler, 0, decode, 0)
  graph.link(checkpoint, 2, decode, 1)
  graph.link(decode, 0, preview, 0)
  graph.link(loadImage, 0, scale, 0)
  graph.link(scale, 0, save, 0)
}

/**
 * Deterministic graph of repeated 10-node SD pipeline blocks (two multiline
 * prompts and one image preview per block), laid out on a grid.
 */
export function realisticPipelineGraph(
  nodeCount: number,
  imageName: string
): ComfyWorkflowJSON {
  const graph = new GraphBuilder()
  const blocks = Math.ceil(nodeCount / BLOCK_SIZE)
  const columns = Math.ceil(Math.sqrt(blocks * 1.5))
  for (let block = 0; block < blocks; block++) {
    addPipelineBlock(
      graph,
      (block % columns) * BLOCK_WIDTH,
      Math.floor(block / columns) * BLOCK_HEIGHT,
      1000 + block,
      imageName
    )
  }
  return zComfyWorkflow.parse({
    last_node_id: graph.nodes.length,
    last_link_id: graph.links.length,
    nodes: graph.nodes,
    links: graph.links,
    groups: [],
    config: {},
    extra: { ds: { scale: 0.75, offset: [50, 50] } },
    version: 0.4
  })
}
