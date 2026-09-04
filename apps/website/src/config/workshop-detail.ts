import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { WorkshopCatalogField } from './workshop-fields'
import { deriveWorkshopFields } from './workshop-fields'

/**
 * Which backend actually runs a model, and therefore what the API snippets
 * on its page should say. Router is the only one today; Cloud workflows and
 * deployed endpoints are the reason this is a field rather than an
 * assumption. See ./workshop-run-target for the implementations.
 */
export type WorkshopRunTargetId = 'router'

/**
 * The form field union lives with the code that derives it. Re-exported under
 * the page-facing name so a component imports one module, not two.
 *
 * Deliberately a presentation shape rather than a Router shape: a Router
 * input schema maps onto it today, and a workflow's inputs can map onto the
 * same controls without the page learning where the model came from.
 */
export type WorkshopField = WorkshopCatalogField

export interface WorkshopDetailModel {
  readonly id: string
  readonly slug: string
  readonly displayName: string
  readonly provider: string
  readonly modality: string
  readonly description: string
  readonly tags: readonly string[]
  readonly fields: readonly WorkshopField[]
  /** Absent in the current snapshot, where every model is a Router model. */
  readonly runTarget?: WorkshopRunTargetId
}

export type WorkshopFormValue =
  | string
  | number
  | boolean
  | readonly string[]
  | undefined
export type WorkshopFormValues = Readonly<Record<string, WorkshopFormValue>>

/**
 * The page's view of a model. `fields` is derived here rather than stored,
 * so the catalog holds only what the Router client gives us and the form
 * policy stays in code.
 */
export function toDetailModel(entry: WorkshopModelEntry): WorkshopDetailModel {
  return {
    id: entry.id,
    slug: entry.slug,
    displayName: entry.displayName,
    provider: entry.provider,
    modality: entry.modality,
    description: entry.description,
    tags: entry.tags,
    fields: deriveWorkshopFields(entry.parameters, entry.roles)
  }
}

export function defaultWorkshopValues(
  fields: readonly WorkshopField[]
): WorkshopFormValues {
  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      'defaultValue' in field ? field.defaultValue : undefined
    ])
  )
}

export function relatedWorkshopModels(
  model: WorkshopDetailModel,
  pool: readonly WorkshopDetailModel[],
  limit = 4
): WorkshopDetailModel[] {
  return pool
    .filter((candidate) => candidate.slug !== model.slug)
    .sort((left, right) => {
      const leftScore =
        Number(left.provider === model.provider) * 2 +
        Number(left.modality === model.modality)
      const rightScore =
        Number(right.provider === model.provider) * 2 +
        Number(right.modality === model.modality)
      return (
        rightScore - leftScore ||
        left.displayName.localeCompare(right.displayName)
      )
    })
    .slice(0, limit)
}
