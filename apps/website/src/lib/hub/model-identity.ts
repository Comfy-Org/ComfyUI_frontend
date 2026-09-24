import type { WorkshopModel } from '../../config/models-catalogue'

/**
 * A registry slug is provider, model, operation, so the first two segments are
 * the model itself. The display name is not: it carries the operation too, and
 * it gets rewritten, so grouping on it splits a model in two the day someone
 * renames "Nano Banana Pro" to "Nano Banana Pro Text-to-Image".
 */
export const modelIdentity = (slug: string) =>
  slug.split('--').slice(0, 2).join('--')

export function groupByModel(
  models: readonly WorkshopModel[]
): Map<string, WorkshopModel[]> {
  const groups = new Map<string, WorkshopModel[]>()
  for (const model of models) {
    const key = modelIdentity(model.slug)
    groups.set(key, [...(groups.get(key) ?? []), model])
  }
  return groups
}

/**
 * What the operations' names have in common is the model; what they disagree
 * on is the operation. One operation agrees with nothing, so its whole name
 * stands: "FLUX Tools Erase" is the product, not a model plus a verb.
 */
export function groupName(operations: readonly WorkshopModel[]): string {
  const [first, ...rest] = operations.map((model) => model.name.split(' '))
  const differs = first.findIndex((word, index) =>
    rest.some((words) => words[index] !== word)
  )
  const shared = differs < 0 ? first : first.slice(0, differs)
  return (shared.length > 0 ? shared : first).join(' ')
}

/** The model's name without the operation, given the catalogue it sits in. */
export function modelName(
  model: WorkshopModel,
  models: readonly WorkshopModel[]
): string {
  return groupName(
    models.filter(
      (candidate) => modelIdentity(candidate.slug) === modelIdentity(model.slug)
    )
  )
}

/**
 * How the registry writes an operation at the end of a name: a crossing
 * (`Text-to-Image`, `Reference-to-Video`) or a medium and a verb (`Image
 * Edit`). Twelve makers end a name in `Text-to-Image` and nine in `Image
 * Edit`, which is the registry's vocabulary rather than any one product's
 * name; `FLUX Tools Erase` fits neither and keeps its word.
 */
const OPERATION_TAIL =
  /\s+(?:\S+-to-\S+|(?:image|video|audio|text|3d)\s+edit)$/i

/**
 * The name to show. Grouping decides what a model *is*, and it leaves a lone
 * operation's name whole, so `HappyHorse Reference-to-Video` keeps a verb the
 * card has already said. Only what is shown loses it: what the catalogue
 * matches on stays as the registry wrote it.
 */
export function displayModelName(
  model: WorkshopModel,
  models: readonly WorkshopModel[]
): string {
  const grouped = modelName(model, models)
  return grouped.replace(OPERATION_TAIL, '') || grouped
}
