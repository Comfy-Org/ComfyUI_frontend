import { memoize } from 'es-toolkit'

export const loadWorkflowCatalogue = memoize(
  () => import('@/components/workshop/WorkflowCatalogue.vue')
)
export const loadAppCatalogue = memoize(
  () => import('@/components/workshop/AppCatalogue.vue')
)
export const loadExploreCatalogue = memoize(
  () => import('@/components/workshop/ExploreCatalogue.vue')
)

const importModelsCatalogue = () =>
  import('@/components/workshop/ModelsCatalogue.vue')
let modelsCatalogue: ReturnType<typeof importModelsCatalogue> | undefined

/** The models catalogue, fetched once; a failed fetch is tried again. */
export function loadModelsCatalogue() {
  modelsCatalogue ??= importModelsCatalogue().catch((error: unknown) => {
    modelsCatalogue = undefined
    throw error
  })
  return modelsCatalogue
}
