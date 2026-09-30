import { memoize } from 'es-toolkit'

export const loadWorkflowCatalogue = memoize(
  () => import('../../components/workshop/WorkflowCatalogue.vue')
)
export const loadAppCatalogue = memoize(
  () => import('../../components/workshop/AppCatalogue.vue')
)
