import type { WidgetCatalog, WorkflowJSON } from '@comfyorg/comfy-multi-player'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

export const workflowId = 'ac09c341-fc48-4860-9dc4-294950cb8705'
export const threadId = 'c7f41995-964b-4ba9-9bfb-fdc972ad12bc'
export const messageId = 'c9a86103-c034-44c9-b956-f74e1a348678'

const target: ComfyNodeDef = {
  name: 'AutogrowInputOrder',
  display_name: 'Autogrow Input Order',
  category: 'testing',
  description: '',
  python_module: 'testing',
  output_node: true,
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
      ]
    }
  },
  output: [],
  output_name: []
}

const source: ComfyNodeDef = {
  name: 'ReferenceSources',
  display_name: 'Reference Sources',
  category: 'testing',
  description: '',
  python_module: 'testing',
  output_node: false,
  input: {
    required: {
      width: ['INT', { default: 640 }],
      height: ['INT', { default: 480 }],
      length: ['INT', { default: 24 }],
      prompt: ['STRING', { multiline: true }]
    }
  },
  output: ['INT', 'INT', 'INT', 'STRING', 'IMAGE', 'IMAGE'],
  output_name: ['width', 'height', 'length', 'prompt', 'image_a', 'image_b']
}

export const objectInfo = {
  [source.name]: source,
  [target.name]: target
}

export const catalog: WidgetCatalog = {
  types: {
    ReferenceSources: { widget_order: ['width', 'height', 'length', 'prompt'] },
    AutogrowInputOrder: {
      widget_order: ['prompt', 'width', 'height', 'length', 'ref_image_size']
    }
  }
}

interface SourceValues {
  width: number
  height: number
  length: number
  prompt: string
}

const SOURCE_NODE = 1
const TARGET_NODE = 2
export const sourceNodeId = String(SOURCE_NODE)
export const targetNodeId = String(TARGET_NODE)

const SOURCE_SLOT = { width: 0, height: 1, length: 2 } as const

const WIDTH_LINK = 276
const HEIGHT_LINK = 277
const LENGTH_LINK = 275
const DIMENSION_LINK_IDS = [WIDTH_LINK, HEIGHT_LINK, LENGTH_LINK] as const
type DimensionLinkId = (typeof DIMENSION_LINK_IDS)[number]

const HOST_SOURCE_VALUES: SourceValues = {
  width: 832,
  height: 448,
  length: 37,
  prompt: 'Keep the reference framing'
}

const HOST_REF_IMAGE_SIZE = 'max'

const HOST_ORIGIN_SLOT = {
  [WIDTH_LINK]: SOURCE_SLOT.width,
  [HEIGHT_LINK]: SOURCE_SLOT.height,
  [LENGTH_LINK]: SOURCE_SLOT.length
} as const satisfies Record<DimensionLinkId, number>

const STALE_SOURCE_VALUES: SourceValues = {
  width: 512,
  height: 512,
  length: 1,
  prompt: 'Stale local framing'
}

const STALE_REF_IMAGE_SIZE = 'match'

const STALE_ORIGIN_SLOT = {
  [WIDTH_LINK]: SOURCE_SLOT.height,
  [HEIGHT_LINK]: SOURCE_SLOT.length,
  [LENGTH_LINK]: SOURCE_SLOT.width
} as const satisfies Record<DimensionLinkId, number>

