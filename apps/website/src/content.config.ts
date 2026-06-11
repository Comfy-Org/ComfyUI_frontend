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

export const eventsSchema = z.object({
  order: z.number().int(),
  label: z.string(),
  title: z.string(),
  cta: z.string(),
  href: z.string().url().or(z.literal('#'))
})

export type EventItem = z.infer<typeof eventsSchema>

export const tutorialsSchema = z.object({
  order: z.number().int(),
  tags: z.array(z.string()),
  title: z.string(),
  videoSrc: z.string().url(),
  href: z.string().url().optional(),
  poster: z.string().url().optional(),
  posterTime: z.number().optional()
})

export type LearningTutorial = z.infer<typeof tutorialsSchema>
export type ResolvedTutorial = LearningTutorial & { slug: string }

// The default `generateId` lowercases path segments (e.g. `zh-CN/foo` becomes
// `zh-cn/foo`), which collides with the BCP-47 locale codes Astro's i18n
// config uses elsewhere. Strip the file extension to keep the path — and
// therefore the locale prefix — verbatim.
const preservePathId = ({ entry }: { entry: string }): string =>
  entry.replace(/\.[^.]+$/, '')

const gallery = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/gallery',
    generateId: preservePathId
  }),
  schema: gallerySchema
})

const events = defineCollection({
  loader: glob({
    pattern: '**/*.json',
    base: './src/content/events',
    generateId: preservePathId
  }),
  schema: eventsSchema
})

const tutorials = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/tutorials',
    generateId: preservePathId
  }),
  schema: tutorialsSchema
})

export const collections = { gallery, events, tutorials }
