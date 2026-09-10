import { z } from 'astro/zod'

import { workshopInputDefinitionSchema } from './workshop-input-definition'

const jsonObject = z.record(z.string(), z.json())

const workshopCreatorFileSchema = z.object({
  name: z.string().min(1),
  label: z.string().min(1),
  accept: z.enum(['image', 'video', 'audio', 'file']),
  mimeTypes: z.array(z.string().min(1)).min(1).optional(),
  required: z.boolean(),
  maxItems: z.number().int().min(1).max(10)
})

export const workshopCreatorFormSchema = z
  .object({
    parameters: jsonObject,
    inputs: z.record(z.string(), workshopInputDefinitionSchema),
    files: z.array(workshopCreatorFileSchema).default([]),
    request: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('template'), template: z.string().min(1) }),
      z.object({
        kind: z.literal('callback'),
        callback: z.enum([
          'flat',
          'bfl-video',
          'nested-settings',
          'grok-video',
          'seedance',
          'seedream',
          'gemini-image',
          'qwen-image',
          'wan-media',
          'bria-edit',
          'runway-image',
          'tencent-file',
          'meshy-source',
          'kling-avatar',
          'kling-lip-sync',
          'veo'
        ]),
        options: jsonObject.default({})
      })
    ])
  })
  .refine((form) => {
    const names = form.files.map((file) => file.name)
    const properties = jsonObject.parse(form.parameters.properties ?? {})
    return (
      new Set(names).size === names.length &&
      names.every(
        (name) =>
          !Object.hasOwn(properties, name) && Object.hasOwn(form.inputs, name)
      )
    )
  }, 'File widgets must have unique names separate from scalar inputs')

export type WorkshopCreatorForm = z.infer<typeof workshopCreatorFormSchema>
export type WorkshopCreatorFile = z.infer<typeof workshopCreatorFileSchema>
