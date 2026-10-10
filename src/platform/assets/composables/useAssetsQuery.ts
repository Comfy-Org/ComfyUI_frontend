import { until } from '@vueuse/core'
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

/** Whether older pages can be requested; 'backing-off' clears itself after 2 s. */
type PageState = 'ready' | 'exhausted' | 'failed' | 'backing-off'

const MAX_HEAD_PAGES = 2

const BASE_PARAMS = {
  include_public: false,
  limit: 100,
  sort: 'created_at',
  tags_none: ['missing']
} satisfies ListAssetsData['query']

function assetsQueryInternal(
  params: ListAssetsData['query'] = {},
  options: QueryOptions = {}
): PagedList<AssetItem> {
  const onError = options.onError ?? console.error

  let nextCursor: string | undefined
  const seenCursors = new Set<string | undefined>()
  let loadGeneration = 0
  const pageState = ref<PageState>('ready')
  const hasMore = computed(() => pageState.value === 'ready')
  let backOffTimer: ReturnType<typeof setTimeout> | undefined
  const items = ref<AssetItem[]>([])

  const { enqueue, preempt, running: isLoading } = usePreemptableQueue()
  let loadMorePromise: Promise<boolean> | undefined
  let invalidationQueue = Promise.resolve()
  async function doLoadMore(signal?: AbortSignal) {
    if (!hasMore.value) return
    const requestedCursor = nextCursor ?? params.after
    if (seenCursors.has(requestedCursor)) return

    const assetResponse = await doQuery(
      {
        after: requestedCursor
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
    seenCursors.add(requestedCursor)
    nextCursor = assetResponse.next_cursor
    pageState.value =
      assetResponse.has_more &&
      nextCursor !== undefined &&
      !seenCursors.has(nextCursor)
        ? 'ready'
        : 'exhausted'
    items.value.push(...newItems)
    loadGeneration++
  }

  function loadMore() {
    if (!loadMorePromise) {
      const startingGeneration = loadGeneration
      const operation = enqueue('loadMore', doLoadMore).then(
        () => loadGeneration > startingGeneration
      )
      loadMorePromise = operation.finally(() => {
        loadMorePromise = undefined
      })
    }
    return loadMorePromise
  }

  let headDisconnected = false
  async function loadNew() {
    await enqueue('loadNew', async function (signal: AbortSignal) {
      const knownIds = new Set(items.value.map((item) => item.id))
      const seenIds = new Set(knownIds)
      const newItems: AssetItem[] = []
      let headCursor: string | undefined
      const seenHeadCursors = new Set<string | undefined>()
      for (;;) {
        if (seenHeadCursors.size === MAX_HEAD_PAGES) break
        if (seenHeadCursors.has(headCursor)) break
        seenHeadCursors.add(headCursor)

        const query = headCursor
          ? { after: headCursor }
          : { after: headCursor, limit: 10 }
        const assetResponse = await doQuery(query, signal)
        if (!assetResponse) return

        const { assets, has_more, next_cursor } = assetResponse
        const reachedKnownId = assets.some((asset) => {
          if (knownIds.has(asset.id)) return true
          if (!seenIds.has(asset.id)) {
            seenIds.add(asset.id)
            newItems.push(asset)
          }
          return false
        })
        if (reachedKnownId) {
          items.value.splice(0, 0, ...newItems)
          if (pageState.value === 'failed') pageState.value = 'ready'
          return
        }
        if (!has_more || next_cursor === undefined) break
        headCursor = next_cursor
      }
      headDisconnected = true
    })
    // The head never reached a cached item, so the cache no longer matches
    // the server (ids changed, or too many new items): rebuild it.
    if (!headDisconnected) return
    headDisconnected = false
    await invalidate()
  }

  async function applyInvalidation(stale?: string[]) {
    if (stale) {
      await preempt(() => Promise.resolve())
      const ids = new Set(stale)
      items.value = items.value.filter((item) => !ids.has(item.id))
      return
    }
    await preempt(async () => {
      nextCursor = undefined
      seenCursors.clear()
      items.value = []
      await until(pageState).not.toBe('backing-off')
      pageState.value = 'ready'
      await doLoadMore()
    })
  }

  function invalidate(stale?: string[]) {
    const operation = invalidationQueue.then(() => applyInvalidation(stale))
    invalidationQueue = operation
    return operation
  }

  function markFailed(transient: boolean) {
    const state = pageState.value
    if (state === 'exhausted' || (transient && state === 'failed')) return
    pageState.value = transient ? 'backing-off' : 'failed'
    if (!transient) return
    clearTimeout(backOffTimer)
    backOffTimer = setTimeout(() => {
      if (pageState.value === 'backing-off') pageState.value = 'ready'
    }, 2000)
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
      if (!signal?.aborted) markFailed(true)
      return
    }
    if (!resp.ok) {
      onError('asset request failed', resp)
      markFailed(resp.status === 429 || resp.status >= 500)
      return
    }

    const jsonresp = await resp
      .json()
      .catch((e) => onError('failed to decode asset json response', e))
    if (!jsonresp) {
      markFailed(false)
      return
    }

    const parseResult = assetResponseSchema.safeParse(jsonresp)
    if (!parseResult.success) {
      onError('Failed to parse asset response', fromZodError(parseResult.error))
      markFailed(false)
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
