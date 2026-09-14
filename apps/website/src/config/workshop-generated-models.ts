import { z } from 'astro/zod'

import type { GeneratedModel } from './models-catalogue'
import { MODALITIES } from './models-catalogue'
import { workshopInputDefinitionSchema } from './workshop-input-definition'

/**
 * The shape the generator writes to `workshop-models.generated.json`.
 *
 * Lives apart from `models-catalogue` on purpose: that module's filter and
 * sort helpers hydrate into the catalogue island, and a zod schema graph
 * evaluated at import time would ride along into the browser with them. Only
 * the generated-data boundary tests decode the manifest.
 */
const scalar = z.union([z.string(), z.number(), z.boolean()])
const schemaObject = z.record(z.string(), z.json())
const formValues = z.record(z.string(), z.union([scalar, z.array(z.string())]))
const fieldBase = z.object({
  name: z.string(),
  label: z.string(),
  hint: z.string().optional(),
  advanced: z.boolean().optional(),
  advancedIndex: z.number().int().nonnegative().optional(),
  required: z.boolean().optional(),
  inputSchema: schemaObject.optional(),
  presentation: workshopInputDefinitionSchema.optional()
})
const generatedField = z.discriminatedUnion('kind', [
  fieldBase.extend({
    kind: z.literal('text'),
    multiline: z.boolean(),
    required: z.boolean(),
    default: z.string().optional(),
    valueType: z.enum(['string', 'json']).optional(),
    jsonSchema: schemaObject.optional(),
    suggestions: z.array(scalar).optional(),
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().nonnegative().optional()
  }),
  fieldBase.extend({
    kind: z.literal('number'),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.union([z.number().positive(), z.literal('any')]),
    default: z.number().optional()
  }),
  fieldBase.extend({
    kind: z.literal('select'),
    options: z.array(scalar).min(1),
    default: scalar.optional()
  }),
  fieldBase.extend({
    kind: z.literal('toggle'),
    default: z.boolean().optional()
  }),
  fieldBase.extend({
    kind: z.literal('file'),
    accept: z.enum(['image', 'video', 'audio', 'file']),
    mimeTypes: z.array(z.string()).optional(),
    required: z.boolean(),
    multiple: z.boolean().optional(),
    maxItems: z.number().int().positive().optional()
  })
])
const node = z.object({ id: z.string(), displayName: z.string() })
const generatedExample = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  thumbnailUrl: z.string(),
  mediaKind: z.enum(['image', 'video', 'audio']).optional(),
  sampleOnly: z.boolean().optional(),
  node: node.optional(),
  fields: z.array(generatedField).optional(),
  values: formValues
})
const generatedModel = z.object({
  thumbnailUrl: z.string().optional(),
  provider: z.string().optional(),
  modality: z.enum(MODALITIES).optional(),
  priceUsdFrom: z.number().nonnegative().optional(),
  node: node.extend({ template: z.string() }).optional(),
  fields: z.array(generatedField),
  defaults: formValues,
  examples: z.array(generatedExample)
})

export function decodeGeneratedModels(
  manifest: unknown
): Record<string, GeneratedModel | undefined> {
  const parsed = z.record(z.string(), z.unknown()).safeParse(manifest)
  if (!parsed.success) return {}
  return Object.fromEntries(
    Object.entries(parsed.data).flatMap(([key, raw]) => {
      const entry = generatedModel.safeParse(raw)
      return entry.success ? [[key, entry.data]] : []
    })
  )
}
