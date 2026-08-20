import { computed, ref } from 'vue'
import { fromZodError } from 'zod-validation-error'
import type { ListAssetsData } from '@comfyorg/ingest-types'
import { whenever } from '@vueuse/core'

import { unflattenOutputAssets } from '@/platform/assets/composables/media/assetMappers'
import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import {
  createSharedPagedList,
  stableKey,
  wrapPagedList
} from '@/platform/remote/paged/pagedList'
import type { PagedList } from '@/platform/remote/paged/pagedList'
import { api } from '@/scripts/api'
import { encodeParams, singletonInvocation } from '@/utils/requestUtil'

type QueryOptions = {
  requestOptions?: RequestInit
  onError?: (reason: string, error?: unknown) => void
}

// @ts-expect-error check result is unused
type _TagsStubCheck =
  // @ts-expect-error tags must be stubbed into ingest-types
  ListAssetsData['query']['tags_any']
type AssetParams = ListAssetsData['query'] & {
  tags_all?: string[]
  tags_any?: string[]
  tags_none?: string[]
}

const BASE_PARAMS: ListAssetsData['query'] = {
  sort: 'created_at'
}

function assetsQueryInternal(
  params: AssetParams = {},
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
    const resp = await api.fetchApi(`/assets?${query}`, requestOptions)

    if (!resp.ok) {
      onError('asset request failed', resp)
      return
    }

    const jsonresp = await resp.json()
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
    const { promise, resolve, reject } = Promise.withResolvers<void>()
    whenever(
      () => !loadingMorePromise.value,
      () => loadMore().then(resolve, reject),
      { once: true, immediate: true }
    )
    await promise
  }

  void loadMore()

  return { hasMore, invalidate, isLoading, items, loadMore, loadNew }
}

export const useAssetsQuery = createSharedPagedList(
  (p) =>
    wrapPagedList(assetsQueryInternal(p), (items) =>
      unflattenOutputAssets(items)
    ),
  stableKey,
  (item) => item.id
)
