import { readFileSync } from 'node:fs'
import { URL } from 'node:url'

import type { WorkflowWorkshopModelDetail } from '../src/config/models-catalogue'
import { workshopDisplayEntriesSchema } from '../src/content/workshop-display.schema'
import { parseWorkflowCatalog } from '../src/config/workshop-workflow-catalog-schema'
import { workflowPagesFor } from '../src/config/workshop-workflow-pages'
import { initialWorkshopPageState } from '../src/config/workshop-page-state'
import type { FormValues } from '../src/config/workshop-playground'
import { WorkshopWorkflowError } from '../src/config/workshop-workflow-api'
import type { WorkflowRenderOptions } from '../src/config/workflow-render'
import { renderWorkflow as render } from '../src/config/workflow-render'

let definitions: ReadonlyMap<string, WorkflowWorkshopModelDetail> | undefined

function lookupWorkflow(slug: string) {
  if (!definitions) {
    const pages: unknown = JSON.parse(
      readFileSync(
        new URL('../src/content/workshop-display.json', import.meta.url),
        'utf8'
      )
    )
    const catalog = parseWorkflowCatalog(
      readFileSync(
        new URL('../src/content/workshop-workflows.jsonl', import.meta.url),
        'utf8'
      )
    )
    definitions = new Map(
      workflowPagesFor(workshopDisplayEntriesSchema.parse(pages), catalog).map(
        ({ detail }) => [detail.slug, detail]
      )
    )
  }
  return definitions.get(slug)
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
