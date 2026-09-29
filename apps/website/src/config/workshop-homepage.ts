import type { WorkshopModelEntry } from '../content/workshop-models.schema'
import type { WorkshopBrowseModel } from './workshop'
import { toBrowseModel } from './workshop'
import { featuredWorkshopModels } from './workshop-featured'

type LoadWorkshopModels = () => Promise<readonly WorkshopModelEntry[]>

/**
 * Loads the homepage cards only when Workshop exists in this build. Keeping
 * the load behind the release decision prevents a disabled build from doing
 * catalog work or accidentally exposing a link to an absent route.
 */
export async function resolveHomepageWorkshopModels(
  enabled: boolean,
  loadModels: LoadWorkshopModels
): Promise<WorkshopBrowseModel[]> {
  if (!enabled) return []
  return featuredWorkshopModels((await loadModels()).map(toBrowseModel))
}
