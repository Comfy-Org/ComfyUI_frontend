import type { WidgetCatalog } from '@comfyorg/comfy-multi-player'

import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { zComfyWorkflow } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const VHS_WORKFLOW_ID = 'b7c1d2e3-0000-4000-8000-000000002018'
export const VHS_MESSAGE_ID = 'b7c1d2e3-0000-4000-8000-000000002019'
export const VHS_THREAD_ID = 'b7c1d2e3-0000-4000-8000-000000002020'

export const VHS_LOAD_ID = 1
const INVERT_ID = 2
export const VHS_COMBINE_ID = 3
const SAVED_FRAME_LOAD_CAP = 8
const SAVED_FILENAME_PREFIX = 'pm2018_baseline'
const EDITED_FRAME_LOAD_CAP = 16

function loadVideoRecord(video: string, frameLoadCap: number) {
  return {
    video,
    force_rate: 0,
    frame_load_cap: frameLoadCap,
    videopreview: {
      hidden: false,
      paused: false,
      params: { filename: video, type: 'input', format: 'video/mp4' }
    }
  }
}

export const vhsNodeDefs: Record<string, ComfyNodeDef> = {
  VHS_LoadVideo: {
    name: 'VHS_LoadVideo',
    display_name: 'Load Video (Upload)',
    description: '',
    category: 'Video Helper Suite',
    python_module: 'custom_nodes.ComfyUI-VideoHelperSuite',
    output_node: false,
    input: {
      required: {
        video: [['clip.mp4', 'retake.mp4']],
        force_rate: ['FLOAT', { default: 0, min: 0, max: 60, step: 1 }],
        frame_load_cap: ['INT', { default: 0, min: 0, max: 100000, step: 1 }]
      }
    },
    output: ['IMAGE', 'INT'],
    output_is_list: [false, false],
    output_name: ['IMAGE', 'frame_count']
  },
  ImageInvert: {
    name: 'ImageInvert',
    display_name: 'Invert Image Colors',
    description: '',
    category: 'image',
    python_module: 'nodes',
    output_node: false,
    input: { required: { image: ['IMAGE'] } },
    output: ['IMAGE'],
    output_is_list: [false],
    output_name: ['IMAGE']
  },
  VHS_VideoCombine: {
    name: 'VHS_VideoCombine',
    display_name: 'Video Combine',
    description: '',
    category: 'Video Helper Suite',
    python_module: 'custom_nodes.ComfyUI-VideoHelperSuite',
    output_node: true,
    input: {
      required: {
        images: ['IMAGE'],
        frame_rate: ['FLOAT', { default: 8, min: 1, step: 1 }],
        filename_prefix: ['STRING', { default: 'AnimateDiff' }],
        format: [['image/gif', 'video/h264-mp4']]
      }
    },
    output: ['VHS_FILENAMES'],
    output_is_list: [false],
    output_name: ['Filenames']
  }
}

export function savedVhsWorkflow(): ComfyWorkflowJSON {
  return zComfyWorkflow.parse({
    last_node_id: VHS_COMBINE_ID,
    last_link_id: 2,
    nodes: [
      {
        id: VHS_LOAD_ID,
        type: 'VHS_LoadVideo',
        pos: [40, 120],
        size: [260, 200],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [
          {
            name: 'video',
            type: 'COMBO',
            widget: { name: 'video' },
            link: null
          },
          {
            name: 'force_rate',
            type: 'FLOAT',
            widget: { name: 'force_rate' },
            link: null
          },
          {
            name: 'frame_load_cap',
            type: 'INT',
            widget: { name: 'frame_load_cap' },
            link: null
          }
        ],
        outputs: [
          { name: 'IMAGE', type: 'IMAGE', links: [1] },
          { name: 'frame_count', type: 'INT', links: null }
        ],
        properties: { 'Node name for S&R': 'VHS_LoadVideo' },
        widgets_values: loadVideoRecord('clip.mp4', SAVED_FRAME_LOAD_CAP)
      },
      {
        id: INVERT_ID,
        type: 'ImageInvert',
        pos: [360, 120],
        size: [200, 60],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [{ name: 'image', type: 'IMAGE', link: 1 }],
        outputs: [{ name: 'IMAGE', type: 'IMAGE', links: [2] }],
        properties: { 'Node name for S&R': 'ImageInvert' }
      },
      {
        id: VHS_COMBINE_ID,
        type: 'VHS_VideoCombine',
        pos: [620, 120],
        size: [260, 220],
        flags: {},
        order: 2,
        mode: 0,
        inputs: [
          { name: 'images', type: 'IMAGE', link: 2 },
          {
            name: 'frame_rate',
            type: 'FLOAT',
            widget: { name: 'frame_rate' },
            link: null
          },
          {
            name: 'filename_prefix',
            type: 'STRING',
            widget: { name: 'filename_prefix' },
            link: null
          },
          {
            name: 'format',
            type: 'COMBO',
            widget: { name: 'format' },
            link: null
          },
          {
            name: 'pix_fmt',
            type: ['yuv420p', 'yuv420p10le'],
            widget: { name: 'pix_fmt' },
            link: null
          }
        ],
        outputs: [{ name: 'Filenames', type: 'VHS_FILENAMES', links: null }],
        properties: { 'Node name for S&R': 'VHS_VideoCombine' },
        widgets_values: {
          frame_rate: 8,
          filename_prefix: SAVED_FILENAME_PREFIX,
          format: 'video/h264-mp4',
          pix_fmt: 'yuv420p'
        }
      }
    ],
    links: [
      [1, VHS_LOAD_ID, 0, INVERT_ID, 0, 'IMAGE'],
      [2, INVERT_ID, 0, VHS_COMBINE_ID, 0, 'IMAGE']
    ],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  })
}

export const vhsCatalog: WidgetCatalog = {
  types: { ImageInvert: { widget_order: [] } }
}

export const restoredVhsCanvas = {
  types: ['ImageInvert', 'VHS_LoadVideo', 'VHS_VideoCombine'],
  frameLoadCap: SAVED_FRAME_LOAD_CAP,
  filenamePrefix: SAVED_FILENAME_PREFIX,
  previewFilename: 'clip.mp4'
}

export const editedVhsLoadRecord = loadVideoRecord(
  'retake.mp4',
  EDITED_FRAME_LOAD_CAP
)

export const editedVhsCanvas = {
  ...restoredVhsCanvas,
  frameLoadCap: EDITED_FRAME_LOAD_CAP,
  previewFilename: 'retake.mp4'
}
