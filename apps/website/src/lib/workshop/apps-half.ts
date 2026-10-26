import { memoize } from 'es-toolkit'

export const loadAppsHalf = memoize(
  () => import('@/components/workshop/AppsHalf.vue')
)