function buildSeed(
  values: SourceValues,
  originSlot: Record<DimensionLinkId, number>,
  refImageSize: string
): WorkflowJSON {
  const dimensionLinksFrom = (slot: number) =>
    DIMENSION_LINK_IDS.filter((id) => originSlot[id] === slot)
  return {
    nodes: [
      {
        id: SOURCE_NODE,
        type: source.name,
        pos: [30, 80],
        size: [260, 320],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [
          {
            name: 'width',
            type: 'INT',
            links: dimensionLinksFrom(SOURCE_SLOT.width)
          },
          {
            name: 'height',
            type: 'INT',
            links: dimensionLinksFrom(SOURCE_SLOT.height)
          },
          {
            name: 'length',
            type: 'INT',
            links: dimensionLinksFrom(SOURCE_SLOT.length)
          },
          { name: 'prompt', type: 'STRING', links: [279] },
          { name: 'image_a', type: 'IMAGE', links: [278] },
          { name: 'image_b', type: 'IMAGE', links: [282] }
        ],
        properties: {},
        widgets_values: [
          values.width,
          values.height,
          values.length,
          values.prompt
        ]
      },
      {
        id: TARGET_NODE,
        type: target.name,
        pos: [340, 80],
        size: [280, 320],
        flags: {},
        order: 1,
        mode: 0,
        inputs: [
          { name: 'ref_images.ref_image_0', type: 'IMAGE', link: 278 },
          { name: 'ref_images.ref_image_1', type: 'IMAGE', link: 282 },
          { name: 'ref_images.ref_image_2', type: 'IMAGE', link: null },
          {
            name: 'prompt',
            type: 'STRING',
            widget: { name: 'prompt' },
            link: 279
          },
          {
            name: 'width',
            type: 'INT',
            widget: { name: 'width' },
            link: WIDTH_LINK
          },
          {
            name: 'height',
            type: 'INT',
            widget: { name: 'height' },
            link: HEIGHT_LINK
          },
          {
            name: 'length',
            type: 'INT',
            widget: { name: 'length' },
            link: LENGTH_LINK
          }
        ],
        outputs: [],
        properties: {},
        widgets_values: [
          'Unconnected prompt fallback',
          640,
          480,
          24,
          refImageSize
        ]
      }
    ],
    links: [
      [WIDTH_LINK, SOURCE_NODE, originSlot[WIDTH_LINK], TARGET_NODE, 4, 'INT'],
      [
        HEIGHT_LINK,
        SOURCE_NODE,
        originSlot[HEIGHT_LINK],
        TARGET_NODE,
        5,
        'INT'
      ],
      [
        LENGTH_LINK,
        SOURCE_NODE,
        originSlot[LENGTH_LINK],
        TARGET_NODE,
        6,
        'INT'
      ],
      [279, SOURCE_NODE, 3, TARGET_NODE, 3, 'STRING'],
      [278, SOURCE_NODE, 4, TARGET_NODE, 0, 'IMAGE'],
      [282, SOURCE_NODE, 5, TARGET_NODE, 1, 'IMAGE']
    ],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

export const seed = buildSeed(
  HOST_SOURCE_VALUES,
  HOST_ORIGIN_SLOT,
  HOST_REF_IMAGE_SIZE
)

export const staleCanvasSeed = buildSeed(
  STALE_SOURCE_VALUES,
  STALE_ORIGIN_SLOT,
  STALE_REF_IMAGE_SIZE
)

function expectedPrompt(
  values: SourceValues,
  originSlot: Record<DimensionLinkId, number>,
  refImageSize: string
) {
  return {
    [sourceNodeId]: { ...values },
    [targetNodeId]: {
      width: [sourceNodeId, originSlot[WIDTH_LINK]],
      height: [sourceNodeId, originSlot[HEIGHT_LINK]],
      length: [sourceNodeId, originSlot[LENGTH_LINK]],
      prompt: [sourceNodeId, 3],
      'ref_images.ref_image_0': [sourceNodeId, 4],
      'ref_images.ref_image_1': [sourceNodeId, 5],
      ref_image_size: refImageSize
    }
  }
}

export const staleCanvasPrompt = expectedPrompt(
  STALE_SOURCE_VALUES,
  STALE_ORIGIN_SLOT,
  STALE_REF_IMAGE_SIZE
)

export const hostPrompt = expectedPrompt(
  HOST_SOURCE_VALUES,
  HOST_ORIGIN_SLOT,
  HOST_REF_IMAGE_SIZE
)

export const hostVisibleValues = {
  width: String(HOST_SOURCE_VALUES.width),
  height: String(HOST_SOURCE_VALUES.height),
  length: String(HOST_SOURCE_VALUES.length),
  prompt: HOST_SOURCE_VALUES.prompt,
  refImageSize: HOST_REF_IMAGE_SIZE
}
