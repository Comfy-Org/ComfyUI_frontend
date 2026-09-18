import { z } from 'astro/zod'

import type { GeneratedModel } from './models-catalogue'
import {
  generatedExampleSchema,
  generatedFieldSchema,
  generatedNodeSchema,
  workshopExampleValuesSchema
} from '@comfyorg/router-playground/workshop-generated-schema'
import { MODALITIES } from '@comfyorg/router-playground/workshop-types'

/**
 * The shape the generator writes to `workshop-models.generated.json`.
 *
 * Lives apart from `models-catalogue` on purpose: that module's filter and
 * sort helpers hydrate into the catalogue island, and a zod schema graph
 * evaluated at import time would ride along into the browser with them. Only
 * the generated-data boundary tests decode the manifest. The field and
 * example schemas are the engine's, so its types and this check agree.
 */
export const generatedModelSchema = z.object({
  thumbnailUrl: z.string().optional(),
  provider: z.string().optional(),
  modality: z.enum(MODALITIES).optional(),
  priceUsdFrom: z.number().nonnegative().optional(),
  node: generatedNodeSchema.extend({ template: z.string() }).optional(),
  fields: z.array(generatedFieldSchema),
  defaults: workshopExampleValuesSchema,
  examples: z.array(generatedExampleSchema)
})

export function decodeGeneratedModels(
  manifest: unknown
): Record<string, GeneratedModel | undefined> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(manifest)
  if (!parsed.success) return {}
  return Object.fromEntries(
    Object.entries(parsed.data).flatMap(([key, raw]) => {
      const entry = generatedModelSchema.safeParse(raw)
      return entry.success ? [[key, entry.data]] : []
    })
  )
}
