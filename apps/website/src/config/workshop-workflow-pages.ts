import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import type {
  WorkflowWorkshopModel,
  WorkflowWorkshopModelDetail
} from './models-catalogue'
import { isWorkshopModelDisabled } from './workshop-model-availability'
import type { WorkshopWorkflowEntry } from './workshop-workflow-catalog'
import { formForWorkflow } from './workshop-workflow-definition'

export function workflowPagesFor(
  pages: readonly WorkshopDisplayEntry[],
  catalog: readonly WorkshopWorkflowEntry[]
) {
  const definitions = new Map(catalog.map((entry) => [entry.id, entry]))
  return pages.flatMap((page) => {
    const entry = definitions.get(page.modelId)
    if (
      !entry ||
      page.type !== entry.type ||
      page.status === 'unavailable' ||
      isWorkshopModelDisabled(page.slug)
    )
      return []
    return [workflowPageFor(page, entry)]
  })
}

function workflowPageFor(
  page: WorkshopDisplayEntry,
  entry: WorkshopWorkflowEntry
) {
  if (!page.inputs || !page.displayName)
    throw new Error(`Missing workflow page inputs: ${page.slug}`)
  const workflow = {
    id: entry.id,
    definitionVersion: entry.definitionVersion,
    inputSchema: entry.inputSchema,
    inputs: page.inputs,
    template: page.template
  }
  const modality = entry.outputs[0]?.kind
  const model: WorkflowWorkshopModel = {
    type: entry.type,
    workflowId: entry.id,
    slug: page.slug,
    href: `/models/${page.slug}/`,
    name: page.displayName,
    summary: page.description,
    category: page.category,
    workflowCount: page.media.samples?.length ?? 0,
    modality,
    useCases: [page.useCase],
    capabilities: [],
    thumbnail: page.media.thumbnail,
    thumbnailUrl: page.media.thumbnail?.url
  }
  const detail: WorkflowWorkshopModelDetail = {
    ...model,
    workflow,
    form: formForWorkflow(workflow),
    fields: [],
    defaults: {},
    examples: (page.media.samples ?? []).map((sample, index) => ({
      name: `${page.slug}-example-${index + 1}`,
      title: page.examples.at(index)?.title ?? model.name,
      description: page.examples.at(index)?.description ?? '',
      thumbnailUrl: sample.url,
      mediaKind: sample.kind,
      tags: [],
      sampleOnly: true,
      values: {}
    }))
  }
  return { model, detail }
}
