import { z } from 'astro/zod'
import { workflowCatalogDetailsSchema } from './workflow-catalog-details'

import {
  modelSchema,
  routerModelSchema,
  localModelSchema,
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
  .extend({
    workflow: workshopWorkflowDefinitionSchema,
    catalogDetails: workflowCatalogDetailsSchema.optional()
  })
  .refine((model) => model.workflowId === model.workflow.id)
  .transform((model, ctx) => {
    try {
      return { ...model, form: formForWorkflow(model.workflow) }
    } catch (error) {
      ctx.addIssue({ code: 'custom', message: String(error) })
      return z.NEVER
    }
  })

const localDetailSchema = generatedModelSchema
  .extend(localModelSchema.shape)
  .extend({ catalogDetails: workflowCatalogDetailsSchema.optional() })

export const detailSchema = z.union([
  routerDetailSchema,
  workflowDetailSchema,
  localDetailSchema
])

const tagSchema = z.object({ label: z.string(), search: z.string() })

export const modelsPageDataSchema = z.object({
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
  restTagCount: z.number(),
  catalogUID: z.uuid().optional(),
  canEdit: z.boolean().optional()
})

export type ModelsPageData = z.output<typeof modelsPageDataSchema>

export async function fetchModelsPage(slug: string): Promise<ModelsPageData> {
  // Hub pages read their data from /models; redirects.test.ts keeps it unredirected.
  const data = await readModelsData(
    `/models/${slug.split('/').map(encodeURIComponent).join('/')}/page.json`
  )
  return modelsPageDataSchema.parse(data)
}
