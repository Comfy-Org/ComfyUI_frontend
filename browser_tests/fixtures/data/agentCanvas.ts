import type {
  AgentRunMode,
  AgentThreadListResponse,
  ListAssetsResponse,
  WorkflowListResponse
} from '@comfyorg/ingest-types'

import type { ObjectInfoResponse } from '@/schemas/nodeDefSchema'

export const AGENT_CANVAS_NODE_DEFINITIONS: ObjectInfoResponse = {
  LoadImage: {
    name: 'LoadImage',
    display_name: 'Load Image',
    description: 'Loads an image from the input folder.',
    category: 'image',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: { image: [['reference.png'], { image_upload: true }] }
    },
    output: ['IMAGE', 'MASK'],
    output_name: ['IMAGE', 'MASK']
  },
  ImageScale: {
    name: 'ImageScale',
    display_name: 'Upscale Image',
    description: 'Resizes an image to the specified dimensions.',
    category: 'image/upscaling',
    python_module: 'nodes',
    output_node: false,
    input: {
      required: {
        image: ['IMAGE', {}],
        upscale_method: [
          ['nearest-exact', 'bilinear', 'area', 'bicubic', 'lanczos'],
          {}
        ],
        width: ['INT', { default: 512, min: 0, max: 16384, step: 1 }],
        height: ['INT', { default: 512, min: 0, max: 16384, step: 1 }],
        crop: [['disabled', 'center'], {}]
      }
    },
    output: ['IMAGE'],
    output_name: ['IMAGE']
  },
  PreviewImage: {
    name: 'PreviewImage',
    display_name: 'Preview Image',
    description: 'Displays the input images.',
    category: 'image',
    python_module: 'nodes',
    output_node: true,
    input: {
      required: { images: ['IMAGE', {}] },
      hidden: { prompt: 'PROMPT', extra_pnginfo: 'EXTRA_PNGINFO' }
    },
    output: []
  }
}

export const EMPTY_AGENT_ASSETS: ListAssetsResponse = {
  assets: [],
  total: 0,
  has_more: false
}

export const EMPTY_AGENT_WORKFLOWS: WorkflowListResponse = {
  data: [],
  pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
}

export const EMPTY_AGENT_THREADS: AgentThreadListResponse = {
  threads: [],
  pagination: { has_more: false, limit: 100, offset: 0, total: 0 }
}

export const AGENT_ASK_RUN_MODE: AgentRunMode = {
  mode: 'ask_approval',
  credit_limit: null
}
