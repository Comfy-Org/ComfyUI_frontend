import type { WorkshopModel } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import hubTemplates from '../../data/hubTemplates.json'
import type { ModelEntry } from './catalogue-entries'
import {
  buildCatalogue,
  catalogueNameIndex,
  ownerOf
} from './catalogue-entries'
import type { FacetedTemplate } from './facet-fields'
import { displayModelName } from './model-identity'
import { withFacetFields } from './facet-fields'
import { hubTemplatesSchema } from './types'

export interface ModelGroupPage {
  readonly key: string
  readonly name: string
  /**
   * What the heading says. The catalogue still matches on `name`, which is how
   * the registry wrote it, so a link narrowing to this model keeps working.
   */
  readonly displayName: string
  readonly provider: string | undefined
  /** The registry's rows for this name, one per operation. */
  readonly operations: readonly WorkshopModel[]
  /** Workflows the catalogue shows on their own, which happen to name it. */
  readonly uses: readonly FacetedTemplate[]
  /** Workflows titled after it, which browse here rather than in the grid. */
  readonly operationsFromWorkflows: readonly FacetedTemplate[]
}

const templates = hubTemplatesSchema
  .parse(hubTemplates)
  .map((template) => withFacetFields(template, workshopModels))

const known = catalogueNameIndex(workshopModels)

const entries = buildCatalogue(templates, workshopModels).filter(
  (entry): entry is ModelEntry => entry.kind === 'model'
)

export function listModelGroups(): readonly ModelEntry[] {
  return entries
}

/**
 * The two ways a workflow can sit on a model page: titled after the model, so
 * it reads as one more thing the model does, or merely naming it, so it reads
 * as somebody's use of it. Both name the model; only the first speaks for it.
 */
export function modelGroupFrom(
  entry: ModelEntry,
  known: ReadonlyMap<string, string>
): ModelGroupPage {
  const owned = entry.workflows.filter(
    (template) => ownerOf(template, known) === entry.key
  )
  const ownedNames = new Set(owned.map((template) => template.name))
  return {
    key: entry.key,
    name: entry.name,
    displayName: displayModelName(entry.model, entry.operations),
    provider: entry.model.provider,
    operations: entry.operations,
    uses: entry.workflows.filter((template) => !ownedNames.has(template.name)),
    operationsFromWorkflows: owned
  }
}

export function getModelGroupPage(key: string): ModelGroupPage | undefined {
  const entry = entries.find((candidate) => candidate.key === key)
  return entry ? modelGroupFrom(entry, known) : undefined
}
