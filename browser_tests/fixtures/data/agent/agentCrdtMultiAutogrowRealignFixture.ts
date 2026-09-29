import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

/** Fixture data for `agentCrdtMultiAutogrowRealign.spec.ts`. */

export const NODE_TYPE = 'TestMultiAutogrowRealign'
export const SOURCE_NODE_TYPE = 'TestMultiAutogrowRealignSource'

export const SOURCE_NODE_ID = 1
export const TARGET_NODE_ID = 2
export const TARGET_ID = String(TARGET_NODE_ID)

export const WORKFLOW_ID = '4c1e9f2a-6b3d-4a7e-8f01-2c3d4e5f6a7b'
export const THREAD_ID = 'a2b3c4d5-6e7f-4a8b-9c0d-1e2f3a4b5c6d'
export const MESSAGE_ID = 'f1e2d3c4-b5a6-4978-8c6d-5e4f3a2b1c0d'
export const SOCKET_SID = '3f1c9d7a-2b4e-4a6f-8c9d-0e1f2a3b4c5d'

// Link ids, one per wire in the saved graph below -- internal to this
// module; consumers read them back off `EXPECTED_TARGETS`.
const IMG0_LINK = 201
const IMG1_LINK = 202
const VID0_LINK = 203
const VID1_LINK = 204

export const nodeDef: ComfyNodeDef = {
  name: NODE_TYPE,
  display_name: 'Test Multi Autogrow Realign',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: [],
  output_is_list: [],
  output_name: [],
  input: {
    required: {
      prompt: ['STRING', { multiline: true }],
      width: ['INT', { default: 640 }],
      height: ['INT', { default: 480 }]
    },
    optional: {
      ref_images: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { ref_image: ['IMAGE', {}] } },
            prefix: 'ref_image_',
            min: 0,
            max: 4
          }
        }
      ],
      ref_videos: [
        'COMFY_AUTOGROW_V3',
        {
          template: {
            input: { required: { ref_video: ['VIDEO', {}] } },
            prefix: 'ref_video_',
            min: 0,
            max: 4
          }
        }
      ]
    }
  },
  input_order: {
    required: ['prompt', 'width', 'height'],
    optional: ['ref_images', 'ref_videos']
  }
}

export const sourceNodeDef: ComfyNodeDef = {
  name: SOURCE_NODE_TYPE,
  display_name: 'Test Multi Autogrow Realign Source',
  description: '',
  category: 'test',
  python_module: 'test',
  output_node: false,
  output: ['IMAGE', 'IMAGE', 'VIDEO', 'VIDEO'],
  output_is_list: [false, false, false, false],
  output_name: ['ref_image_0', 'ref_image_1', 'ref_video_0', 'ref_video_1'],
  input: { required: {} },
  input_order: { required: [] }
}

export const catalog: WidgetCatalog = {
  types: {
    [SOURCE_NODE_TYPE]: { widget_order: [] },
    [NODE_TYPE]: { widget_order: ['prompt', 'width', 'height'] }
  }
}

export const seed: WorkflowJSON = {
  nodes: [
    {
      id: SOURCE_NODE_ID,
      type: SOURCE_NODE_TYPE,
      pos: [0, 0],
      size: [220, 200],
      flags: {},
      order: 0,
      mode: 0,
      inputs: [],
      outputs: [
        { name: 'ref_image_0', type: 'IMAGE', links: [IMG0_LINK] },
        { name: 'ref_image_1', type: 'IMAGE', links: [IMG1_LINK] },
        { name: 'ref_video_0', type: 'VIDEO', links: [VID0_LINK] },
        { name: 'ref_video_1', type: 'VIDEO', links: [VID1_LINK] }
      ],
      properties: {},
      widgets_values: []
    },
    {
      id: TARGET_NODE_ID,
      type: NODE_TYPE,
      pos: [400, 0],
      size: [320, 320],
      flags: {},
      order: 1,
      mode: 0,
      inputs: [
        { name: 'ref_images.ref_image_0', type: 'IMAGE', link: IMG0_LINK },
        { name: 'ref_images.ref_image_1', type: 'IMAGE', link: IMG1_LINK },
        { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
        { name: 'ref_videos.ref_video_0', type: 'VIDEO', link: VID0_LINK },
        { name: 'ref_videos.ref_video_1', type: 'VIDEO', link: VID1_LINK },
        { name: 'ref_videos.ref_video_2', type: 'VIDEO', link: null },
        { name: 'prompt', type: 'STRING', widget: { name: 'prompt' } },
        { name: 'width', type: 'INT', widget: { name: 'width' } },
        { name: 'height', type: 'INT', widget: { name: 'height' } }
      ],
      outputs: [],
      properties: {},
      widgets_values: ['', 640, 480]
    }
  ],
  links: [
    [IMG0_LINK, SOURCE_NODE_ID, 0, TARGET_NODE_ID, 0, 'IMAGE'],
    [IMG1_LINK, SOURCE_NODE_ID, 1, TARGET_NODE_ID, 1, 'IMAGE'],
    [VID0_LINK, SOURCE_NODE_ID, 2, TARGET_NODE_ID, 3, 'VIDEO'],
    [VID1_LINK, SOURCE_NODE_ID, 3, TARGET_NODE_ID, 4, 'VIDEO']
  ],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

// Every saved link, and the input name it must still terminate on -- the
// two interleaved autogrow groups' grown-and-linked slots.
export const EXPECTED_TARGETS: readonly { linkId: number; name: string }[] = [
  { linkId: IMG0_LINK, name: 'ref_images.ref_image_0' },
  { linkId: IMG1_LINK, name: 'ref_images.ref_image_1' },
  { linkId: VID0_LINK, name: 'ref_videos.ref_video_0' },
  { linkId: VID1_LINK, name: 'ref_videos.ref_video_1' }
]

// Named rather than indexed: interleaved autogrow growth during
// `node.configure()` does not preserve `seed`'s input order in the live
// node, so a slot's final live index cannot be assumed from its position
// above -- only its name is stable.
export const SPARE_SLOTS: readonly { name: string }[] = [
  { name: 'ref_images.ref_image_2' },
  { name: 'ref_videos.ref_video_2' }
]

export const CONNECTED_SOCKET_SLOTS: readonly { name: string }[] = [
  { name: 'ref_images.ref_image_0' },
  { name: 'ref_images.ref_image_1' },
  { name: 'ref_videos.ref_video_0' },
  { name: 'ref_videos.ref_video_1' }
]
