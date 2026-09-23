import { z } from 'astro/zod'

import type { GeneratedField } from './models-catalogue'

export const workshopInputDefinitionSchema = z.object({
  label: z.string().min(1),
  help: z.string().max(140),
  hidden: z.boolean(),
  advanced: z.boolean(),
  control: z.enum([
    'text-box',
    'text-area',
    'dialogue',
    'dropdown',
    'slider',
    'number',
    'toggle',
    'media'
  ]),
  defaultSource: z.enum(['router', 'curated']).optional(),
  unit: z.enum(['seconds', 'pixels', 'fps']).optional(),
  optionLabels: z.record(z.string(), z.string().min(1)).optional(),
  imageSource: z.literal('url').optional(),
  maxUploadBytes: z.number().int().positive().optional(),
  maxVideoDurationSeconds: z.number().positive().optional(),
  formConstraint: z
    .object({
      schema: z.record(z.string(), z.json()),
      error: z.enum(['required', 'incompatible'])
    })
    .optional(),
  urlUpload: z
    .enum(['image', 'video', 'audio', 'image-or-video', 'file'])
    .optional()
})

export type WorkshopInputDefinition = z.infer<
  typeof workshopInputDefinitionSchema
>

export function inputControlMatches(
  input: WorkshopInputDefinition,
  field: GeneratedField
): boolean {
  switch (input.control) {
    case 'text-box':
    case 'text-area':
      return field.kind === 'text' && field.valueType !== 'json'
    case 'dialogue':
      return field.kind === 'text' && field.valueType === 'json'
    case 'dropdown':
      return field.kind === 'select'
    case 'slider':
    case 'number':
      return field.kind === 'number'
    case 'toggle':
      return field.kind === 'toggle'
    case 'media':
      return (
        field.kind === 'file' ||
        (field.kind === 'text' && input.urlUpload !== undefined)
      )
  }
}
