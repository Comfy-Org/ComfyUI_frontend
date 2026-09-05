import type { LocationQuery } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'

/**
 * Shared head/tail for URL deep-link loaders that survive a login redirect via
 * the preserved-query (sessionStorage) system. `param` names BOTH the URL query
 * key and its preserved-query namespace — they are always identical. Extracts
 * ONLY the boilerplate:
 *  - hydrateAndRead(): restore the preserved param, reflect it in the URL, and
 *    return its value from the (possibly merged) query.
 *  - strip(): remove `param` from the URL and clear the preserved namespace.
 * Each caller keeps its OWN gate/validation and action explicit — this helper
 * intentionally contains no auth logic.
 */
export function usePreservedQueryDeepLink(param: string) {
  const route = useRoute()
  const router = useRouter()

  const hydrateAndRead = async (): Promise<
    LocationQuery[string] | undefined
  > => {
    hydratePreservedQuery(param)
    const merged = mergePreservedQueryIntoQuery(param, route.query)
    if (merged) {
      await router.replace({ query: merged })
    }
    return (merged ?? route.query)[param] as LocationQuery[string] | undefined
  }

  const strip = () => {
    if (param in route.query) {
      const newQuery = { ...route.query }
      delete newQuery[param]
      router.replace({ query: newQuery }).catch((error) => {
        console.warn(
          `[usePreservedQueryDeepLink] Failed to clean URL param "${param}":`,
          error
        )
      })
    }
    clearPreservedQuery(param)
  }

  return { hydrateAndRead, strip }
}
