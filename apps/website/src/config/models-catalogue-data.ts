import { z } from 'astro/zod'

import { MODALITIES, USE_CASES } from './models-catalogue'

const presentationSchema = z.object({
  slug: z.string(),
  name: z.string(),
  workflowCount: z.number(),
  recommendedRank: z.number().optional(),
  href: z.string(),
  incompleteReason: z.literal('missing-input-schema').optional(),
  provider: z.string().optional(),
  modality: z.enum(MODALITIES).optional(),
  modalities: z.array(z.enum(MODALITIES)).optional(),
  task: z
    .templateLiteral([
      z.enum(['text', 'image', 'video', 'audio']),
      '-to-',
      z.enum([...MODALITIES, 'other'])
    ])
    .optional(),
  capabilities: z.array(z.string()),
  creditsPerRun: z.number().optional(),
  priceUsdFrom: z.number().optional(),
  thumbnailUrl: z.string().optional(),
  thumbnailLabel: z.string().optional(),
  thumbnail: z
    .object({
      url: z.string(),
      kind: z.enum(['image', 'video', 'audio'])
    })
    .optional(),
  useCases: z.array(z.enum(USE_CASES)).optional(),
  summary: z.string().optional(),
  status: z.enum(['deprecated', 'degraded']).optional(),
  successorSlug: z.string().optional()
})

export const routerModelSchema = presentationSchema.extend({
  type: z.literal('MODEL').optional(),
  routerId: z.string(),
  workflowId: z.never().optional()
})

export const workflowModelSchema = presentationSchema.extend({
  type: z.enum(['CLOUD', 'SERVERLESS']),
  workflowId: z.string(),
  routerId: z.never().optional(),
  category: z.string().optional(),
  categoryLabel: z.object({ en: z.string(), 'zh-CN': z.string() }).optional(),
  categoryOrder: z.number().optional(),
  categoryHighlight: z.boolean().optional(),
  models: z.array(z.string()).optional(),
  author: z.string().optional()
})

export const modelSchema = z.union([routerModelSchema, workflowModelSchema])

export async function readModelsData(path: string): Promise<unknown> {
  const response = await fetch(path)
  if (!response.ok)
    throw new Error(`Models data request failed: ${response.status}`)
  return response.json()
}

export async function fetchModelsCatalogue() {
  const data = await readModelsData('/models/catalogue.json')
  return z.array(modelSchema).parse(data)
}
