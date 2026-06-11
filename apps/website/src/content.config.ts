import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

export const gallerySchema = z.object({
  order: z.number().int(),
  image: z.string().url().optional(),
  video: z.string().url().optional(),
  title: z.string(),
  userAlias: z.string(),
  teamAlias: z.string(),
  tool: z.string(),
  href: z.string().url().optional(),
  objectPosition: z.string().optional(),
  objectFit: z.string().optional(),
  visible: z.boolean().default(true)
})

export type GalleryItem = z.infer<typeof gallerySchema>

// The default `generateId` lowercases path segments (e.g. `zh-CN/foo` becomes
// `zh-cn/foo`), which collides with the BCP-47 locale codes Astro's i18n
// config uses elsewhere. Strip just the `.json` extension to keep the path —
// and therefore the locale prefix — verbatim.
const gallery = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/gallery',
    generateId: ({ entry }) => entry.replace(/\.json$/, '')
  }),
  schema: gallerySchema
})

export const collections = { gallery }
