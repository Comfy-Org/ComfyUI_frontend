import { z } from 'astro/zod'

type HubMediaType = 'image' | 'video' | 'audio' | '3d'
type ThumbnailVariant =
  | 'compareSlider'
  | 'hoverDissolve'
  | 'zoomHover'
  | 'hoverZoom'

export interface HubTemplate {
  readonly name: string
  readonly title: string
  readonly mediaType: HubMediaType
  readonly mediaSubtype?: string
  readonly tags: readonly string[]
  readonly models: readonly string[]
  readonly logos: readonly { provider: string | string[] }[]
  readonly usage: number
  readonly date: string
  readonly thumbnails: readonly string[]
  readonly username: string
  readonly isApp: boolean
  readonly thumbnailVariant?: ThumbnailVariant
}

interface HubIoPort {
  readonly nodeType?: string
  readonly mediaType?: string
  readonly file?: string
}

interface HubTemplateDetail {
  readonly description?: string
  readonly tutorialUrl?: string
  readonly requiresCustomNodes?: readonly string[]
  readonly inputs?: readonly HubIoPort[]
  readonly outputs?: readonly HubIoPort[]
  readonly size?: number
  readonly openSource?: boolean
}

export type HubTemplateDetails = Readonly<Record<string, HubTemplateDetail>>

const hubMediaTypeSchema: z.ZodType<HubMediaType> = z.enum([
  'image',
  'video',
  'audio',
  '3d'
])
const thumbnailVariantSchema: z.ZodType<ThumbnailVariant> = z.enum([
  'compareSlider',
  'hoverDissolve',
  'zoomHover',
  'hoverZoom'
])

const hubTemplateSchema: z.ZodType<HubTemplate> = z.looseObject({
  name: z.string(),
  title: z.string(),
  mediaType: hubMediaTypeSchema,
  mediaSubtype: z.string().optional(),
  tags: z.array(z.string()),
  models: z.array(z.string()),
  logos: z.array(
    z.looseObject({
      provider: z.union([z.string(), z.array(z.string())])
    })
  ),
  usage: z.number(),
  date: z.string(),
  thumbnails: z.array(z.string()),
  username: z.string(),
  isApp: z.boolean(),
  thumbnailVariant: thumbnailVariantSchema.optional()
})

export const hubTemplatesSchema = z.array(hubTemplateSchema)

const hubIoPortSchema: z.ZodType<HubIoPort> = z.looseObject({
  nodeType: z.string().optional(),
  mediaType: z.string().optional(),
  file: z.string().optional()
})

export const hubTemplateDetailsSchema: z.ZodType<HubTemplateDetails> = z.record(
  z.string(),
  z.looseObject({
    description: z.string().optional(),
    tutorialUrl: z.string().optional(),
    requiresCustomNodes: z.array(z.string()).optional(),
    inputs: z.array(hubIoPortSchema).optional(),
    outputs: z.array(hubIoPortSchema).optional(),
    size: z.number().optional(),
    openSource: z.boolean().optional()
  })
)
