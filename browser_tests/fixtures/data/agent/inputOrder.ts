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

/**
 * Node 1's widget values the host document carries. Deliberately unequal to
 * each other: equal dimensions cannot distinguish a correct named binding
 * from one that landed on the wrong slot.
 */
const HOST_SOURCE_VALUES: SourceValues = {
  width: 832,
  height: 448,
  length: 37,
  prompt: 'Keep the reference framing'
}

const HOST_REF_IMAGE_SIZE = 'max'

// The one source of the dimension link ids. Both origin maps below
// `satisfies Record<DimensionLinkId, number>` rather than `as const`, so an
// id dropped from here cannot typecheck while silently dropping a link from
// node 1's outputs and leaving it in the link tuples.
const DIMENSION_LINK_IDS = [276, 277, 275] as const
type DimensionLinkId = (typeof DIMENSION_LINK_IDS)[number]

/**
 * Origin slot each dimension link carries in the host document: `width`
 * reads node 1's `width` output, and so on down the three.
 */
const HOST_ORIGIN_SLOT = {
  276: 0,
  277: 1,
  275: 2
} satisfies Record<DimensionLinkId, number>

const STALE_SOURCE_VALUES: SourceValues = {
  width: 512,
  height: 512,
  length: 1,
  prompt: 'Stale local framing'
}

const STALE_REF_IMAGE_SIZE = 'match'

/**
 * Origin slot each dimension link carries on the stale canvas, rotated one
 * place off the host's: `width` reads node 1's `height` output, `height`
 * reads `length`, `length` reads `width`. Link ids and target slots are
 * untouched, so the only thing wrong is which named output feeds which named
 * input — the binding this fixture exists to pin.
 */
const STALE_ORIGIN_SLOT = {
  276: 1,
  277: 2,
  275: 0
} satisfies Record<DimensionLinkId, number>

// Reduced saved-workflow topology from PR #17221, not a recorded Agent turn.
// Both revisions go through here so neither can drift structurally against
// the other.
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
        id: 1,
        type: source.name,
        pos: [30, 80],
        size: [260, 320],
        flags: {},
        order: 0,
        mode: 0,
        inputs: [],
        outputs: [
          { name: 'width', type: 'INT', links: dimensionLinksFrom(0) },
          { name: 'height', type: 'INT', links: dimensionLinksFrom(1) },
          { name: 'length', type: 'INT', links: dimensionLinksFrom(2) },
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
        id: 2,
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
          { name: 'width', type: 'INT', widget: { name: 'width' }, link: 276 },
          {
            name: 'height',
            type: 'INT',
            widget: { name: 'height' },
            link: 277
          },
          {
            name: 'length',
            type: 'INT',
            widget: { name: 'length' },
            link: 275
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
      [276, 1, originSlot[276], 2, 4, 'INT'],
      [277, 1, originSlot[277], 2, 5, 'INT'],
      [275, 1, originSlot[275], 2, 6, 'INT'],
      [279, 1, 3, 2, 3, 'STRING'],
      [278, 1, 4, 2, 0, 'IMAGE'],
      [282, 1, 5, 2, 1, 'IMAGE']
    ],
    groups: [],
    config: {},
    extra: {},
    version: 0.4
  }
}

/** The revision the host document is minted from. */
export const seed = buildSeed(
  HOST_SOURCE_VALUES,
  HOST_ORIGIN_SLOT,
  HOST_REF_IMAGE_SIZE
)

/**
 * The revision the tab already holds when the host's catch-up arrives. It
 * has to differ from `seed`: loading the host's own seed onto the canvas
 * would make the spec's visible-value and binding assertions true before
 * `doc_subscribe` was answered, so a follower that skipped catch-up over
 * nodes the graph already holds would leave the spec green.
 */
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
    '1': { ...values },
    '2': {
      width: ['1', originSlot[276]],
      height: ['1', originSlot[277]],
      length: ['1', originSlot[275]],
      prompt: ['1', 3],
      'ref_images.ref_image_0': ['1', 4],
      'ref_images.ref_image_1': ['1', 5],
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

/** The host values the spec reads off the rendered Vue nodes. */
export const hostVisibleValues = {
  width: String(HOST_SOURCE_VALUES.width),
  height: String(HOST_SOURCE_VALUES.height),
  length: String(HOST_SOURCE_VALUES.length),
  prompt: HOST_SOURCE_VALUES.prompt,
  refImageSize: HOST_REF_IMAGE_SIZE
}

/** The stale values those same rows show before catch-up. */
export const staleVisibleValues = {
  width: String(STALE_SOURCE_VALUES.width),
  height: String(STALE_SOURCE_VALUES.height),
  length: String(STALE_SOURCE_VALUES.length),
  prompt: STALE_SOURCE_VALUES.prompt,
  refImageSize: STALE_REF_IMAGE_SIZE
}
