import { z } from 'zod'
import { creationSettingsSchema } from './creations'

const composerModeSchema = creationSettingsSchema
  .pick({
    scene: true,
    direction: true,
    enhance: true,
    creative: true,
    aspect: true,
    resolution: true,
    takes: true,
    seed: true,
    video: true,
    referenceBundleId: true,
    references: true,
    assets: true,
    plan: true,
    sourceId: true,
    lastSourceId: true
  })
  .extend({
    seedBehavior: z
      .enum(['random', 'fixed', 'increment', 'decrement'])
      .optional(),
    modelSlug: z
      .string()
      .max(200)
      .regex(/^[a-zA-Z0-9._-]*$/)
  })
const schema = z.object({
  version: z.literal(1),
  mode: z.enum(['image', 'video']),
  image: composerModeSchema,
  video: composerModeSchema
})
export type ComposerModeDraft = z.infer<typeof composerModeSchema>
export type ComposerDrafts = z.infer<typeof schema>
export function composerDraftKey(namespace: string): string {
  if (!namespace || namespace.length > 500)
    throw new Error('Missing composer scope')
  return `comfy-cinema-composer-v1:${namespace}`
}
export function parseComposerDrafts(json: string): ComposerDrafts {
  if (json.length > 1000000) throw new Error('Composer draft too large')
  return schema.parse(JSON.parse(json))
}
export function serializeComposerDrafts(value: ComposerDrafts): string {
  const json = JSON.stringify(schema.parse(value))
  if (json.length > 1000000) throw new Error('Composer draft too large')
  return json
}
