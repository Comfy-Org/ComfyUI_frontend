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
    fixedValues: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional(),
    files: z.array(workshopCreatorFileSchema).default([]),
    request: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('template'), template: z.string().min(1) }),
      z.object({
        kind: z.literal('callback'),
        callback: z.enum([
          'flat',
          'dialogue',
          'ideogram',
          'bfl-video',
          'nested-settings',
          'grok-video',
          'seedance',
          'seedream',
          'gemini-image',
          'gemini-video',
          'luma-video',
          'luma-image',
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
    const properties = jsonObject.safeParse(form.parameters.properties ?? {})
    if (!properties.success) return false
    return (
      new Set(names).size === names.length &&
      names.every(
        (name) =>
          !Object.hasOwn(properties.data, name) &&
          Object.hasOwn(form.inputs, name)
      )
    )
  }, 'File widgets must have unique names separate from scalar inputs')
  .refine((form) => {
    const properties = jsonObject.safeParse(form.parameters.properties ?? {})
    if (!properties.success) return false
    return Object.entries(form.fixedValues ?? {}).every(([name, value]) => {
      const schema = jsonObject.safeParse(properties.data[name])
      return (
        form.inputs[name]?.hidden &&
        schema.success &&
        schema.data.const === value
      )
    })
  }, 'Fixed values must have hidden widgets and matching schema constants')

export type WorkshopCreatorForm = z.infer<typeof workshopCreatorFormSchema>
export type WorkshopCreatorFile = z.infer<typeof workshopCreatorFileSchema>
