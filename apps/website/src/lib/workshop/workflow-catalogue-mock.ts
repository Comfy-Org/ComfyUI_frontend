import { z } from 'zod'

import type { WorkflowWorkshopModel } from '@/config/models-catalogue'
import type { WorkflowCatalogueMockEntry } from './workflow-catalogue-mock-data'
import {
  COLLECTION_KEYWORDS,
  MOCK_TASK_KEYWORDS,
  MOCK_TASKS,
  WORKFLOW_CATALOGUE_MOCK_PATH,
  WORKFLOW_COLLECTIONS,
  workflowCatalogueMockEntrySchema
} from './workflow-catalogue-mock-data'
import type { ModalityTaxonomy } from './workflow-modality-tasks'

export interface WorkflowCatalogueMock {
  readonly models: readonly WorkflowWorkshopModel[]
  readonly taxonomy: ModalityTaxonomy
  /** Whether the search names the workflow's title or a keyword of its task or collections. */
  readonly matches: (model: WorkflowWorkshopModel, query: string) => boolean
}

function searchable(text: string): string {
  return text.toLowerCase().replaceAll('-', ' ').trim()
}

function keywordsOf(entry: WorkflowCatalogueMockEntry): string[] {
  return [
    entry.title,
    ...(MOCK_TASK_KEYWORDS[`${entry.modality}:${entry.task}`] ?? []),
    ...entry.collections.flatMap((key) => COLLECTION_KEYWORDS[key])
  ].map(searchable)
}

function mockWorkflowModel(
  entry: WorkflowCatalogueMockEntry
): WorkflowWorkshopModel {
  return {
    type: 'CLOUD',
    workflowId: entry.name,
    slug: `workflows/${entry.name}`,
    href: entry.href,
    name: entry.title,
    workflowCount: 1,
    capabilities: [],
    modality: entry.modality,
    models: entry.models,
    ...(entry.thumbnail && {
      thumbnail: { url: entry.thumbnail, kind: 'image' as const }
    })
  }
}

function workflowCatalogueMock(
  entries: readonly WorkflowCatalogueMockEntry[]
): WorkflowCatalogueMock {
  const bySlug = new Map(
    entries.map((entry) => [`workflows/${entry.name}`, entry])
  )
  const keywords = new Map(
    entries.map((entry) => [`workflows/${entry.name}`, keywordsOf(entry)])
  )
  return {
    models: entries.map(mockWorkflowModel),
    taxonomy: {
      tasks: (type) => MOCK_TASKS[type],
      taskOf: (model) => bySlug.get(model.slug)?.task,
      collections: WORKFLOW_COLLECTIONS,
      collectionsOf: (model) => bySlug.get(model.slug)?.collections ?? []
    },
    matches: (model, query) => {
      const needle = searchable(query)
      return (
        needle !== '' &&
        !!keywords.get(model.slug)?.some((word) => word.includes(needle))
      )
    }
  }
}

/** Fetches the mock catalogue, or nothing when it is missing or malformed. */
export async function fetchWorkflowCatalogueMock(): Promise<
  WorkflowCatalogueMock | undefined
> {
  const response = await fetch(WORKFLOW_CATALOGUE_MOCK_PATH).catch(
    () => undefined
  )
  if (!response?.ok) return undefined
  const body: unknown = await response.json().catch(() => undefined)
  const parsed = z.array(workflowCatalogueMockEntrySchema).safeParse(body)
  return parsed.success ? workflowCatalogueMock(parsed.data) : undefined
}
