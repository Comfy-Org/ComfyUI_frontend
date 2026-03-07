import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'
import { useComfyRegistrySearchProvider } from '@/services/providers/registrySearchProvider'
import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  NodePackSearchProvider,
  SearchPacksResult
} from '@/types/searchServiceTypes'

type RegistryNodePack = components['schemas']['Node']

interface NamedProvider {
  provider: NodePackSearchProvider
  name: string
}

/**
 * Search gateway with primary/fallback provider pattern.
 * Tries Algolia first, falls back to ComfyRegistry on failure.
 */
export const useRegistrySearchGateway = (): NodePackSearchProvider => {
  const providers: NamedProvider[] = []
  let activeProviderIndex = 0

  try {
    providers.push({
      provider: useAlgoliaSearchProvider(),
      name: 'Algolia'
    })
  } catch (error) {
    console.warn('Failed to initialize Algolia provider:', error)
  }

  providers.push({
    provider: useComfyRegistrySearchProvider(),
    name: 'ComfyRegistry'
  })

  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksResult> => {
    let lastError: Error | null = null

    for (let i = activeProviderIndex; i < providers.length; i++) {
      try {
        const result = await providers[i].provider.searchPacks(query, params)
        activeProviderIndex = i
        return result
      } catch (error) {
        lastError = error as Error
        console.warn(`${providers[i].name} search failed:`, error)
      }
    }

    throw new Error(
      `All search providers failed. Last error: ${lastError?.message ?? 'Unknown error'}`
    )
  }

  const clearSearchCache = () => {
    for (const { provider, name } of providers) {
      try {
        provider.clearSearchCache()
      } catch (error) {
        console.warn(`Failed to clear cache for ${name} provider:`, error)
      }
    }
  }

  const getSortValue = (
    pack: RegistryNodePack,
    sortField: string
  ): string | number => {
    return providers[activeProviderIndex].provider.getSortValue(pack, sortField)
  }

  const getSortableFields = () => {
    return providers[activeProviderIndex].provider.getSortableFields()
  }

  return {
    searchPacks,
    clearSearchCache,
    getSortValue,
    getSortableFields
  }
}
