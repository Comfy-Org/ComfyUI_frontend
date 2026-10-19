import { useAlgoliaSearchProvider } from '@/services/providers/algoliaSearchProvider'
import { useComfyRegistrySearchProvider } from '@/services/providers/registrySearchProvider'
import type { SearchNodePacksParams } from '@/types/algoliaTypes'
import type {
  NodePackSearchProvider,
  SearchPacksOutcome
} from '@/types/searchServiceTypes'
import { paramsToCacheKey } from '@/utils/formatUtil'
import { toError } from '@/utils/errorUtil'

interface ProviderState {
  provider: NodePackSearchProvider
  name: string
  isHealthy: boolean
  lastError?: Error
  lastAttempt?: Date
  consecutiveFailures: number
}

interface ListProvider {
  listKey: string
  providerState: ProviderState
}

export interface RegistrySearchGateway extends NodePackSearchProvider {
  /** Closes every provider's circuit so the next search tries them all again. */
  resetCircuits(): void
}

const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_BREAKER_TIMEOUT_MS = 60_000

const toListKey = (
  query: string,
  { pageSize, restrictSearchableAttributes }: SearchNodePacksParams
) => paramsToCacheKey({ query, pageSize, restrictSearchableAttributes })

/**
 * Searches node packs through the first available provider, failing over on
 * errors, with a circuit breaker per provider.
 */
export const useRegistrySearchGateway = (): RegistrySearchGateway => {
  const providers: ProviderState[] = []
  let activeProviderIndex = 0
  let firstPageProvider: ListProvider | undefined

  try {
    providers.push({
      provider: useAlgoliaSearchProvider(),
      name: 'Algolia',
      isHealthy: true,
      consecutiveFailures: 0
    })
  } catch (error) {
    console.warn('Failed to initialize Algolia provider:', error)
  }

  providers.push({
    provider: useComfyRegistrySearchProvider(),
    name: 'ComfyRegistry',
    isHealthy: true,
    consecutiveFailures: 0
  })

  const isCircuitClosed = (providerState: ProviderState): boolean => {
    if (providerState.consecutiveFailures < CIRCUIT_BREAKER_THRESHOLD) {
      return true
    }

    if (providerState.lastAttempt) {
      const timeSinceLastAttempt =
        Date.now() - providerState.lastAttempt.getTime()
      if (timeSinceLastAttempt > CIRCUIT_BREAKER_TIMEOUT_MS) {
        return true
      }
    }

    return false
  }

  const recordSuccess = (providerState: ProviderState) => {
    providerState.isHealthy = true
    providerState.consecutiveFailures = 0
    providerState.lastError = undefined
  }

  const recordFailure = (providerState: ProviderState, error: Error) => {
    providerState.consecutiveFailures++
    providerState.lastError = error
    providerState.lastAttempt = new Date()

    if (providerState.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
      providerState.isHealthy = false
      console.warn(
        `${providerState.name} provider circuit breaker opened after ${providerState.consecutiveFailures} failures`
      )
    }
  }

  const findUntriedProvider = (
    skipped: ReadonlySet<ProviderState>
  ): ProviderState | undefined => {
    const isAvailable = (providerState: ProviderState) =>
      !skipped.has(providerState) && isCircuitClosed(providerState)
    if (isAvailable(providers[activeProviderIndex])) {
      return providers[activeProviderIndex]
    }
    const index = providers.findIndex(isAvailable)
    if (index === -1) return undefined
    activeProviderIndex = index
    return providers[index]
  }

  const updateActiveProviderOnFailure = () => {
    if (activeProviderIndex < providers.length - 1) {
      activeProviderIndex++
    }
  }

  const providersOtherThanListProvider = (
    listKey: string,
    pageNumber: number
  ): Set<ProviderState> => {
    const listProvider =
      pageNumber > 0 && firstPageProvider?.listKey === listKey
        ? firstPageProvider.providerState
        : undefined
    return new Set(
      listProvider ? providers.filter((p) => p !== listProvider) : []
    )
  }

  const searchPacks = async (
    query: string,
    params: SearchNodePacksParams
  ): Promise<SearchPacksOutcome> => {
    const providerErrors: Error[] = []
    const listKey = toListKey(query, params)
    const skipped = providersOtherThanListProvider(listKey, params.pageNumber)

    for (
      let providerState = findUntriedProvider(skipped);
      providerState;
      providerState = findUntriedProvider(skipped)
    ) {
      skipped.add(providerState)
      const outcome = await providerState.provider.searchPacks(query, params)
      if (outcome.ok) {
        recordSuccess(providerState)
        if (params.pageNumber === 0) {
          firstPageProvider = { listKey, providerState }
        }
        return outcome
      }
      const error = toError(outcome.cause)
      providerErrors.push(error)
      recordFailure(providerState, error)
      console.warn(
        `${providerState.name} search provider failed (${providerState.consecutiveFailures} failures):`,
        outcome.cause
      )
      updateActiveProviderOnFailure()
    }

    const lastError = providerErrors.at(-1)
    return {
      ok: false,
      cause: new AggregateError(
        providerErrors,
        lastError
          ? `All search providers failed. Last error: ${lastError.message}`
          : 'No available search providers'
      )
    }
  }

  const resetCircuits = () => {
    for (const providerState of providers) recordSuccess(providerState)
    activeProviderIndex = 0
  }

  const clearSearchCache = () => {
    for (const providerState of providers) {
      try {
        providerState.provider.clearSearchCache()
      } catch (error) {
        console.warn(
          `Failed to clear cache for ${providerState.name} provider:`,
          error
        )
      }
    }
  }

  return {
    searchPacks,
    clearSearchCache,
    resetCircuits
  }
}
