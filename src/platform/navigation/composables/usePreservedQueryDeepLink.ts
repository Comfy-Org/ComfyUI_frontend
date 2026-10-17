import type { LocationQuery } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import {
  clearPreservedQuery,
  hydratePreservedQuery,
  mergePreservedQueryIntoQuery
} from '@/platform/navigation/preservedQueryManager'

/**
 * `param` is both the URL query key and its preserved-query namespace, so a
 * value stashed before a login redirect is restored into the URL on return.
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
