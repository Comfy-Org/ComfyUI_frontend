import { z } from 'zod'
import { fromZodError } from 'zod-validation-error'

import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type { components } from '@/types/comfyRegistryTypes'
import type {
  NodePackSearchProvider,
  SearchPacksOutcome
} from '@/types/searchServiceTypes'

type RegistryNodePack = components['schemas']['Node']

const zRegistrySearchResult = z.looseObject({
  nodes: z.array(
    z.custom<RegistryNodePack>(
      (node) => typeof node === 'object' && node !== null,
      { message: 'expected a node pack object' }
    )
  )
})

interface CachedRegistryRequest<TParams, TResult> {
  call: (params: TParams) => Promise<TResult | null>
  evict: (params: TParams) => void
}

export const useComfyRegistrySearchProvider = (): NodePackSearchProvider => {
  const registryStore = useComfyRegistryStore()

  const requestFailure = (): Error => {
    const cause = registryStore.error
    return new Error(
      cause
        ? `Comfy Registry request failed: ${cause}`
        : 'Comfy Registry request failed'
    )
  }

  const requestPage = async <TParams, TResult>(
    request: CachedRegistryRequest<TParams, TResult>,
    params: TParams
  ): Promise<SearchPacksOutcome> => {
    const response = await request.call(params)
    if (!response) {
      request.evict(params)
      return { ok: false, cause: requestFailure() }
    }
    const parsed = zRegistrySearchResult.safeParse(response)
    if (!parsed.success) {
      request.evict(params)
      return {
        ok: false,
        cause: fromZodError(parsed.error, {
          prefix: 'Malformed registry search response'
        })
      }
    }
    return {
      ok: true,
      result: { nodePacks: parsed.data.nodes, querySuggestions: [] }
    }
  }

  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksOutcome> => {
    const { pageSize, pageNumber, restrictSearchableAttributes } = params
    const registryPage = pageNumber + 1

    if (!query || query.trim() === '') {
      return requestPage(registryStore.listAllPacks, {
        limit: pageSize,
        page: registryPage
      })
    }

    const isNodeSearch = restrictSearchableAttributes?.includes('comfy_nodes')

    return requestPage(registryStore.search, {
      search: isNodeSearch ? undefined : query,
      comfy_node_search: isNodeSearch ? query : undefined,
      limit: pageSize,
      page: registryPage
    })
  }

  const clearSearchCache = () => {
    registryStore.search.clear()
    registryStore.listAllPacks.clear()
  }

  return {
    searchPacks,
    clearSearchCache
  }
}
