import type { Router } from 'vue-router'

import {
  capturePreservedQuery,
  clearPreservedQuery,
  hydratePreservedQuery
} from '@/platform/navigation/preservedQueryManager'

interface PreservedQueryDefinition {
  namespace: string
  keys: string[]
  requiredKey?: string
}

export const installPreservedQueryTracker = (
  router: Router,
  definitions: PreservedQueryDefinition[]
) => {
  router.beforeEach((to, _from, next) => {
    const queryKeys = new Set(Object.keys(to.query))

    definitions.forEach(({ namespace, keys, requiredKey }) => {
      hydratePreservedQuery(namespace)
      const presentKeys = keys.filter((key) => queryKeys.has(key))
      if (presentKeys.length === 0) return
      if (requiredKey && !queryKeys.has(requiredKey)) {
        clearPreservedQuery(namespace)
        return
      }
      capturePreservedQuery(namespace, to.query, keys)
    })

    next()
  })
}
