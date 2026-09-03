import { z } from 'astro/zod'

const WORKSHOP_MODALITIES = [
  'image',
  'video',
  'audio',
  'music',
  '3d',
  'svg'
] as const

const workshopMediaRoleSchema = z.strictObject({
  role: z.string().min(1),
  required: z.boolean(),
  cardinality: z.enum(['single', 'many']),
  minItems: z.number().int().nonnegative(),
  maxItems: z.number().int().positive().optional(),
  /**
   * Extra per-role inputs the provider accepts. Empty for all but six Luma
   * roles, which take base64 `data` plus a `media_type` as an alternative to
   * a URL. Nothing renders it yet, but it is real API surface and the
   * previous decoder dropped it by rebuilding the object, so it is carried
   * rather than silently lost a second time.
   */
  extras: z.array(z.record(z.string(), z.unknown())).optional()
})

/**
 * One Router model, one file. `strictObject` so a generator that starts
 * emitting an unexpected key fails the content build rather than shipping a
 * field nothing renders.
 *
 * This is the only description of the shape. The generator writes against it
 * and the site reads through it, so there is no second hand-written decoder
 * to drift.
 */
export const workshopModelSchema = z.strictObject({
  /** Exact Router model ID, e.g. `bfl/flux-2-pro`. The run contract. */
  id: z.string().regex(/^[^/]+\/[^/]+$/, 'expected "provider/model"'),
  /**
   * URL segment, stable forever once indexed. `provider--model`, so the
   * double dash separating the two halves is expected rather than a typo.
   */
  slug: z
    .string()
    .regex(/^[a-z0-9]+(?:[-._]{1,2}[a-z0-9]+)*$/, 'expected a URL slug'),
  displayName: z.string().min(1),
  provider: z.string().min(1),
  modality: z.enum(WORKSHOP_MODALITIES),
  description: z.string(),
  tags: z.array(z.string()),
  /** The model's raw input schema, passed through and rendered as a form. */
  parameters: z.record(z.string(), z.unknown()),
  roles: z.array(workshopMediaRoleSchema)
})

// Only the model schema and its inferred type are exported: the pieces
// below it are re-exported by the PRs that actually consume them.
export type WorkshopModelEntry = z.infer<typeof workshopModelSchema>
