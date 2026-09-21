import type { WorkshopModel } from '../src/config/models-catalogue'
import {
  authoredWorkshopModels,
  workshopModels
} from '../src/config/workshop-browse-content'
import type { MediaKind } from './router-model-artifacts'

type RouterModelSelection = {
  slugs?: readonly string[]
  modality?: MediaKind
}

function isMediaKind(value: unknown): value is MediaKind {
  return value === 'image' || value === 'video' || value === 'audio'
}

export function selectRouterModels(
  selection: RouterModelSelection,
  catalogs: {
    authored?: readonly WorkshopModel[]
    published?: readonly WorkshopModel[]
  } = {}
): WorkshopModel[] {
  const authored = catalogs.authored ?? authoredWorkshopModels
  const published = catalogs.published ?? workshopModels
  const explicitSlugs = selection.slugs?.length ? selection.slugs : undefined
  const explicit = Boolean(explicitSlugs)
  const candidates = (explicit ? authored : published).filter(
    (model) =>
      isMediaKind(model.modality) &&
      (!selection.modality || model.modality === selection.modality)
  )
  const selected = new Set(
    explicitSlugs ?? candidates.map((model) => model.slug)
  )
  for (const slug of selected)
    if (!candidates.some((model) => model.slug === slug))
      throw new Error(`Not an authored media page: ${slug}`)
  const cases = candidates.filter((model) => selected.has(model.slug))
  if (!cases.length)
    throw new Error(
      explicit
        ? 'No authored media pages selected'
        : 'No published media pages selected'
    )
  return cases
}
