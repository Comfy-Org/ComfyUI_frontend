import type { DiscoveryProvider } from '../../data/modelDiscovery'

type LoadDiscoveryProviders = () => Promise<readonly DiscoveryProvider[]>

/**
 * Dynamic so a disabled build never evaluates the catalogue. A static import
 * here would pull the whole catalogue into every homepage render whether or
 * not Models is in the build.
 */
const loadCatalogueProviders: LoadDiscoveryProviders = async () =>
  (await import('../../data/modelDiscovery')).discoveryProviders

/**
 * The providers the homepage discovery section lists, loaded only when Models
 * is in this build. Both homepages call this rather than branching in their
 * own frontmatter, which coverage cannot see, so the two cannot drift.
 */
export async function resolveDiscoveryProviders(
  enabled: boolean,
  load: LoadDiscoveryProviders = loadCatalogueProviders
): Promise<readonly DiscoveryProvider[]> {
  if (!enabled) return []
  return load()
}
