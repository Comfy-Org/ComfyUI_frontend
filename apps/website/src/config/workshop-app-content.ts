import displayJson from '../content/workshop-display.json'
import type { WorkshopDisplayEntry } from '../content/workshop-display.schema'
import { workshopDisplayEntriesSchema } from '../content/workshop-display.schema'
import type { AppWorkshopModel } from './models-catalogue'
import {
  isWorkshopModelDisabled,
  workshopModelFlag
} from './workshop-model-availability'
import type { WorkshopAppEntry } from './workshop-workflow-catalog'
import { appCatalog } from './workshop-workflow-catalog'

/** Pairs each APP line of the catalog with its display entry, in rank order. */
function appModelsFor(
  pages: readonly WorkshopDisplayEntry[],
  catalog: readonly WorkshopAppEntry[]
): AppWorkshopModel[] {
  const apps = new Map(catalog.map((entry) => [entry.id, entry]))
  return pages
    .flatMap((page): AppWorkshopModel[] => {
      const entry = apps.get(page.modelId)
      if (
        !entry ||
        page.type !== 'APP' ||
        page.status === 'unavailable' ||
        isWorkshopModelDisabled(page.slug) ||
        !page.displayName
      )
        return []
      const flag = workshopModelFlag(page.slug)
      return [
        {
          ...(flag ? { flag } : {}),
          type: 'APP',
          appId: entry.app,
          slug: page.slug,
          href: `/models/${page.slug}/`,
          name: page.displayName,
          summary: page.description,
          recommendedRank: page.recommendedRank,
          workflowCount: 0,
          modality: page.useCase.endsWith('videos') ? 'video' : 'image',
          useCases: [page.useCase],
          capabilities: [],
          thumbnail: page.media.thumbnail,
          thumbnailUrl: page.media.thumbnail?.url
        }
      ]
    })
    .sort(
      (a, b) =>
        (a.recommendedRank ?? Infinity) - (b.recommendedRank ?? Infinity)
    )
}

export const appModels = appModelsFor(
  workshopDisplayEntriesSchema.parse(displayJson),
  appCatalog
)

/** Static paths for /models/apps/[app]: one page per app, from its slug. */
export function appPagePaths(models: readonly AppWorkshopModel[] = appModels) {
  return models.map((model) => ({
    params: { app: model.slug.replace(/^apps\//, '') },
    props: { model }
  }))
}
