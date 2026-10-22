import type { WorkshopModel } from '@/config/models-catalogue'
import { workshopModels } from '@/config/workshop-browse-content'
import type { AuthoringSession } from '@/lib/cms/authoring-session'
import { loadEverySiteCatalogCard } from '@/lib/cms/catalog-list-all'
import { cmsEnabled } from '@/lib/cms/cms-enabled'

export async function modelsHubIndexModels(
  session: AuthoringSession | undefined,
  locale: string | undefined
) {
  const staticModels: readonly WorkshopModel[] = workshopModels
  if (!cmsEnabled()) return { ok: true, models: staticModels } as const
  const catalog = await loadEverySiteCatalogCard(session, locale, 'models')
  if (!catalog.ok) return catalog
  return {
    ok: true,
    models: catalog.models.filter(
      (model) => (model.type ?? 'MODEL') === 'MODEL'
    )
  } as const
}
