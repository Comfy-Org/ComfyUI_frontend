import { z } from 'astro/zod'

/**
 * How a media asset should be presented. Carried explicitly rather than
 * guessed from the URL: assets are served from a CDN and several are named by
 * UUID, so the extension is not always there to read.
 */
const mediaKindSchema = z.enum(['image', 'video', 'audio'])

export const WORKSHOP_USE_CASES = [
  'generate-images',
  'edit-images',
  'animate-images',
  'generate-videos',
  'edit-videos',
  'text',
  '3d',
  'audio'
] as const

const workshopUseCaseSchema = z.enum(WORKSHOP_USE_CASES)

const mediaAssetSchema = z.object({
  url: z.string().url(),
  kind: mediaKindSchema,
  /** The prompt that produced a sample, where the content side recorded one. */
  prompt: z.string().optional()
})

/**
 * A worked example: the values to load into the form, and the output that run
 * produced. `examples[i]` pairs with `media.samples[i]` by index.
 */
const exampleSchema = z.object({
  title: z.string().min(1),
  description: z.string(),
  /**
   * Router parameter names to values. Empty for models whose node inputs have
   * no Router equivalent — HeyGen avatars, Sync Labs, Bria RMBG — where the
   * output sample still applies but there is nothing to prefill.
   */
  values: z.record(z.string(), z.json())
})

/**
 * The display overlay for one model: everything the catalog cannot know
 * because it is editorial rather than derived from the Router schema.
 *
 * Kept as a separate collection rather than merged into the model entries,
 * because those are regenerated wholesale from the partner client and would
 * discard anything written into them by hand.
 *
 */
export const workshopDisplaySourceSchema = z.object({
  /** Original content-pack model ID; the reviewed alias selects its Router ID. */
  id: z.string().regex(/^[^/]+\/[^/]+$/, 'expected "provider/model"'),
  displayName: z.string().trim().min(1).optional(),

  media: z
    .object({
      thumbnail: mediaAssetSchema.optional(),
      samples: z.array(mediaAssetSchema).optional()
    })
    .default({}),

  examples: z.array(exampleSchema).default([]),

  /**
   * Router field names intentionally hidden under the Advanced disclosure.
   * This is editorial presentation metadata, not part of the provider request
   * schema, so it lives beside the other display choices in this overlay.
   */
  advancedFields: z.array(z.string().min(1)).default([]),

  pricing: z
    .object({ creditsPerRun: z.number().nonnegative() })
    .nullable()
    .default(null),

  status: z.enum(['active', 'deprecated', 'unavailable']).default('active'),
  useCases: z.array(workshopUseCaseSchema).min(1),
  license: z.string().nullable().default(null),

  /**
   * How the thumbnail was chosen. `family` means it came from a related model
   * rather than this exact one, which is why 147 models share an image with a
   * sibling variant. Kept so a reviewer can sort by it.
   */
  mediaConfidence: z.enum(['exact', 'family', 'none']),
  /** The content side wants a human to glance at this entry. */
  needsReview: z.boolean()
})

export type WorkshopDisplaySource = z.infer<typeof workshopDisplaySourceSchema>

const contentSlug = z.string().regex(/^[a-z0-9][a-z0-9._-]*$/)

export function workshopContentSlug(modelId: string, useCase: string): string {
  return `${modelId.replace('/', '--')}--${useCase}`
}

export const workshopDisplaySchema = workshopDisplaySourceSchema
  .omit({ id: true, useCases: true })
  .extend({
    id: contentSlug,
    slug: contentSlug,
    modelId: workshopDisplaySourceSchema.shape.id,
    useCase: workshopUseCaseSchema,
    withheldContent: z
      .object({
        media: workshopDisplaySourceSchema.shape.media,
        examples: workshopDisplaySourceSchema.shape.examples,
        reason: z.literal('shared-across-use-cases')
      })
      .optional()
  })
  .refine(
    (entry) =>
      entry.id === entry.slug &&
      entry.slug === workshopContentSlug(entry.modelId, entry.useCase),
    'Content id/slug must be model plus use case; modelId stays separate'
  )
  .refine(
    (entry) => entry.examples.length <= (entry.media.samples?.length ?? 0),
    'Examples and samples must remain paired by index'
  )

export const workshopDisplayEntriesSchema = z
  .array(workshopDisplaySchema)
  .superRefine((entries, context) => {
    const slugs = new Set<string>()
    const mediaUseCases = new Map<string, string>()
    for (const [index, entry] of entries.entries()) {
      if (slugs.has(entry.slug))
        context.addIssue({
          code: 'custom',
          path: [index, 'slug'],
          message: `Duplicate content slug: ${entry.slug}`
        })
      slugs.add(entry.slug)
      for (const asset of [
        entry.media.thumbnail,
        ...(entry.media.samples ?? [])
      ]) {
        if (!asset) continue
        const useCase = mediaUseCases.get(asset.url)
        if (useCase && useCase !== entry.useCase)
          context.addIssue({
            code: 'custom',
            path: [index, 'media'],
            message: `Media is shared across use cases: ${asset.url}`
          })
        mediaUseCases.set(asset.url, entry.useCase)
      }
    }
  })

export type WorkshopDisplayEntry = z.infer<typeof workshopDisplaySchema>
