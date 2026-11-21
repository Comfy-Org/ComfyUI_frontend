import { z } from 'zod'

export const zLogoIndex = z.record(z.string(), z.string())

export type LogoIndex = z.infer<typeof zLogoIndex>

/**
 * Optional metadata for workflows shipped by a custom node extension.
 * Keys in the index are workflow filenames without the .json suffix.
 */
export const zExtensionTemplateIndex = z.record(
  z.string(),
  z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    openSource: z.boolean().optional(),
    models: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional()
  })
)

export type ExtensionTemplateIndex = z.infer<typeof zExtensionTemplateIndex>
export type ExtensionTemplateMetadata = ExtensionTemplateIndex[string]

export const zTemplateInput = z.object({
  nodeId: z.union([z.number(), z.string()]),
  nodeType: z.string(),
  file: z.string(),
  mediaType: z.string(),
  sourceRevision: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .optional()
    .catch(undefined)
})

export type TemplateInput = z.infer<typeof zTemplateInput>
