import { z } from 'zod'

export const zLogoIndex = z.record(z.string(), z.string())

export type LogoIndex = z.infer<typeof zLogoIndex>

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
