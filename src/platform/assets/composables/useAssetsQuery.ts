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

  let nextCursor: string | undefined
  const seenCursors = new Set<string | undefined>()
  const hasMore = ref(true)
  const items = ref<AssetItem[]>([])

  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()
  async function doLoadMore(signal?: AbortSignal) {
    if (!hasMore.value || seenCursors.has(nextCursor)) return
    if (seenCursors.has(nextCursor)) {
      hasMore.value = false
      return
    }
    seenCursors.add(nextCursor)

    const assetResponse = await doQuery(
      {
        after: nextCursor ?? params.after
      },
      signal
    )
    if (!assetResponse) return
    nextCursor = assetResponse.next_cursor
    hasMore.value = assetResponse.has_more
    items.value.push(...assetResponse.assets)
  }

  function loadMore() {
    return enqueue('loadMore', doLoadMore)
  }

  function loadNew() {
    return enqueue('loadNew', async function (signal: AbortSignal) {
      const knownIds = new Set(items.value.map((item) => item.id))
      const newItems: AssetItem[] = []
      let headCursor: string | undefined
      const seenHeadCursors = new Set<string | undefined>()
      while (true) {
        if (seenHeadCursors.has(headCursor)) break
        seenHeadCursors.add(headCursor)

        const assetResponse = await doQuery({ after: headCursor }, signal)
        if (!assetResponse) return

        const { assets, has_more, next_cursor } = assetResponse
        headCursor = next_cursor
        const newFromPage = assets.filter(({ id }) => !knownIds.has(id))
        newItems.push(...newFromPage)
        if (newFromPage.length !== assets.length || !has_more) break
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
      nextCursor = undefined
      seenCursors.clear()
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

export const { constructor: useAssetsQuery, invalidateAll } =
  createSharedPagedList(
    assetsQueryInternal,
    (p) => JSON.stringify(sortedParams(p)),
    (item) => item.id
  )
