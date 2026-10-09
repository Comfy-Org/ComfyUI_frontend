import { z } from 'astro/zod'

import type { WorkshopDisplayEntry } from '@/content/workshop-display.schema'
import categories from '@/content/workshop-workflow-categories.json'
import type {
  Modality,
  WorkflowWorkshopModel,
  WorkflowWorkshopModelDetail
} from './models-catalogue'
import { isWorkshopModelDisabled } from './workshop-model-availability'
import type { WorkshopWorkflowEntry } from './workshop-workflow-catalog'
import { formForWorkflow } from './workshop-workflow-definition'
import { hubWorkflowHref } from './hub-models'

const exampleValuesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.array(z.string())])
)

function categoryFor(page: WorkshopDisplayEntry) {
  const order = categories.findIndex(
    (category) => category.id === page.category
  )
  if (order < 0) return undefined
  const category = categories[order]
  return {
    categoryLabel: category.label,
    categoryOrder: order,
    categoryHighlight: category.highlight === page.modelId,
    ...('aliases' in category && { categoryAliases: category.aliases })
  }
}

const UPLOAD_MEDIA = {
  image: ['image'],
  video: ['video'],
  audio: ['audio'],
  'image-or-video': ['image', 'video'],
  file: []
} as const satisfies Record<string, readonly Modality[]>

/** The media a visitor brings to a workflow; a prompt alone starts from text. */
function inputKindsFor(page: WorkshopDisplayEntry): Modality[] {
  const media = Object.values(page.inputs ?? {}).flatMap((input) =>
    input.control === 'media' && !input.hidden && input.urlUpload
      ? UPLOAD_MEDIA[input.urlUpload]
      : []
  )
  return media.length ? [...new Set(media)] : ['text']
}

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
    cloud: entry.cloud,
    outputs: entry.outputs,
    template: page.template
  }
  const modality = entry.outputs[0]?.kind
  const samples = page.media.samples ?? []
  const model: WorkflowWorkshopModel = {
    type: entry.type,
    workflowId: entry.id,
    slug: page.slug,
    href: hubWorkflowHref(page.slug),
    name: page.displayName,
    summary: page.description,
    category: page.category,
    ...categoryFor(page),
    recommendedRank: page.recommendedRank,
    models: page.template?.models,
    author: page.template?.author,
    workflowCount: samples.length,
    modality,
    inputKinds: inputKindsFor(page),
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
    examples: samples.map((sample, index) => {
      const example = page.examples.at(index)
      const values = exampleValuesSchema.parse(example?.values ?? {})
      return {
        name: `${page.slug}-example-${index + 1}`,
        title: example?.title ?? model.name,
        description: example?.description ?? '',
        thumbnailUrl: sample.url,
        mediaKind: sample.kind,
        tags: [],
        sampleOnly: Object.keys(values).length === 0,
        values
      }
    })
  }
  return { model, detail }
}
