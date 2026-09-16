import type { WorkshopModel } from './models-catalogue'

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
  const seen = new Set([model.routerId])
  return list
    .filter(
      (other) => other.slug !== model.slug && other.routerId !== model.routerId
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
      if (seen.has(other.routerId)) return false
      seen.add(other.routerId)
      return true
    })
    .slice(0, limit)
}
