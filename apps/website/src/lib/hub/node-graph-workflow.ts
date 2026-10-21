import type { WorkflowWorkshopModelDetail } from '@/config/models-catalogue'
import type { WorkflowCatalogDetails } from '@/config/workflow-catalog-details'
import type { PlaygroundExample } from '@/config/workshop-playground'
import {
  examplesForModel,
  isAudioUrl,
  isVideoUrl
} from '@/config/workshop-playground'

/** What the node graph layout shows for a workflow that cannot run on its page. */
export interface NodeGraphWorkflow {
  readonly name: string
  readonly description: readonly string[]
  readonly graphSource?: string
  readonly downloadUrl?: string
  /** Absent when the workflow cannot open in Comfy Cloud. */
  readonly cloudHref?: string
  readonly models: readonly string[]
  readonly output?: WorkflowCatalogDetails['outputType']
  readonly author?: string
  readonly examples: readonly PlaygroundExample[]
}

/** What a sample output is: its declared kind, or else what its URL ends in. */
export function sampleMedia(
  example: PlaygroundExample
): 'image' | 'video' | 'audio' {
  if (example.mediaKind) return example.mediaKind
  if (isVideoUrl(example.outputUrl)) return 'video'
  if (isAudioUrl(example.outputUrl)) return 'audio'
  return 'image'
}

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/** A catalog workflow as the node graph layout shows it. */
export function nodeGraphWorkflowFromModel(
  model: WorkflowWorkshopModelDetail,
  links: { readonly downloadUrl?: string; readonly cloudHref?: string }
): NodeGraphWorkflow {
  const details = model.catalogDetails
  const catalogModels = details?.models.map(({ name }) => name) ?? []
  return {
    name: model.name,
    description: paragraphs(details?.longDescription ?? model.summary ?? ''),
    graphSource: links.downloadUrl,
    downloadUrl: links.downloadUrl,
    cloudHref: links.cloudHref,
    models: catalogModels.length ? catalogModels : (model.models ?? []),
    output: details?.outputType,
    author: details?.author ?? model.author,
    examples: examplesForModel(model)
  }
}
