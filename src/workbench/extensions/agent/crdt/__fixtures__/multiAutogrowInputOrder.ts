import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

// Reduced from MiniMaxH3ReferenceToVideo: two independent autogrow groups
// (ref_images, ref_videos) growing on the same node, each interleaved with
// scalar widgets (width/height/length/ref_image_size) that PM-993/PM-994's
// single-group fixture never has to share a node with a second group.
export const nodeDef: ComfyNodeDef = {
  name: 'MultiAutogrowInputOrder',
  display_name: 'Multi Autogrow Input Order',
  category: 'testing',
  description: '',
  python_module: 'testing',
  output_node: false,
  input: {
    required: {
      prompt: ['STRING', { multiline: true }],
      width: ['INT', { default: 640 }],
      height: ['INT', { default: 480 }],
      length: ['INT', { default: 24 }],
      ref_image_size: ['COMBO', { options: ['match', 'max'] }]
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
  output: [],
  output_name: []
}

// Both autogrow groups are already grown by two slots each, and every grown
// slot but the last of each group is linked. This is the shape a saved
// MiniMax-style template actually reaches disk in: two live groups whose
// growth interleaved as they were wired up, sitting between the same
// scalar widgets used to reproduce PM-994.
export const savedNode = {
  id: 2,
  type: nodeDef.name,
  pos: [300, 0],
  size: [200, 200],
  flags: {},
  order: 1,
  mode: 0,
  inputs: [
    { name: 'ref_images.ref_image_0', type: 'IMAGE', link: 278 },
    { name: 'ref_images.ref_image_1', type: 'IMAGE', link: 282 },
    { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
    { name: 'ref_videos.ref_video_0', type: 'VIDEO', link: 283 },
    { name: 'ref_videos.ref_video_1', type: 'VIDEO', link: 284 },
    { name: 'ref_videos.ref_video_2', type: 'VIDEO', link: null },
    { name: 'prompt', type: 'STRING', widget: { name: 'prompt' }, link: 279 },
    { name: 'width', type: 'INT', widget: { name: 'width' }, link: 276 },
    { name: 'height', type: 'INT', widget: { name: 'height' }, link: 277 },
    { name: 'length', type: 'INT', widget: { name: 'length' }, link: 275 },
    {
      name: 'ref_image_size',
      type: 'COMBO',
      widget: { name: 'ref_image_size' },
      link: 285
    }
  ],
  outputs: [],
  widgets_values: ['', 640, 480, 24, 'match']
} satisfies ISerialisedNode

// A single-image, single-video seed: the minimum shape that still exercises
// growth in both groups on reload, so an agent reconnect after that growth
// can be tested the way inputOrder.ts tests it for one group.
export const singleReferenceNode = {
  ...savedNode,
  inputs: savedNode.inputs
    .filter(
      ({ name }) =>
        ![
          'ref_images.ref_image_1',
          'ref_images.ref_image_2',
          'ref_videos.ref_video_1',
          'ref_videos.ref_video_2'
        ].includes(name)
    )
    .map((input) =>
      input.name === 'ref_images.ref_image_0' ||
      input.name === 'ref_videos.ref_video_0'
        ? { ...input, link: null }
        : input
    )
} satisfies ISerialisedNode
