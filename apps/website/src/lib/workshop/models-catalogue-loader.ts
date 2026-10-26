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
