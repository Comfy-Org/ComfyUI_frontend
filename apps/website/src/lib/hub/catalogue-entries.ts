import type { UseCase, WorkshopModel } from '../../config/models-catalogue'
import { useCasesFor } from '../../config/models-catalogue'
import type { FacetedTemplate } from './facet-fields'
import { groupByModel, groupName } from './model-identity'
import { partnerModelFor, useCaseForTemplate } from './template-use-case'

export type EntryKind = 'model' | 'workflow'

export const modelGroupPath = (key: string) => `/hub/model/${key}/`

export const hubWorkflowPath = (name: string) => `/hub/workflow/${name}/`

export interface ModelEntry {
  readonly kind: 'model'
  readonly key: string
  readonly model: WorkshopModel
  /** What the operations agree the model is called, without the operation. */
  readonly name: string
  /**
   * Every catalogue row for this model. The registry lists a model once per
   * operation, so one can carry several; they are a choice inside the model
   * page rather than rival cards in the grid.
   */
  readonly operations: readonly WorkshopModel[]
  /** Workflows naming this model, whether or not they browse on their own. */
  readonly workflows: readonly FacetedTemplate[]
}

interface WorkflowEntry {
  readonly kind: 'workflow'
  readonly key: string
  readonly template: FacetedTemplate
  /** The single model page this workflow can safely open, when there is one. */
  readonly runsOn: WorkshopModel | undefined
}

export type CatalogueEntry = ModelEntry | WorkflowEntry

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

/**
 * A workflow names a model in whatever words the registry used at the time, so
 * both the model's own name and each of its operations' point at the one group.
 */
export function catalogueNameIndex(
  models: readonly WorkshopModel[]
): ReadonlyMap<string, string> {
  const index = new Map<string, string>()
  for (const [key, operations] of groupByModel(models)) {
    for (const operation of operations)
      index.set(normalize(operation.name), key)
    index.set(normalize(groupName(operations)), key)
  }
  return index
}

const keysInCatalogue = (
  template: FacetedTemplate,
  known: ReadonlyMap<string, string>
) => [
  ...new Set(
    template.models
      .map((name) => known.get(normalize(name)))
      .filter((key): key is string => key !== undefined)
  )
]

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

/**
 * The model a workflow is named after, where it is named after one at all:
 * "Seedance 2.5: Image to Video" is Seedance 2.5's own operation rather than
 * somebody's graph that happens to call it. The model page reads this to tell
 * the two apart.
 *
 * The title has to open with the whole name and stop at a word, and where a
 * longer name also matches it wins: "Flux Pro: Generate" belongs to Flux Pro,
 * not to Flux, and "Fluxion Portrait" belongs to neither.
 */
export function ownerOf(
  template: FacetedTemplate,
  known: ReadonlyMap<string, string>
): string | undefined {
  return [...new Set(template.models.map(normalize))]
    .filter((name) => known.has(name) && titleOpensWith(template.title, name))
    .sort((a, b) => b.length - a.length)
    .map((name) => known.get(name))[0]
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
  const groups = groupByModel(models)
  const known = catalogueNameIndex(models)
  const naming = new Map<string, FacetedTemplate[]>()
  for (const template of templates)
    for (const key of keysInCatalogue(template, known))
      naming.set(key, [...(naming.get(key) ?? []), template])
  const modelEntries = [...groups].map(
    ([key, operations]): ModelEntry => ({
      kind: 'model',
      key,
      model: operations[0],
      name: groupName(operations),
      operations,
      workflows: naming.get(key) ?? []
    })
  )
  // Every workflow browses on the workflows tab. A model card and a workflow
  // card are never in the same list, so a workflow named after the model it
  // runs cannot read as a second product with that name.
  const workflowEntries = templates.map(
    (template): WorkflowEntry => ({
      kind: 'workflow',
      key: template.name,
      template,
      runsOn: partnerModelFor(template, models)
    })
  )
  return [...modelEntries, ...workflowEntries]
}

export function entryTitle(entry: CatalogueEntry): string {
  return entry.kind === 'model' ? entry.name : entry.template.title
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
