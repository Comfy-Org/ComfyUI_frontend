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

/** Node 2's `ref_image_size` in the host document. */
const HOST_REF_IMAGE_SIZE = 'max'

/**
 * Origin slot each dimension link carries in the host document: `width`
 * reads node 1's `width` output, and so on down the three.
 */
const HOST_ORIGIN_SLOT = { 276: 0, 277: 1, 275: 2 } as const

/** Node 1's widget values on the stale canvas, unequal to the host's. */
const STALE_SOURCE_VALUES: SourceValues = {
  width: 512,
  height: 512,
  length: 1,
  prompt: 'Stale local framing'
}

/** Node 2's `ref_image_size` on the stale canvas. */
const STALE_REF_IMAGE_SIZE = 'match'

/**
 * Origin slot each dimension link carries on the stale canvas, rotated one
 * place off the host's: `width` reads node 1's `height` output, `height`
 * reads `length`, `length` reads `width`. Link ids and target slots are
 * untouched, so the only thing wrong is which named output feeds which named
 * input — the binding this fixture exists to pin.
 */
const STALE_ORIGIN_SLOT = { 276: 1, 277: 2, 275: 0 } as const

type DimensionLinkId = keyof typeof HOST_ORIGIN_SLOT

type LinkTuple = [
  id: number,
  originNode: number,
  originSlot: number,
  targetNode: number,
  targetSlot: number,
  type: string
]

const sourceWidgetsValues = (values: SourceValues) => [
  values.width,
  values.height,
  values.length,
  values.prompt
]

// Reduced saved-workflow topology from PR #17221, not a recorded Agent turn.
export const seed: WorkflowJSON = {
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
        { name: 'width', type: 'INT', links: [276] },
        { name: 'height', type: 'INT', links: [277] },
        { name: 'length', type: 'INT', links: [275] },
        { name: 'prompt', type: 'STRING', links: [279] },
        { name: 'image_a', type: 'IMAGE', links: [278] },
        { name: 'image_b', type: 'IMAGE', links: [282] }
      ],
      properties: {},
      widgets_values: sourceWidgetsValues(HOST_SOURCE_VALUES)
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
        { name: 'height', type: 'INT', widget: { name: 'height' }, link: 277 },
        { name: 'length', type: 'INT', widget: { name: 'length' }, link: 275 }
      ],
      outputs: [],
      properties: {},
      widgets_values: [
        'Unconnected prompt fallback',
        640,
        480,
        24,
        HOST_REF_IMAGE_SIZE
      ]
    }
  ],
  links: [
    [276, 1, HOST_ORIGIN_SLOT[276], 2, 4, 'INT'],
    [277, 1, HOST_ORIGIN_SLOT[277], 2, 5, 'INT'],
    [275, 1, HOST_ORIGIN_SLOT[275], 2, 6, 'INT'],
    [279, 1, 3, 2, 3, 'STRING'],
    [278, 1, 4, 2, 0, 'IMAGE'],
    [282, 1, 5, 2, 1, 'IMAGE']
  ],
  groups: [],
  config: {},
  extra: {},
  version: 0.4
}

function isDimensionLink(id: number): id is DimensionLinkId {
  return Object.hasOwn(STALE_ORIGIN_SLOT, id)
}

function rotateDimensionOrigins(links: readonly unknown[]): LinkTuple[] {
  return (links as readonly LinkTuple[]).map(
    ([id, originNode, originSlot, ...rest]): LinkTuple => [
      id,
      originNode,
      isDimensionLink(id) ? STALE_ORIGIN_SLOT[id] : originSlot,
      ...rest
    ]
  )
}

/**
 * The revision the tab already holds when the host's catch-up arrives: the
 * same saved topology, one revision behind on every value the spec asserts.
 *
 * Without this divergence the fixture would load the host's own seed onto the
 * canvas, every final assertion would already be true before `doc_subscribe`
 * was answered, and a follower that started skipping catch-up over nodes the
 * graph already holds would leave the spec green. Keeping the two apart is
 * what makes those assertions evidence that catch-up reached the canvas.
 */
export const staleCanvasSeed: WorkflowJSON = (() => {
  const stale = structuredClone(seed)
  const links = rotateDimensionOrigins(stale.links)
  stale.links = links
  const [sourceNode, targetNode] = stale.nodes
  sourceNode.outputs = (sourceNode.outputs as { name: string }[]).map(
    (output, slot) => ({
      ...output,
      links: links
        .filter((link) => link[1] === 1 && link[2] === slot)
        .map(([id]) => id)
    })
  )
  sourceNode.widgets_values = sourceWidgetsValues(STALE_SOURCE_VALUES)
  targetNode.widgets_values = [
    'Unconnected prompt fallback',
    640,
    480,
    24,
    STALE_REF_IMAGE_SIZE
  ]
  return stale
})()

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

/** What `graphToPrompt()` emits for the stale canvas, before any catch-up. */
export const staleCanvasPrompt = expectedPrompt(
  STALE_SOURCE_VALUES,
  STALE_ORIGIN_SLOT,
  STALE_REF_IMAGE_SIZE
)

/** What `graphToPrompt()` must emit once the host's catch-up has landed. */
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
