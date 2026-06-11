import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { z } from 'astro/zod'

export const gallerySchema = z.object({
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

const gallery = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/gallery' }),
  schema: gallerySchema
})

export const collections = { gallery }
