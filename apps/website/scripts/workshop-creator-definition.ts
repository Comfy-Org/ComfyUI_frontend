import { z } from 'astro/zod'

const options = z
  .object({
    fixedValues: z
      .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
      .optional()
  })
  .strict()

export const workshopCreatorDefinitionSchema = z.discriminatedUnion('family', [
  z
    .object({
      family: z.enum([
        'flat',
        'bria-edit',
        'bria-expand',
        'text-input',
        'seedream',
        'dialogue',
        'nested-settings',
        'kling-avatar',
        'kling-lip-sync',
        'meshy-source',
        'qwen-image',
        'veo',
        'gemini-image'
      ]),
      options: options.prefault({})
    })
    .strict(),
  z
    .object({
      family: z.literal('bfl-video'),
      options: options
        .extend({ mode: z.enum(['i2v', 't2v', 'v2v']).optional() })
        .prefault({})
    })
    .strict(),
  z
    .object({
      family: z.literal('gemini-video'),
      options: options
        .extend({
          mode: z.enum(['image_to_video', 'text_to_video', 'edit']).optional()
        })
        .prefault({})
    })
    .strict(),
  z
    .object({
      family: z.literal('luma-image'),
      options: options
        .extend({
          mode: z.literal('edit').optional(),
          agents: z.boolean().optional()
        })
        .prefault({})
    })
    .strict(),
  z
    .object({
      family: z.literal('luma-video'),
      options: options
        .extend({ mode: z.literal('image').optional() })
        .prefault({})
    })
    .strict(),
  z
    .object({
      family: z.literal('seedance'),
      options: options.extend({
        mode: z.enum(['mixed', 'first-last', 'reference', 'text', 'image']),
        urlMedia: z.boolean().optional()
      })
    })
    .strict(),
  z
    .object({
      family: z.literal('runway-image'),
      options: options.extend({ mode: z.enum(['reference', 'first-frame']) })
    })
    .strict(),
  z
    .object({
      family: z.literal('tencent-file'),
      options: options.extend({ field: z.enum(['File', 'File3D']) })
    })
    .strict(),
  z
    .object({
      family: z.literal('wan-media'),
      options: options
        .extend({
          mode: z
            .enum([
              'edit',
              'image',
              'reference',
              'text',
              'image-edit',
              'reference-video'
            ])
            .optional()
        })
        .prefault({})
    })
    .strict(),
  z
    .object({
      family: z.literal('grok-video'),
      options: options
        .extend({ mode: z.enum(['image', 'reference']).optional() })
        .prefault({})
    })
    .strict(),
  z
    .object({
      family: z.literal('ideogram'),
      options: options
        .extend({ mode: z.enum(['text', 'json']).default('text') })
        .prefault({})
    })
    .strict()
])
