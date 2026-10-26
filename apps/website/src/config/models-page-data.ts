import { z } from 'astro/zod'

import {
  modelSchema,
  routerModelSchema,
  workflowModelSchema,
  readModelsData
} from './models-catalogue-data'
import { formForContract, workshopContractSchema } from './workshop-contract'
import { generatedModelSchema } from './workshop-generated-models'
import {
  formForWorkflow,
  workshopWorkflowDefinitionSchema
} from './workshop-workflow-definition'

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

const workflowPartsSchema = z.object({
  runsOn: z.array(z.object({ name: z.string(), href: z.string().optional() })),
  files: z.array(
    z.object({
      name: z.string(),
      directory: z.string().optional(),
      folder: z.string().optional(),
      href: z.string().optional(),
      downloadUrl: z.string().url().optional()
    })
  )
})

const workflowDetailSchema = generatedModelSchema
  .extend(workflowModelSchema.shape)
  .extend({
    workflow: workshopWorkflowDefinitionSchema,
    parts: workflowPartsSchema.optional()
  })
  .refine((model) => model.workflowId === model.workflow.id)
  .transform((model) => ({
    ...model,
    form: formForWorkflow(model.workflow)
  }))

const detailSchema = z.union([routerDetailSchema, workflowDetailSchema])

const tagSchema = z.object({ label: z.string(), search: z.string() })

const providerModelSchema = z.object({
  slug: z.string(),
  name: z.string(),
  href: z.string(),
  provider: z.string(),
  price: z.string().optional(),
  resolution: z.string().optional(),
  duration: z.object({ min: z.number().optional(), max: z.number() }).optional()
})

export type ProviderModelRow = z.output<typeof providerModelSchema>

const modelsPageDataSchema = z.object({
  kind: z.literal('page'),
  model: detailSchema,
  providerModels: z.array(providerModelSchema),
  successor: modelSchema.optional(),
  priceEstimate: z.string().optional(),
  useCaseLabel: z.string().optional(),
  workflows: z.array(workflowModelSchema),
  tags: z.array(tagSchema),
  shownTags: z.array(tagSchema),
  restTags: z.array(tagSchema),
  restTagCount: z.number()
})

export type ModelsPageData = z.output<typeof modelsPageDataSchema>

export async function fetchModelsPage(slug: string): Promise<ModelsPageData> {
  // Hub pages read their data from /models; redirects.test.ts keeps it unredirected.
  const data = await readModelsData(
    `/models/${slug.split('/').map(encodeURIComponent).join('/')}/page.json`
  )
  return modelsPageDataSchema.parse(data)
}
