import { ref } from 'vue'
import { fromZodError } from 'zod-validation-error'
import type { ListAssetsData } from '@comfyorg/ingest-types'

import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { createSharedPagedList, usePreemptableQueue } from '@/utils/pagedList'
import type { PagedList } from '@/utils/pagedList'
import { encodeParams, sortedParams } from '@/utils/requestUtil'

interface QueryOptions {
  onError?: (reason: string, error?: unknown) => void
}

const BASE_PARAMS: ListAssetsData['query'] = {
  sort: 'created_at',
  tags_none: ['missing']
}

function assetsQueryInternal(
  params: ListAssetsData['query'] = {},
  options: QueryOptions = {}
): PagedList<AssetItem> {
  const onError = options.onError ?? console.error

  let next_cursor: string | undefined
  const hasMore = ref(true)
  const items = ref<AssetItem[]>([])

  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()
  async function doLoadMore(signal?: AbortSignal) {
    if (!hasMore.value) return
    const assetResponse = await doQuery(
      {
        after: next_cursor ?? params.after
      },
      signal
    )
    if (!assetResponse) return
    next_cursor = assetResponse.next_cursor
    hasMore.value = assetResponse.has_more
    items.value.push(...assetResponse.assets)
  }

  function loadMore() {
    return enqueue('loadMore', doLoadMore)
  }

  function loadNew() {
    return enqueue('loadNew', async function (signal: AbortSignal) {
      const knownIds = new Set(items.value.map((item) => item.id))
      const seenIds = new Set(knownIds)
      const seenCursors = new Set<string>()
      const newItems: AssetItem[] = []
      let headCursor: string | undefined
      while (true) {
        const assetResponse = await doQuery({ after: headCursor }, signal)
        if (!assetResponse) return

        const { assets, has_more, next_cursor } = assetResponse
        let reachedKnownId = false
        for (const asset of assets) {
          if (knownIds.has(asset.id)) {
            reachedKnownId = true
            break
          }
          if (seenIds.has(asset.id)) {
            continue
          }
          seenIds.add(asset.id)
          newItems.push(asset)
        }
        if (
          reachedKnownId ||
          !has_more ||
          next_cursor === undefined ||
          seenCursors.has(next_cursor)
        ) {
          break
        }
        seenCursors.add(next_cursor)
        headCursor = next_cursor
      }
      items.value.splice(0, 0, ...newItems)
    })
  }

  async function invalidate(stale?: string[]) {
    if (stale) {
      const ids = new Set(stale)
      items.value = items.value.filter((item) => !ids.has(item.id))
      return
    }
    await preempt(async () => {
      hasMore.value = true
      next_cursor = undefined
      items.value = []
      await doLoadMore()
    })
  }

  async function doQuery(
    overrideParams: Record<string, unknown>,
    signal?: AbortSignal
  ) {
    const requestOptions = { signal }
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

  void loadMore()
  return { hasMore, invalidate, isLoading, items, loadMore, loadNew }
}

export const useAssetsQuery = createSharedPagedList(
  assetsQueryInternal,
  (p) => JSON.stringify(sortedParams(p)),
  (item) => item.id
)
