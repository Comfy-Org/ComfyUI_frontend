import type { WorkshopModel } from '../../config/models-catalogue'
import { workshopModels } from '../../config/workshop-browse-content'
import hubTemplates from '../../data/hubTemplates.json'
import type { ModelEntry } from './catalogue-entries'
import { buildCatalogue, catalogueNameKeys, ownerOf } from './catalogue-entries'
import type { FacetedTemplate } from './facet-fields'
import { withFacetFields } from './facet-fields'
import { hubTemplatesSchema } from './types'

export interface ModelGroupPage {
  readonly key: string
  readonly name: string
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

const known = catalogueNameKeys(workshopModels)

const entries = buildCatalogue(templates, workshopModels).filter(
  (entry): entry is ModelEntry => entry.kind === 'model'
)

export function listModelGroups(): readonly ModelEntry[] {
  return entries
}

export function getModelGroupPage(key: string): ModelGroupPage | undefined {
  const entry = entries.find((candidate) => candidate.key === key)
  if (!entry) return undefined
  const owned = entry.workflows.filter(
    (template) => ownerOf(template, known) === key
  )
  const ownedNames = new Set(owned.map((template) => template.name))
  return {
    key: entry.key,
    name: entry.model.name,
    provider: entry.model.provider,
    operations: entry.operations,
    uses: entry.workflows.filter((template) => !ownedNames.has(template.name)),
    operationsFromWorkflows: owned
  }
}
