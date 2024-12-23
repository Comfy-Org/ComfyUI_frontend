import { z } from 'zod'

const nodeSlotSchema = z
  .object({
    BOOLEAN: z.string().optional(),
    CLIP: z.string(),
    CLIP_VISION: z.string(),
    CLIP_VISION_OUTPUT: z.string(),
    CONDITIONING: z.string(),
    CONTROL_NET: z.string(),
    CONTROL_NET_WEIGHTS: z.string().optional(),
    FLOAT: z.string().optional(),
    GLIGEN: z.string().optional(),
    IMAGE: z.string(),
    IMAGEUPLOAD: z.string().optional(),
    INT: z.string().optional(),
    LATENT: z.string(),
    LATENT_KEYFRAME: z.string().optional(),
    MASK: z.string(),
    MODEL: z.string(),
    SAMPLER: z.string().optional(),
    SIGMAS: z.string().optional(),
    STRING: z.string().optional(),
    STYLE_MODEL: z.string(),
    T2I_ADAPTER_WEIGHTS: z.string().optional(),
    TAESD: z.string(),
    TIMESTEP_KEYFRAME: z.string().optional(),
    UPSCALE_MODEL: z.string().optional(),
    VAE: z.string()
  })
  .passthrough()

const litegraphBaseSchema = z
  .object({
    BACKGROUND_IMAGE: z.string(),
    CLEAR_BACKGROUND_COLOR: z.string(),
    NODE_TITLE_COLOR: z.string(),
    NODE_SELECTED_TITLE_COLOR: z.string(),
    NODE_TEXT_SIZE: z.number(),
    NODE_TEXT_COLOR: z.string(),
    NODE_SUBTEXT_SIZE: z.number(),
    NODE_DEFAULT_COLOR: z.string(),
    NODE_DEFAULT_BGCOLOR: z.string(),
    NODE_DEFAULT_BOXCOLOR: z.string(),
    NODE_DEFAULT_SHAPE: z.string(),
    NODE_BOX_OUTLINE_COLOR: z.string(),
    NODE_BYPASS_BGCOLOR: z.string(),
    NODE_ERROR_COLOUR: z.string(),
    DEFAULT_SHADOW_COLOR: z.string(),
    DEFAULT_GROUP_FONT: z.number(),
    WIDGET_BGCOLOR: z.string(),
    WIDGET_OUTLINE_COLOR: z.string(),
    WIDGET_TEXT_COLOR: z.string(),
    WIDGET_SECONDARY_TEXT_COLOR: z.string(),
    LINK_COLOR: z.string(),
    EVENT_LINK_COLOR: z.string(),
    CONNECTING_LINK_COLOR: z.string(),
    BADGE_FG_COLOR: z.string().optional(),
    BADGE_BG_COLOR: z.string().optional()
  })
  .passthrough()

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
