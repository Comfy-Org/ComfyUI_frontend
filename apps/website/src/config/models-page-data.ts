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
  successor: modelSchema.optional(),
  priceEstimate: z.string().optional(),
  useCaseLabel: z.string().optional(),
  tags: z.array(tagSchema),
  shownTags: z.array(tagSchema),
  restTags: z.array(tagSchema),
  restTagCount: z.number()
})

export type ModelsPageData = z.output<typeof modelsPageDataSchema>

export async function fetchModelsPage(slug: string): Promise<ModelsPageData> {
  const data = await readModelsData(
    `/models/${slug.split('/').map(encodeURIComponent).join('/')}/page.json`
  )
  return modelsPageDataSchema.parse(data)
}
