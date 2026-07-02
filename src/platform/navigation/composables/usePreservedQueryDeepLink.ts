import type { LocationQuery } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'

/**
 * Shared head/tail for URL deep-link loaders that survive a login redirect via
 * the preserved-query (sessionStorage) system. Extracts ONLY the boilerplate:
 *  - hydrateAndRead(): restore the preserved param, reflect it in the URL, and
 *    return the value of `key` from the (possibly merged) query.
 *  - strip(): remove `key` from the URL and clear the preserved namespace.
 * Each caller keeps its OWN gate/validation and action explicit — this helper
 * intentionally contains no auth logic.
 */
export function usePreservedQueryDeepLink(namespace: string, key: string) {
  const route = useRoute()
  const router = useRouter()

  const hydrateAndRead = async (): Promise<LocationQuery[string]> => {
    hydratePreservedQuery(namespace)
    const merged = mergePreservedQueryIntoQuery(namespace, route.query)
    if (merged) {
      await router.replace({ query: merged })
    }
    return (merged ?? route.query)[key] as LocationQuery[string]
  }

  const strip = () => {
    const newQuery = { ...route.query }
    delete newQuery[key]
    void router.replace({ query: newQuery })
    clearPreservedQuery(namespace)
  }

  return { hydrateAndRead, strip }
}
