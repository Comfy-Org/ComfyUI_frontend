import type { WorkshopModel } from './models-catalogue'
import { workshopExecutionId } from './models-catalogue'

const collator = new Intl.Collator('en')

function byCatalogueOrder(a: WorkshopModel, b: WorkshopModel) {
  return (
    collator.compare(a.modality ?? '', b.modality ?? '') ||
    collator.compare(a.provider ?? '', b.provider ?? '') ||
    collator.compare(a.name, b.name) ||
    collator.compare(a.slug, b.slug)
  )
}

function nextInCatalogue(model: WorkshopModel, list: readonly WorkshopModel[]) {
  const ordered = [...list].sort(byCatalogueOrder)
  const index = ordered.findIndex((other) => other.slug === model.slug)
  return index === -1 ? undefined : ordered[(index + 1) % ordered.length]
}

// Most visitors land on a model page from search or from the home page, so the
// rest of the catalog is surfaced there. The model's other tasks come first,
// then the same provider, topped up with the nearest category. The last card
// is the next model in catalogue order, even past the limit, so every page is
// linked from another.
export function relatedModels(
  model: WorkshopModel,
  list: readonly WorkshopModel[],
  limit = 4
): WorkshopModel[] {
  const id = workshopExecutionId(model)
  const siblings = list.filter(
    (other) => other.slug !== model.slug && workshopExecutionId(other) === id
  )
  const next = nextInCatalogue(model, list)
  const pinned = next && workshopExecutionId(next) !== id ? next : undefined
  const sameProvider = (other: WorkshopModel) =>
    model.provider !== undefined && other.provider === model.provider
  const sharedCapabilities = (other: WorkshopModel) =>
    other.capabilities.filter((capability) =>
      model.capabilities.includes(capability)
    ).length
  const seen = new Set([id])
  const others = list
    .filter((other) => workshopExecutionId(other) !== id)
    .sort(
      (a, b) =>
        Number(sameProvider(b)) - Number(sameProvider(a)) ||
        sharedCapabilities(b) - sharedCapabilities(a) ||
        Number(b.modality === model.modality) -
          Number(a.modality === model.modality) ||
        b.workflowCount - a.workflowCount
    )
    .map((other) =>
      pinned && workshopExecutionId(other) === workshopExecutionId(pinned)
        ? pinned
        : other
    )
    .filter((other) => {
      const otherId = workshopExecutionId(other)
      if (seen.has(otherId)) return false
      seen.add(otherId)
      return true
    })
  const room = Math.max(0, limit - siblings.length)
  const top = others.slice(0, room)
  return [
    ...siblings,
    ...(!pinned || top.includes(pinned)
      ? top
      : [...top.slice(0, Math.max(0, room - 1)), pinned])
  ]
}
