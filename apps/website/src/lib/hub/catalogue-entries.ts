import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import { useCasesFor } from '../../config/models-catalogue'
import type { FacetedTemplate } from './facet-fields'
import { partnerModelFor, useCaseForTemplate } from './template-use-case'

export type EntryKind = 'model' | 'workflow' | 'app'

export const modelGroupPath = (key: string) => `/models-v2/model/${key}/`

export const hubWorkflowPath = (name: string) => `/models-v2/workflow/${name}/`

export interface ModelEntry {
  readonly kind: 'model'
  readonly key: string
  readonly model: WorkshopModel
  /**
   * Every catalogue row sharing this model's name. The registry lists a model
   * once per operation, so a name can carry several; they are a choice inside
   * the model page rather than rival cards in the grid.
   */
  readonly operations: readonly WorkshopModel[]
  /** Workflows naming this model, whether or not they browse on their own. */
  readonly workflows: readonly FacetedTemplate[]
}

interface WorkflowEntry {
  readonly kind: 'workflow' | 'app'
  readonly key: string
  readonly template: FacetedTemplate
  /** The single model page this workflow can safely open, when there is one. */
  readonly runsOn: WorkshopModel | undefined
}

export type CatalogueEntry = ModelEntry | WorkflowEntry

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

function groupByName(
  models: readonly WorkshopModel[]
): Map<string, WorkshopModel[]> {
  const groups = new Map<string, WorkshopModel[]>()
  for (const model of models) {
    const key = normalize(model.name)
    groups.set(key, [...(groups.get(key) ?? []), model])
  }
  return groups
}

const namesInCatalogue = (
  template: FacetedTemplate,
  known: ReadonlySet<string>
) =>
  [...new Set(template.models.map(normalize))].filter((key) => known.has(key))

export const catalogueNameKeys = (models: readonly WorkshopModel[]) =>
  new Set(models.map((model) => normalize(model.name)))

/**
 * A workflow titled after a model it runs is that model's own operation, not a
 * competitor to it: "Seedance 2.5: Image to Video" beside "Seedance 2.5" reads
 * as two products with one name. It browses on the model's page instead.
 */
export function ownerOf(
  template: FacetedTemplate,
  known: ReadonlySet<string>
): string | undefined {
  const title = normalize(template.title)
  return namesInCatalogue(template, known).find((key) => title.startsWith(key))
}

export function buildCatalogue(
  templates: readonly FacetedTemplate[],
  models: readonly WorkshopModel[]
): readonly CatalogueEntry[] {
  const groups = groupByName(models)
  const known = new Set(groups.keys())
  const naming = new Map<string, FacetedTemplate[]>()
  const standalone: FacetedTemplate[] = []
  for (const template of templates) {
    for (const key of namesInCatalogue(template, known))
      naming.set(key, [...(naming.get(key) ?? []), template])
    if (!ownerOf(template, known)) standalone.push(template)
  }
  const modelEntries = [...groups].map(
    ([key, operations]): ModelEntry => ({
      kind: 'model',
      key,
      model: operations[0],
      operations,
      workflows: naming.get(key) ?? []
    })
  )
  const workflowEntries = standalone.map(
    (template): WorkflowEntry => ({
      kind: template.isApp ? 'app' : 'workflow',
      key: template.name,
      template,
      runsOn: partnerModelFor(template, models)
    })
  )
  return [...modelEntries, ...workflowEntries]
}

export function entryTitle(entry: CatalogueEntry): string {
  return entry.kind === 'model' ? entry.model.name : entry.template.title
}

/**
 * A model answers to every use case its operations cover, which is the point of
 * collapsing them: one card that appears under both "generate images" and
 * "edit images" rather than two cards competing under one name.
 */
export function entryUseCases(
  entry: CatalogueEntry,
  models: readonly WorkshopModel[]
): readonly UseCase[] {
  if (entry.kind === 'model')
    return [...new Set(entry.operations.flatMap(useCasesFor))]
  const useCase = useCaseForTemplate(entry.template, models)
  return useCase ? [useCase] : []
}
