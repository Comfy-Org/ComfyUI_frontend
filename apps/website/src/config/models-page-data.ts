import { z } from 'astro/zod'

import { MODALITIES, USE_CASES } from './models-catalogue'
import { formForContract, workshopContractSchema } from './workshop-contract'
import { generatedModelSchema } from './workshop-generated-models'
import {
  formForWorkflow,
  workshopWorkflowDefinitionSchema
} from './workshop-workflow-definition'

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

const routerModelSchema = presentationSchema.extend({
  type: z.literal('MODEL').optional(),
  routerId: z.string(),
  workflowId: z.never().optional()
})

const workflowModelSchema = presentationSchema.extend({
  type: z.enum(['CLOUD', 'SERVERLESS']),
  workflowId: z.string(),
  routerId: z.never().optional(),
  category: z.string().optional()
})

const modelSchema = z.union([routerModelSchema, workflowModelSchema])

const routerDetailSchema = generatedModelSchema
  .extend(routerModelSchema.shape)
  .extend({
    nodeDisplayName: z.string().optional(),
    execution: workshopContractSchema.optional()
  })
  .transform((model) => ({
    ...model,
    ...(model.execution ? { form: formForContract(model.execution) } : {})
  }))

const workflowDetailSchema = generatedModelSchema
  .extend(workflowModelSchema.shape)
  .extend({ workflow: workshopWorkflowDefinitionSchema })
  .refine((model) => model.workflowId === model.workflow.id)
  .transform((model) => ({
    ...model,
    form: formForWorkflow(model.workflow)
  }))

const detailSchema = z.union([routerDetailSchema, workflowDetailSchema])

const tagSchema = z.object({ label: z.string(), search: z.string() })

const modelsPageDataSchema = z.object({
  kind: z.literal('page'),
  model: detailSchema,
  related: z.array(modelSchema),
  relatedHeading: z.string(),
  relatedHeadingShort: z.string(),
  successor: modelSchema.optional(),
  priceEstimate: z.string().optional(),
  useCaseLabel: z.string().optional(),
  tags: z.array(tagSchema),
  shownTags: z.array(tagSchema),
  restTags: z.array(tagSchema),
  restTagCount: z.number()
})

export type ModelsPageData = z.output<typeof modelsPageDataSchema>

async function readPageData(path: string): Promise<unknown> {
  const response = await fetch(path)
  if (!response.ok)
    throw new Error(`Models data request failed: ${response.status}`)
  return response.json()
}

export async function fetchModelsPage(slug: string): Promise<ModelsPageData> {
  const data = await readPageData(
    `/models/${slug.split('/').map(encodeURIComponent).join('/')}/page.json`
  )
  return modelsPageDataSchema.parse(data)
}

export async function fetchModelsCatalogue() {
  const data = await readPageData('/models/catalogue.json')
  return z.array(modelSchema).parse(data)
}
