import { refAutoReset, until } from '@vueuse/core'
import { computed, ref } from 'vue'
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
  const seenCursors = new Set<string | undefined>()
  const morePages = ref(true)
  const backingOff = refAutoReset(false, 2000)
  const hasMore = computed(() => morePages.value && !backingOff.value)
  const items = ref<AssetItem[]>([])

  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()
  async function doLoadMore(signal?: AbortSignal) {
    if (!hasMore.value) return
    if (seenCursors.has(nextCursor)) {
      morePages.value = false
      return
    }

    const assetResponse = await doQuery(
      {
        after: nextCursor ?? params.after
      },
      signal
    )
    if (!assetResponse) return
    seenCursors.add(nextCursor)
    nextCursor = assetResponse.next_cursor
    morePages.value = assetResponse.has_more
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
      for (;;) {
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
      morePages.value = true
      nextCursor = undefined
      seenCursors.clear()
      items.value = []
      await until(backingOff).toBe(false)
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

    if (!resp) {
      if (!signal?.aborted) backingOff.value = true
      return
    }
    if (!resp.ok) {
      onError('asset request failed', resp)
      if (resp.status === 429 || resp.status >= 500) backingOff.value = true
      else morePages.value = false
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
