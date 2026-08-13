import { ref } from 'vue'
import { fromZodError } from 'zod-validation-error'
import type { ListAssetsData } from '@comfyorg/ingest-types'

import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  createSharedPagedList,
  stableKey
} from '@/platform/remote/paged/pagedList'
import type { PagedList } from '@/platform/remote/paged/pagedList'
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
): PagedList<AssetItem> {
  const onError = options.onError ?? console.error
  let pendingFetchController = new AbortController()

  let next_cursor: string | undefined
  const hasMore = ref(true)
  const isLoading = ref(false)
  const items = ref<AssetItem[]>([])

  async function doQuery(overrideParams: Record<string, unknown>) {
    const signal = options.requestOptions?.signal
      ? AbortSignal.any([
          pendingFetchController.signal,
          options.requestOptions.signal
        ])
      : pendingFetchController.signal
    const requestOptions = { ...options.requestOptions, signal }
    const query = encodeParams({ ...BASE_PARAMS, ...params, ...overrideParams })
    const resp = await api.fetchApi(`/assets?${query}`, requestOptions)

    if (!resp.ok) {
      onError('asset request failed', resp)
      return
    }

    const parseResult = assetResponseSchema.safeParse(await resp.json())
    if (!parseResult.success) {
      onError('Failed to parse asset response', fromZodError(parseResult.error))
      return
    }
    return parseResult.data
  }

  async function loadMore() {
    const assetResponse = await doQuery({ after: next_cursor ?? params.after })
    if (!assetResponse) return
    next_cursor = assetResponse.next_cursor
    hasMore.value = assetResponse.has_more
    items.value.push(...assetResponse.assets)
  }

  async function invalidate(stale?: Readonly<AssetItem[]>) {
    if (stale) {
      const ids = new Set(stale.map((item) => item.id))
      items.value = items.value.filter((item) => !ids.has(item.id))
      return
    }
    pendingFetchController.abort()
    pendingFetchController = new AbortController()
    hasMore.value = true
    next_cursor = undefined
    items.value = []
    await loadMore()
  }

  async function loadNew() {
    const knownIds = new Set(items.value.map((item) => item.id))
    let headCursor: string | undefined
    while (true) {
      const assetResponse = await doQuery({ after: headCursor })
      if (!assetResponse) return

      const { assets, has_more, next_cursor } = assetResponse
      headCursor = next_cursor
      const newItems = assets.filter(({ id }) => !knownIds.has(id))
      items.value.splice(0, 0, ...newItems)
      if (newItems.length !== assets.length || !has_more) break
    }
  }

  return { hasMore, invalidate, isLoading, items, loadMore, loadNew }
}

const sharedPagedList = createSharedPagedList(
  useAssetsQuery,
  stableKey,
  (item) => item.id
)
export const useSharedAssetsQuery = sharedPagedList.constructor
export const invalidateItems = sharedPagedList.invalidateItems
