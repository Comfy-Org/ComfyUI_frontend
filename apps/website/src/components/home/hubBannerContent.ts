import type { HubBannerContent } from '@/data/hubBanner'

type LoadHubBannerContent = () => Promise<HubBannerContent>

const loadCatalogueContent: LoadHubBannerContent = async () =>
  (await import('@/data/hubBanner')).hubBannerContent

const EMPTY: HubBannerContent = { apps: [], workflows: [], models: [] }

/** The homepage Hub banner's tiles, read from the catalogue only when the Hub is in this build. */
export async function resolveHubBannerContent(
  enabled: boolean,
  load: LoadHubBannerContent = loadCatalogueContent
): Promise<HubBannerContent> {
  if (!enabled) return EMPTY
  return load()
}
