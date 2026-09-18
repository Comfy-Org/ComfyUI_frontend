import { z } from 'zod'

import { workshopInputDefinitionSchema } from './workshop-input-definition'

/**
 * The field and example shapes the site's generator writes for each model.
 * The engine's types derive from these, and the site composes its model-level
 * decoder from them, so the runtime check and the type stay one contract.
 */
const scalar = z.union([z.string(), z.number(), z.boolean()])
// JSON Schema fragments the engine reads as loose records. The manifest is
// parsed JSON already, so typing the values as unknown loses no check.
const schemaObject = z.record(z.string(), z.unknown())

export const workshopExampleValuesSchema = z.record(
  z.string(),
  z.union([scalar, z.array(z.string())])
)

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

export const generatedFieldSchema = z.discriminatedUnion('kind', [
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

export const generatedNodeSchema = z.object({
  id: z.string(),
  displayName: z.string()
})

export const generatedExampleSchema = z.object({
  name: z.string(),
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  thumbnailUrl: z.string(),
  mediaKind: z.enum(['image', 'video', 'audio']).optional(),
  sampleOnly: z.boolean().optional(),
  node: generatedNodeSchema.optional(),
  fields: z.array(generatedFieldSchema).optional(),
  values: workshopExampleValuesSchema
})
