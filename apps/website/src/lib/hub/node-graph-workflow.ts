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
  /** The pre-rendered graph, for when the graph file cannot be read. */
  readonly graphFallback?: string
  /** The workflow's versions, when it offers more than one file. */
  readonly files?: readonly { readonly name: string; readonly href: string }[]
  readonly downloadUrl?: string
  readonly downloadName?: string | boolean
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
  links: {
    readonly downloadUrl?: string
    readonly downloadName?: string | boolean
    readonly cloudHref?: string
  }
): NodeGraphWorkflow {
  const details = model.catalogDetails
  const files = details?.workflowFiles
  const catalogModels = names(details?.models.map(({ name }) => name))
  const longDescription = paragraphs(details?.longDescription ?? '')
  return {
    name: model.name,
    description: longDescription.length
      ? longDescription
      : paragraphs(model.summary ?? ''),
    graphSource: links.downloadUrl,
    graphFallback: files ? undefined : model.workflow.template?.previewUrl,
    files: files?.map(({ name, href }) => ({ name, href })),
    downloadUrl: links.downloadUrl,
    downloadName: links.downloadName,
    cloudHref: links.cloudHref,
    models: catalogModels.length ? catalogModels : names(model.models),
    output: details?.outputType,
    author: details?.author?.trim() || model.author?.trim() || undefined,
    examples: examplesForModel(model)
  }
}

function names(values: readonly string[] | undefined): string[] {
  return (values ?? []).map((value) => value.trim()).filter(Boolean)
}
