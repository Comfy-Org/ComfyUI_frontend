import { z } from 'zod'

/**
 * Payload sends `null` for an unset field, while the render model marks the
 * same absence with an optional property. Normalizing here keeps every
 * `null`-vs-`undefined` guard out of the flatten.
 */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((value) => value ?? undefined)

/** A populated media upload, trimmed by the query's `populate[media]`. */
const MediaFileSchema = z.object({
  url: z.string().min(1),
  mimeType: z.string().min(1),
  alt: z.string().min(1)
})

/**
 * A `{ file, poster }` media group. Payload always returns the group, so an
 * empty slot is `file: null` rather than an absent group.
 */
const MediaGroupSchema = z.object({
  file: optional(MediaFileSchema),
  poster: optional(MediaFileSchema)
})

const FeaturedSchema = z.object({
  order: optional(z.number()),
  autoplayMs: optional(z.number()),
  showTitle: optional(z.boolean()),
  media: optional(MediaGroupSchema)
})

const EventDocSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(['livestream', 'hackathon', 'community']),
  description: z.string().min(1),
  startDateTime: z.string().min(1),
  endDateTime: optional(z.string()),
  timeZone: optional(z.string()),
  locationMode: z.enum(['online', 'in-person']),
  locationName: optional(z.string()),
  href: optional(z.string()),
  newTab: optional(z.boolean()),
  ctaLabel: optional(z.string()),
  liveVideoId: optional(z.string()),
  recordingVideoId: optional(z.string()),
  cardMedia: optional(MediaGroupSchema),
  isFeatured: optional(z.boolean()),
  featured: optional(FeaturedSchema)
})

export const EventsListResponseSchema = z.object({
  docs: z.array(EventDocSchema)
})

export type EventDoc = z.infer<typeof EventDocSchema>
export type EventMediaGroup = z.infer<typeof MediaGroupSchema>
