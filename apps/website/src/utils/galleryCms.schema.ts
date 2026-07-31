import { z } from 'zod'

const RelatedNameSchema = z.object({ name: z.string().min(1) })

const MediaSchema = z.object({
  url: z.string().min(1),
  mimeType: z.string().nullish()
})

const GalleryDocSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  href: z.string().nullish(),
  media: MediaSchema,
  creator: RelatedNameSchema,
  team: RelatedNameSchema.nullish(),
  tool: RelatedNameSchema
})

export const GalleryListResponseSchema = z.object({
  docs: z.array(GalleryDocSchema)
})

export type GalleryDoc = z.infer<typeof GalleryDocSchema>
