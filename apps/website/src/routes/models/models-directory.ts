interface DirectoryModel {
  readonly name: string
  readonly provider?: string
}

export interface DirectoryGroup<Model extends DirectoryModel> {
  readonly provider: string
  readonly models: readonly Model[]
}

/**
 * The index at the foot of the models hub: every model under the provider that
 * made it, providers in alphabetical order and models alphabetical within each.
 * A model with no provider falls into one group under the label given.
 */
export function modelsByProvider<Model extends DirectoryModel>(
  models: readonly Model[],
  unnamedProvider: string
): DirectoryGroup<Model>[] {
  const byName = models.toSorted((a, b) =>
    a.name.localeCompare(b.name, 'en', { numeric: true })
  )
  const providerOf = (model: Model) => model.provider ?? unnamedProvider
  return [...new Set(byName.map(providerOf))]
    .toSorted((a, b) => a.localeCompare(b, 'en'))
    .map((provider) => ({
      provider,
      models: byName.filter((model) => providerOf(model) === provider)
    }))
}
