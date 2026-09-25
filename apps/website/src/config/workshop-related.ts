import type { WorkshopModel } from './models-catalogue'
import { workshopExecutionId } from './models-catalogue'

// Most visitors land on a model page from search or from the home page, so the
// rest of the catalog is surfaced there. The same provider comes first: that is
// where the other versions of what they are looking at live. A provider with
// fewer models than the row holds is topped up with the nearest category, so
// the row never comes up short.
export function relatedModels(
  model: WorkshopModel,
  list: readonly WorkshopModel[],
  limit = 4
): WorkshopModel[] {
  const sameProvider = (other: WorkshopModel) =>
    model.provider !== undefined && other.provider === model.provider
  const sharedCapabilities = (other: WorkshopModel) =>
    other.capabilities.filter((capability) =>
      model.capabilities.includes(capability)
    ).length
  const id = workshopExecutionId(model)
  const seen = new Set([id])
  return list
    .filter(
      (other) => other.slug !== model.slug && workshopExecutionId(other) !== id
    )
    .sort(
      (a, b) =>
        Number(sameProvider(b)) - Number(sameProvider(a)) ||
        sharedCapabilities(b) - sharedCapabilities(a) ||
        Number(b.modality === model.modality) -
          Number(a.modality === model.modality) ||
        b.workflowCount - a.workflowCount
    )
    .filter((other) => {
      const otherId = workshopExecutionId(other)
      if (seen.has(otherId)) return false
      seen.add(otherId)
      return true
    })
    .slice(0, limit)
}
