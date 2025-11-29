import type { Node, Edge } from '@vue-flow/core'
import type { FlowNodeData, NodeState } from '@/types/node'
import {
  LOAD_CHECKPOINT,
  CLIP_TEXT_ENCODE,
  KSAMPLER,
  EMPTY_LATENT_IMAGE,
  VAE_DECODE,
  SAVE_IMAGE,
} from '@/data/nodeDefinitions'

// Helper to create FlowNodeData
export function createNodeData(
  definition: typeof LOAD_CHECKPOINT,
  overrides: Partial<FlowNodeData> = {}
): FlowNodeData {
  return {
    definition,
    widgetValues: Object.fromEntries(
      definition.widgets.map((w) => [w.name, w.value])
    ),
    state: 'idle' as NodeState,
    flags: {},
    ...overrides,
  }
}

// Sample workflow nodes
export const DEMO_WORKFLOW_NODES: Node<FlowNodeData>[] = [
  {
    id: 'load-checkpoint',
    type: 'flowNode',
    position: { x: 50, y: 150 },
    data: createNodeData(LOAD_CHECKPOINT),
  },
  {
    id: 'empty-latent',
    type: 'flowNode',
    position: { x: 50, y: 400 },
    data: createNodeData(EMPTY_LATENT_IMAGE),
  },
  {
    id: 'clip-text-pos',
    type: 'flowNode',
    position: { x: 350, y: 50 },
    data: createNodeData(CLIP_TEXT_ENCODE, {
      title: 'Positive Prompt',
      widgetValues: { text: 'beautiful mountain landscape, sunset, dramatic lighting, 8k, detailed' },
    }),
  },
  {
    id: 'clip-text-neg',
    type: 'flowNode',
    position: { x: 350, y: 280 },
    data: createNodeData(CLIP_TEXT_ENCODE, {
      title: 'Negative Prompt',
      widgetValues: { text: 'blurry, low quality, watermark, text' },
    }),
  },
  {
    id: 'ksampler',
    type: 'flowNode',
    position: { x: 700, y: 150 },
    data: createNodeData(KSAMPLER, {
      state: 'executing',
      progress: 0.65,
    }),
  },
  {
    id: 'vae-decode',
    type: 'flowNode',
    position: { x: 1050, y: 200 },
    data: createNodeData(VAE_DECODE),
  },
  {
    id: 'save-image',
    type: 'flowNode',
    position: { x: 1300, y: 200 },
    data: createNodeData(SAVE_IMAGE),
  },
]

// Edges with proper slot connections
export const DEMO_WORKFLOW_EDGES: Edge[] = [
  // LoadCheckpoint -> CLIP Text Encode (Positive)
  {
    id: 'e1',
    source: 'load-checkpoint',
    sourceHandle: 'output-1', // CLIP output
    target: 'clip-text-pos',
    targetHandle: 'input-0', // clip input
    style: { stroke: '#ffcc80', strokeWidth: 2 },
  },
  // LoadCheckpoint -> CLIP Text Encode (Negative)
  {
    id: 'e2',
    source: 'load-checkpoint',
    sourceHandle: 'output-1', // CLIP output
    target: 'clip-text-neg',
    targetHandle: 'input-0', // clip input
    style: { stroke: '#ffcc80', strokeWidth: 2 },
  },
  // LoadCheckpoint -> KSampler (model)
  {
    id: 'e3',
    source: 'load-checkpoint',
    sourceHandle: 'output-0', // MODEL output
    target: 'ksampler',
    targetHandle: 'input-0', // model input
    style: { stroke: '#b39ddb', strokeWidth: 2 },
  },
  // CLIP Positive -> KSampler (positive)
  {
    id: 'e4',
    source: 'clip-text-pos',
    sourceHandle: 'output-0', // CONDITIONING output
    target: 'ksampler',
    targetHandle: 'input-1', // positive input
    style: { stroke: '#ffab40', strokeWidth: 2 },
  },
  // CLIP Negative -> KSampler (negative)
  {
    id: 'e5',
    source: 'clip-text-neg',
    sourceHandle: 'output-0', // CONDITIONING output
    target: 'ksampler',
    targetHandle: 'input-2', // negative input
    style: { stroke: '#ffab40', strokeWidth: 2 },
  },
  // Empty Latent -> KSampler (latent_image)
  {
    id: 'e6',
    source: 'empty-latent',
    sourceHandle: 'output-0', // LATENT output
    target: 'ksampler',
    targetHandle: 'input-3', // latent_image input
    style: { stroke: '#ff80ab', strokeWidth: 2 },
  },
  // KSampler -> VAE Decode (samples)
  {
    id: 'e7',
    source: 'ksampler',
    sourceHandle: 'output-0', // LATENT output
    target: 'vae-decode',
    targetHandle: 'input-0', // samples input
    style: { stroke: '#ff80ab', strokeWidth: 2 },
  },
  // LoadCheckpoint -> VAE Decode (vae)
  {
    id: 'e8',
    source: 'load-checkpoint',
    sourceHandle: 'output-2', // VAE output
    target: 'vae-decode',
    targetHandle: 'input-1', // vae input
    style: { stroke: '#ef5350', strokeWidth: 2 },
  },
  // VAE Decode -> Save Image
  {
    id: 'e9',
    source: 'vae-decode',
    sourceHandle: 'output-0', // IMAGE output
    target: 'save-image',
    targetHandle: 'input-0', // images input
    style: { stroke: '#64b5f6', strokeWidth: 2 },
  },
]
