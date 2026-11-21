import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { zComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

const NODES_PER_CHAIN = 5
const COLUMNS = 10
const COLUMN_SPACING = 1200
const ROW_SPACING = 650

export function createChainWorkflow(nodeCount: number): ComfyWorkflowJSON {
  if (nodeCount % NODES_PER_CHAIN !== 0) {
    throw new Error(`nodeCount must be a multiple of ${NODES_PER_CHAIN}`)
  }
  const nodes: unknown[] = []
  const links: unknown[] = []
  let lastNodeId = 0
  let lastLinkId = 0
  for (let chain = 0; chain < nodeCount / NODES_PER_CHAIN; chain++) {
    const x = (chain % COLUMNS) * COLUMN_SPACING
    const y = Math.floor(chain / COLUMNS) * ROW_SPACING
    const checkpoint = ++lastNodeId
    const positive = ++lastNodeId
    const negative = ++lastNodeId
    const sampler = ++lastNodeId
    const latent = ++lastNodeId
    const clipToPositive = ++lastLinkId
    const clipToNegative = ++lastLinkId
    const model = ++lastLinkId
    const positiveConditioning = ++lastLinkId
    const negativeConditioning = ++lastLinkId
    const latentImage = ++lastLinkId
    const base = { flags: {}, mode: 0 }
    nodes.push(
      {
        ...base,
        id: checkpoint,
        type: 'CheckpointLoaderSimple',
        pos: [x, y],
        size: [315, 98],
        order: nodes.length,
        outputs: [
          { name: 'MODEL', type: 'MODEL', links: [model], slot_index: 0 },
          {
            name: 'CLIP',
            type: 'CLIP',
            links: [clipToPositive, clipToNegative],
            slot_index: 1
          },
          { name: 'VAE', type: 'VAE', links: [], slot_index: 2 }
        ],
        properties: { 'Node name for S&R': 'CheckpointLoaderSimple' },
        widgets_values: ['v1-5-pruned-emaonly.safetensors']
      },
      {
        ...base,
        id: positive,
        type: 'CLIPTextEncode',
        pos: [x + 400, y - 100],
        size: [210, 87],
        order: nodes.length + 1,
        inputs: [{ name: 'clip', type: 'CLIP', link: clipToPositive }],
        outputs: [
          {
            name: 'CONDITIONING',
            type: 'CONDITIONING',
            links: [positiveConditioning],
            slot_index: 0
          }
        ],
        properties: { 'Node name for S&R': 'CLIPTextEncode' },
        widgets_values: ['beautiful landscape']
      },
      {
        ...base,
        id: negative,
        type: 'CLIPTextEncode',
        pos: [x + 400, y + 100],
        size: [210, 87],
        order: nodes.length + 2,
        inputs: [{ name: 'clip', type: 'CLIP', link: clipToNegative }],
        outputs: [
          {
            name: 'CONDITIONING',
            type: 'CONDITIONING',
            links: [negativeConditioning],
            slot_index: 0
          }
        ],
        properties: { 'Node name for S&R': 'CLIPTextEncode' },
        widgets_values: ['ugly, blurry']
      },
      {
        ...base,
        id: sampler,
        type: 'KSampler',
        pos: [x + 700, y],
        size: [315, 262],
        order: nodes.length + 3,
        inputs: [
          { name: 'model', type: 'MODEL', link: model },
          {
            name: 'positive',
            type: 'CONDITIONING',
            link: positiveConditioning
          },
          {
            name: 'negative',
            type: 'CONDITIONING',
            link: negativeConditioning
          },
          { name: 'latent_image', type: 'LATENT', link: latentImage }
        ],
        outputs: [{ name: 'LATENT', type: 'LATENT', links: [], slot_index: 0 }],
        properties: { 'Node name for S&R': 'KSampler' },
        widgets_values: [0, 'randomize', 20, 8, 'euler', 'normal', 1]
      },
      {
        ...base,
        id: latent,
        type: 'EmptyLatentImage',
        pos: [x + 400, y + 300],
        size: [315, 106],
        order: nodes.length + 4,
        outputs: [
          {
            name: 'LATENT',
            type: 'LATENT',
            links: [latentImage],
            slot_index: 0
          }
        ],
        properties: { 'Node name for S&R': 'EmptyLatentImage' },
        widgets_values: [512, 512, 1]
      }
    )
    links.push(
      [clipToPositive, checkpoint, 1, positive, 0, 'CLIP'],
      [clipToNegative, checkpoint, 1, negative, 0, 'CLIP'],
      [model, checkpoint, 0, sampler, 0, 'MODEL'],
      [positiveConditioning, positive, 0, sampler, 1, 'CONDITIONING'],
      [negativeConditioning, negative, 0, sampler, 2, 'CONDITIONING'],
      [latentImage, latent, 0, sampler, 3, 'LATENT']
    )
  }
  return zComfyWorkflow.parse({
    last_node_id: lastNodeId,
    last_link_id: lastLinkId,
    nodes,
    links,
    groups: [],
    config: {},
    extra: { ds: { scale: 0.5, offset: [0, 0] } },
    version: 0.4
  })
}
