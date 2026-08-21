import { computed, ref } from 'vue'
import { fromZodError } from 'zod-validation-error'
import type { ListAssetsData } from '@comfyorg/ingest-types'

import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { createSharedPagedList } from '@/platform/remote/paged/pagedList'
import type { PagedList } from '@/platform/remote/paged/pagedList'
import { api } from '@/scripts/api'
import {
  encodeParams,
  singletonInvocation,
  sortedParams
} from '@/utils/requestUtil'

interface QueryOptions {
  requestOptions?: RequestInit
  onError?: (reason: string, error?: unknown) => void
}

const BASE_PARAMS: ListAssetsData['query'] = {
  sort: 'created_at'
}

function assetsQueryInternal(
  params: ListAssetsData['query'] = {},
  options: QueryOptions = {}
): PagedList<AssetItem> {
  const onError = options.onError ?? console.error
  let pendingFetchController = new AbortController()

  let next_cursor: string | undefined
  const hasMore = ref(true)
  const items = ref<AssetItem[]>([])
  const { loading: loadingMorePromise, fn: loadMore } = singletonInvocation(
    async function () {
      if (!hasMore.value) return
      const assetResponse = await doQuery({
        after: next_cursor ?? params.after
      })
      if (!assetResponse) return
      next_cursor = assetResponse.next_cursor
      hasMore.value = assetResponse.has_more
      items.value.push(...assetResponse.assets)
    }
  )
  const { loading: loadingNewPromise, fn: loadNew } = singletonInvocation(
    async function () {
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
  )
  const isLoading = computed(
    () => !!loadingMorePromise.value || !!loadingNewPromise.value
  )

  async function doQuery(overrideParams: Record<string, unknown>) {
    const signal = options.requestOptions?.signal
      ? AbortSignal.any([
          pendingFetchController.signal,
          options.requestOptions.signal
        ])
      : pendingFetchController.signal
    const requestOptions = { ...options.requestOptions, signal }
    const query = encodeParams({ ...BASE_PARAMS, ...params, ...overrideParams })
    const resp = await api
      .fetchApi(`/assets?${query}`, requestOptions)
      .catch((e) => onError('asset fetch failed', e))

    if (!resp) return
    if (!resp.ok) {
      onError('asset request failed', resp)
      return
    }

    const jsonresp = await resp
      .json()
      .catch((e) => onError('failed to decode asset json response', e))
    if (!jsonresp) return

    const parseResult = assetResponseSchema.safeParse(jsonresp)
    if (!parseResult.success) {
      onError('Failed to parse asset response', fromZodError(parseResult.error))
      return
    }
    return parseResult.data
  }

  async function invalidate(stale?: string[]) {
    if (stale) {
      const ids = new Set(stale)
      items.value = items.value.filter((item) => !ids.has(item.id))
      return
    }
    pendingFetchController.abort()
    pendingFetchController = new AbortController()

    hasMore.value = true
    next_cursor = undefined
    items.value = []
    await Promise.allSettled([loadingMorePromise, loadingNewPromise])
    await loadMore()
  }

  void loadMore()

  return { hasMore, invalidate, isLoading, items, loadMore, loadNew }
}

export const useAssetsQuery = createSharedPagedList(
  assetsQueryInternal,
  (p) => JSON.stringify(sortedParams(p)),
  (item) => item.id
)
