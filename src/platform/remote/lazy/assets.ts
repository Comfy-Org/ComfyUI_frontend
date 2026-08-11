import { ref } from 'vue'
import { fromZodError } from 'zod-validation-error'
import type { ListAssetsData } from '@comfyorg/ingest-types'

import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import type { LazyList } from '@/platform/remote/lazy/lazyList'
import { api } from '@/scripts/api'
import { encodeParams } from '@/utils/urlUtil'

type QueryOptions = {
  requestOptions?: RequestInit
  onError?: (reason: string, error?: unknown) => void
}

const BASE_PARAMS: ListAssetsData['query'] = {}

//TODO: gracefully handle invalidation. Scan from null cursor until repeat is found. Reconcile all new in case out-of-order responses are returned?

export function useAssetsQuery(
  params: ListAssetsData['query'] = {},
  options: QueryOptions = {}
): LazyList<AssetItem> {
  const onError = options.onError ?? console.error
  let pendingFetchController = new AbortController()

  let next_cursor: string | undefined
  let has_more = true
  const items = ref<AssetItem[]>([])
  async function onLoadMore() {
    const signal = options.requestOptions?.signal
      ? AbortSignal.any([
          pendingFetchController.signal,
          options.requestOptions.signal
        ])
      : pendingFetchController.signal
    const requestOptions = { ...options.requestOptions, signal }
    const after = next_cursor ?? params.after
    const query = encodeParams({ ...BASE_PARAMS, ...params, after })
    const resp = await api.fetchApi(`/assets?${query}`, requestOptions)

    if (!resp.ok) return onError('asset request failed', resp)

    const parseResult = assetResponseSchema.safeParse(await resp.json())
    if (!parseResult.success)
      return onError(
        'Failed to parse asset response',
        fromZodError(parseResult.error)
      )

    const parsed = parseResult.data
    next_cursor = parsed.next_cursor
    has_more = parsed.has_more
    items.value.push(...parsed.assets)
  }
  async function loadNew() {
    pendingFetchController.abort()
    pendingFetchController = new AbortController()
    has_more = true
    next_cursor = undefined
    items.value = []
    await onLoadMore()
  }
  return {
    canLoadMore: () => has_more,
    items: items.value,
    loadNew,
    onLoadMore
  }
}
