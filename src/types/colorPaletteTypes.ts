import { LiteGraph } from '@comfyorg/litegraph'
import { z } from 'zod'

const nodeSlotSchema = z.object({
  BOOLEAN: z.string().optional(),
  CLIP: z.string().optional(),
  CLIP_VISION: z.string().optional(),
  CLIP_VISION_OUTPUT: z.string().optional(),
  CONDITIONING: z.string().optional(),
  CONTROL_NET: z.string().optional(),
  CONTROL_NET_WEIGHTS: z.string().optional(),
  FLOAT: z.string().optional(),
  GLIGEN: z.string().optional(),
  IMAGE: z.string().optional(),
  IMAGEUPLOAD: z.string().optional(),
  INT: z.string().optional(),
  LATENT: z.string().optional(),
  LATENT_KEYFRAME: z.string().optional(),
  MASK: z.string().optional(),
  MODEL: z.string().optional(),
  SAMPLER: z.string().optional(),
  SIGMAS: z.string().optional(),
  STRING: z.string().optional(),
  STYLE_MODEL: z.string().optional(),
  T2I_ADAPTER_WEIGHTS: z.string().optional(),
  TAESD: z.string().optional(),
  TIMESTEP_KEYFRAME: z.string().optional(),
  UPSCALE_MODEL: z.string().optional(),
  VAE: z.string().optional()
})

const litegraphBaseSchema = z.object({
  BACKGROUND_IMAGE: z.string().optional(),
  CLEAR_BACKGROUND_COLOR: z.string().optional(),
  NODE_TITLE_COLOR: z.string().optional(),
  NODE_SELECTED_TITLE_COLOR: z.string().optional(),
  NODE_TEXT_SIZE: z.number().optional(),
  NODE_TEXT_COLOR: z.string().optional(),
  NODE_SUBTEXT_SIZE: z.number().optional(),
  NODE_DEFAULT_COLOR: z.string().optional(),
  NODE_DEFAULT_BGCOLOR: z.string().optional(),
  NODE_DEFAULT_BOXCOLOR: z.string().optional(),
  NODE_DEFAULT_SHAPE: z
    .union([
      z.literal(LiteGraph.BOX_SHAPE),
      z.literal(LiteGraph.ROUND_SHAPE),
      z.literal(LiteGraph.CARD_SHAPE)
    ])
    .optional(),
  NODE_BOX_OUTLINE_COLOR: z.string().optional(),
  NODE_BYPASS_BGCOLOR: z.string().optional(),
  NODE_ERROR_COLOUR: z.string().optional(),
  DEFAULT_SHADOW_COLOR: z.string().optional(),
  DEFAULT_GROUP_FONT: z.number().optional(),
  WIDGET_BGCOLOR: z.string().optional(),
  WIDGET_OUTLINE_COLOR: z.string().optional(),
  WIDGET_TEXT_COLOR: z.string().optional(),
  WIDGET_SECONDARY_TEXT_COLOR: z.string().optional(),
  LINK_COLOR: z.string().optional(),
  EVENT_LINK_COLOR: z.string().optional(),
  CONNECTING_LINK_COLOR: z.string().optional(),
  BADGE_FG_COLOR: z.string().optional(),
  BADGE_BG_COLOR: z.string().optional()
})

const comfyBaseSchema = z.object({
  ['fg-color']: z.string(),
  ['bg-color']: z.string(),
  ['bg-img']: z.string().optional(),
  ['comfy-menu-bg']: z.string(),
  ['comfy-menu-secondary-bg']: z.string().optional(),
  ['comfy-input-bg']: z.string(),
  ['input-text']: z.string(),
  ['descrip-text']: z.string(),
  ['drag-text']: z.string(),
  ['error-text']: z.string(),
  ['border-color']: z.string(),
  ['tr-even-bg-color']: z.string(),
  ['tr-odd-bg-color']: z.string(),
  ['content-bg']: z.string(),
  ['content-fg']: z.string(),
  ['content-hover-bg']: z.string(),
  ['content-hover-fg']: z.string(),
  ['bar-shadow']: z.string()
})

const colorsSchema = z
  .object({
    node_slot: nodeSlotSchema,
    litegraph_base: litegraphBaseSchema,
    comfy_base: comfyBaseSchema
  })
  .passthrough()

const paletteSchema = z.object({
  id: z.string(),
  name: z.string(),
  colors: colorsSchema
})

export const colorPalettesSchema = z.record(paletteSchema)

export type Colors = z.infer<typeof colorsSchema>
export type Palette = z.infer<typeof paletteSchema>
export type ColorPalettes = z.infer<typeof colorPalettesSchema>
