import type { Router } from 'vue-router'

import { usePreservedQueryStore } from '@/platform/navigation/preservedQueryStore'

export const installPreservedQueryTracker = (
  router: Router,
  definitions: Array<{ namespace: string; keys: string[] }>
) => {
  router.beforeEach((to, _from, next) => {
    const preservedQueryStore = usePreservedQueryStore()
    definitions.forEach(({ namespace, keys }) => {
      preservedQueryStore.hydrate(namespace)
      preservedQueryStore.capture(namespace, to.query, keys)
    })
    next()
  })
}
