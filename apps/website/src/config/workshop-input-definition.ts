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
  imageSource: z.literal('url').optional(),
  urlUpload: z
    .enum(['image', 'video', 'audio', 'image-or-video', 'file'])
    .optional()
})

export type WorkshopInputDefinition = z.infer<
  typeof workshopInputDefinitionSchema
>
