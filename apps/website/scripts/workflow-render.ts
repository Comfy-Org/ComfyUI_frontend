import { join } from 'node:path'
import { readFileSync } from 'node:fs'

import { websiteRoot } from '@website/paths'
import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import { workshopDisplayEntriesSchema } from '@/content/workshop-display.schema'
import { parseWorkflowCatalog } from '@/config/workshop-workflow-catalog-schema'
import { workflowPagesFor } from '@/config/workshop-workflow-pages'
import { initialWorkshopPageState } from '@/config/workshop-page-state'
import type { FormValues } from '@/config/workshop-playground'
import { WorkshopWorkflowError } from '@/config/workshop-workflow-api'
import type { WorkflowRenderOptions } from '@/config/workflow-render'
import { renderWorkflow as render } from '@/config/workflow-render'

let definitions: ReadonlyMap<string, WorkflowWorkshopModelDetail> | undefined

function loadDefinitions() {
  if (!definitions) {
    const pages: unknown = JSON.parse(
      readFileSync(
        join(websiteRoot, 'src/content/workshop-display.json'),
        'utf8'
      )
    )
    const catalog = parseWorkflowCatalog(
      readFileSync(
        join(websiteRoot, 'src/content/workshop-workflows.jsonl'),
        'utf8'
      )
    )
    definitions = new Map(
      workflowPagesFor(workshopDisplayEntriesSchema.parse(pages), catalog).map(
        ({ detail }) => [detail.slug, detail]
      )
    )
  }
  return definitions
}

export function publishedWorkflows(): WorkflowWorkshopModelDetail[] {
  return [...loadDefinitions().values()]
}

function lookupWorkflow(slug: string) {
  return loadDefinitions().get(slug)
}

function modelFor(slug: string) {
  const model = lookupWorkflow(slug)
  if (!model) throw new WorkshopWorkflowError('workflow_not_found')
  return model
}

export function workflow_for_model(slug: string) {
  return initialWorkshopPageState(modelFor(slug)).values
}

export function workflow_render(
  slug: string,
  inputs: FormValues = {},
  options: Omit<WorkflowRenderOptions, 'model' | 'token'> &
    Partial<Pick<WorkflowRenderOptions, 'token'>> = {}
) {
  return render(slug, inputs, {
    ...options,
    model: modelFor(slug),
    authentication: options.authentication ?? 'api-key',
    token: options.token ?? process.env.COMFY_API_KEY ?? ''
  })
}
