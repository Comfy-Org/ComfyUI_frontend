import type { WorkshopModel } from './workshop'

// Most visitors land on a model page from search, so the rest of the catalog
// is surfaced there: same modality first, then the most used models.
export function relatedModels(
  model: WorkshopModel,
  list: readonly WorkshopModel[],
  limit = 4
): WorkshopModel[] {
  return list
    .filter((other) => other.slug !== model.slug)
    .sort(
      (a, b) =>
        Number(b.modality === model.modality) -
          Number(a.modality === model.modality) ||
        b.workflowCount - a.workflowCount
    )
    .slice(0, limit)
}
