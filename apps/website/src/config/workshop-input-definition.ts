import { z } from 'astro/zod'

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
  videoWidthPixels: z
    .object({
      minimum: z.number().int().positive(),
      maximum: z.number().int().positive()
    })
    .refine(({ minimum, maximum }) => minimum <= maximum)
    .optional(),
  imageAspectRatio: z
    .object({
      minimum: z.number().positive(),
      maximum: z.number().positive()
    })
    .refine(({ minimum, maximum }) => minimum <= maximum)
    .optional(),
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
