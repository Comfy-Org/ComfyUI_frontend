import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import { useCasesFor } from '../../config/models-catalogue'
import type { FacetedTemplate } from './facet-fields'
import { partnerModelFor, useCaseForTemplate } from './template-use-case'

export type EntryKind = 'model' | 'workflow' | 'app'

export const modelGroupPath = (key: string) => `/playground/model/${key}/`

export const hubWorkflowPath = (name: string) => `/playground/workflow/${name}/`

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

export const modelGroupKey = normalize

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

const isWordCharacter = (character: string) => /[a-z0-9]/i.test(character)

/**
 * How many of the title's own characters the name eats, or -1 when the title
 * does not open with it. The comparison ignores spacing and punctuation, so
 * "Seedance2.5" still finds "Seedance 2.5", but the count is kept in the
 * title's characters so the caller can insist the match ends at a word.
 */
function consumed(title: string, key: string): number {
  let taken = 0
  for (let index = 0; index < title.length; index += 1) {
    const character = title.charAt(index)
    if (!isWordCharacter(character)) continue
    if (character.toLowerCase() !== key[taken]) return -1
    taken += 1
    if (taken === key.length) return index + 1
  }
  return -1
}

const titleOpensWith = (title: string, key: string) => {
  const end = consumed(title, key)
  return end >= 0 && !isWordCharacter(title.charAt(end))
}

export const catalogueNameKeys = (models: readonly WorkshopModel[]) =>
  new Set(models.map((model) => normalize(model.name)))

/**
 * A workflow titled after a model it runs is that model's own operation, not a
 * competitor to it: "Seedance 2.5: Image to Video" beside "Seedance 2.5" reads
 * as two products with one name. It browses on the model's page instead.
 *
 * The title has to open with the whole name and stop at a word, and where a
 * longer name also matches it wins: "Flux Pro: Generate" belongs to Flux Pro,
 * not to Flux, and "Fluxion Portrait" belongs to neither.
 */
export function ownerOf(
  template: FacetedTemplate,
  known: ReadonlySet<string>
): string | undefined {
  return namesInCatalogue(template, known)
    .filter((key) => titleOpensWith(template.title, key))
    .sort((a, b) => b.length - a.length)[0]
}

/**
 * One card stands for every operation under a name, so the price it carries is
 * the cheapest way in. Choosing between operations happens on the model page,
 * where each one shows its own.
 */
export function cheapestOperation(entry: ModelEntry): WorkshopModel {
  return [...entry.operations].sort(
    (a, b) =>
      (a.creditsPerRun ?? Number.POSITIVE_INFINITY) -
      (b.creditsPerRun ?? Number.POSITIVE_INFINITY)
  )[0]
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
