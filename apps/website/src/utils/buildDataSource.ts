export type BuildDataOutcome<TSnapshot, TFreshData extends object = object> =
  | ({ status: 'fresh'; snapshot: TSnapshot } & TFreshData)
  | { status: 'stale'; snapshot: TSnapshot; reason: string }
  | { status: 'failed'; reason: string }

export type BuildDataFetchResult<
  TSnapshot,
  TFreshData extends object = object
> =
  | { kind: 'ok'; snapshot: TSnapshot; data: TFreshData }
  | { kind: 'err'; reason: string }

interface BuildDataSourceConfig<
  TOptions extends object,
  TSnapshot,
  TFreshData extends object
> {
  name: string
  fetchFresh: (
    options: TOptions
  ) => Promise<BuildDataFetchResult<TSnapshot, TFreshData>>
  readSnapshot: (options: TOptions) => Promise<TSnapshot | null>
  getCacheKey?: (options: TOptions) => string
}

export function createBuildDataSource<
  TOptions extends object,
  TSnapshot,
  TFreshData extends object = object
>(config: BuildDataSourceConfig<TOptions, TSnapshot, TFreshData>) {
  let inflight: Promise<BuildDataOutcome<TSnapshot, TFreshData>> | undefined
  let inflightCacheKey: string | undefined

  function resetForTests(): void {
    inflight = undefined
    inflightCacheKey = undefined
  }

  function fetchForBuild(
    options = {} as TOptions
  ): Promise<BuildDataOutcome<TSnapshot, TFreshData>> {
    const cacheKey = config.getCacheKey?.(options) ?? 'default'
    if (inflight) {
      if (inflightCacheKey !== cacheKey) {
        throw new Error(
          `${config.name} fetcher called twice with different options; reset between distinct configurations`
        )
      }
      return inflight
    }

    inflightCacheKey = cacheKey
    inflight = doFetchForBuild(config, options)
    return inflight
  }

  return { fetchForBuild, resetForTests }
}

async function doFetchForBuild<
  TOptions extends object,
  TSnapshot,
  TFreshData extends object
>(
  config: BuildDataSourceConfig<TOptions, TSnapshot, TFreshData>,
  options: TOptions
): Promise<BuildDataOutcome<TSnapshot, TFreshData>> {
  const result = await config.fetchFresh(options)
  if (result.kind === 'ok') {
    return {
      status: 'fresh',
      snapshot: result.snapshot,
      ...result.data
    }
  }

  const snapshot = await config.readSnapshot(options)
  if (snapshot) {
    return { status: 'stale', snapshot, reason: result.reason }
  }

  return { status: 'failed', reason: result.reason }
}
