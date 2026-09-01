import { ref } from 'vue'
import { fromZodError } from 'zod-validation-error'
import type { ListAssetsData } from '@comfyorg/ingest-types'

import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import { getPagedList, usePreemptableQueue } from '@/utils/pagedList'
import type { SharedPagedListState, PagedList } from '@/utils/pagedList'
import { encodeParams } from '@/utils/requestUtil'

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
  const seenCursors = new Set(params.after === undefined ? [] : [params.after])
  const hasMore = ref(true)
  const items = ref<AssetItem[]>([])

  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()
  async function doLoadMore(signal?: AbortSignal) {
    if (!hasMore.value) return
    const previousCursor = nextCursor
    const assetResponse = await doQuery(
      {
        after: nextCursor ?? params.after
      },
      signal
    )
    if (!assetResponse) return

    const knownIds = new Set(items.value.map(({ id }) => id))
    const newItems = assetResponse.assets.filter(({ id }) => {
      if (knownIds.has(id)) return false
      knownIds.add(id)
      return true
    })
    nextCursor = assetResponse.next_cursor
    hasMore.value =
      assetResponse.has_more &&
      nextCursor !== undefined &&
      nextCursor !== previousCursor &&
      !seenCursors.has(nextCursor)
    if (nextCursor !== undefined) seenCursors.add(nextCursor)
    items.value.push(...newItems)
  }

  async function loadMore() {
    await enqueue('loadMore', async (signal) => {
      await doLoadMore(signal)
    })
  }

  function loadNew() {
    return enqueue('loadNew', async function (signal: AbortSignal) {
      const knownIds = new Set(items.value.map((item) => item.id))
      const seenIds = new Set(knownIds)
      const seenHeadCursors = new Set<string>()
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
          seenHeadCursors.has(next_cursor)
        ) {
          break
        }
        seenHeadCursors.add(next_cursor)
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
      nextCursor = undefined
      seenCursors.clear()
      if (params.after !== undefined) seenCursors.add(params.after)
      items.value = []
      await doLoadMore()
    })
  }

  async function doQuery(
    overrideParams: ListAssetsData['query'],
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
  return {
    hasMore,
    invalidate,
    isLoading,
    items,
    loadMore,
    loadNew
  }
}

const sharedState: SharedPagedListState<ListAssetsData['query'], AssetItem> = {
  cache: new Map(),
  factory: assetsQueryInternal,
  paramKeyFn: encodeParams,
  itemKeyFn: (item) => item.id
}

export function useAssetsQuery(
  params: ListAssetsData['query']
): PagedList<AssetItem> {
  return getPagedList(params, sharedState)
}

export async function invalidateAll() {
  await Promise.all(
    [...sharedState.cache.values()].map((e) => e.list.invalidate())
  )
}
