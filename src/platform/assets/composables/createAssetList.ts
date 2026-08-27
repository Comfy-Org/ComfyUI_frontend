import { ref } from 'vue'
import { fromZodError } from 'zod-validation-error'
import type { ListAssetsData } from '@comfyorg/ingest-types'

import { assetResponseSchema } from '@/platform/assets/schemas/assetSchema'
import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { api } from '@/scripts/api'
import type { PagedList } from '@/utils/pagedList'

type AssetQuery = NonNullable<ListAssetsData['query']>

interface QueryOptions {
  signal?: AbortSignal
  onError?: (reason: string, error?: unknown) => void
}

const BASE_PARAMS: AssetQuery = {
  sort: 'created_at',
  tags_none: ['missing']
}

function toSearchParams(query: AssetQuery): URLSearchParams {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    search.set(
      key,
      Array.isArray(value) ? value.toSorted().join(',') : String(value)
    )
  }
  search.sort()
  return search
}

export function createAssetList(
  params: AssetQuery = {},
  options: QueryOptions = {}
): PagedList<AssetItem> {
  let nextCursor = params.after
  let generation = 0
  let activeController: AbortController | undefined
  let loadMorePromise: Promise<void> | undefined
  let loadNewPromise: Promise<void> | undefined
  let refreshPromise: Promise<void> | undefined
  const seenCursors = new Set<string | undefined>()
  const hasMore = ref(true)
  const isLoading = ref(false)
  const items = ref<AssetItem[]>([])

  const request = async (after: string | undefined, signal: AbortSignal) => {
    const query: AssetQuery = { ...BASE_PARAMS, ...params, after }
    const response = await api.fetchApi(`/assets?${toSearchParams(query)}`, {
      signal: options.signal
        ? AbortSignal.any([signal, options.signal])
        : signal
    })
    if (!response.ok)
      throw new Error(`Asset request failed: ${response.status}`)

    const parsed = assetResponseSchema.safeParse(await response.json())
    if (!parsed.success) throw fromZodError(parsed.error)
    return parsed.data
  }

  const run = async (
    operation: (signal: AbortSignal, run: number) => Promise<void>
  ) => {
    const controller = new AbortController()
    activeController = controller
    const run = generation
    isLoading.value = true
    try {
      await operation(controller.signal, run)
    } catch (error) {
      options.onError?.('asset fetch failed', error)
      throw error
    } finally {
      if (activeController === controller) {
        activeController = undefined
        isLoading.value = false
      }
    }
  }

  const appendPage = async (signal: AbortSignal, run: number) => {
    if (!hasMore.value || seenCursors.has(nextCursor)) {
      hasMore.value = false
      return
    }

    const requestedCursor = nextCursor
    const response = await request(requestedCursor, signal)
    if (run !== generation) return

    seenCursors.add(requestedCursor)
    const knownIds = new Set(items.value.map(({ id }) => id))
    for (const asset of response.assets) {
      if (knownIds.has(asset.id)) continue
      knownIds.add(asset.id)
      items.value.push(asset)
    }
    nextCursor = response.next_cursor
    hasMore.value = response.has_more
    if (hasMore.value && (!nextCursor || seenCursors.has(nextCursor))) {
      hasMore.value = false
    }
  }

  function loadMore(): Promise<void> {
    if (refreshPromise) return refreshPromise
    if (loadMorePromise) return loadMorePromise
    const scheduledGeneration = generation
    const operation = () =>
      scheduledGeneration === generation ? run(appendPage) : Promise.resolve()
    const promise = loadNewPromise
      ? loadNewPromise.catch(() => undefined).then(operation)
      : operation()
    loadMorePromise = promise.finally(() => {
      loadMorePromise = undefined
    })
    return loadMorePromise
  }

  function loadNew(): Promise<void> {
    if (refreshPromise) return refreshPromise
    if (loadNewPromise) return loadNewPromise
    const scheduledGeneration = generation
    const operation = () =>
      scheduledGeneration === generation
        ? run(async (signal, run) => {
            const knownIds = new Set(items.value.map(({ id }) => id))
            const newItems: AssetItem[] = []
            const seen = new Set<string | undefined>()
            let cursor: string | undefined

            while (!seen.has(cursor)) {
              seen.add(cursor)
              const response = await request(cursor, signal)
              if (run !== generation) return
              const reachedKnownItem = response.assets.some(({ id }) =>
                items.value.some((item) => item.id === id)
              )
              for (const asset of response.assets) {
                if (!knownIds.has(asset.id)) {
                  knownIds.add(asset.id)
                  newItems.push(asset)
                }
              }
              if (
                reachedKnownItem ||
                !response.has_more ||
                !response.next_cursor ||
                seen.has(response.next_cursor)
              ) {
                break
              }
              cursor = response.next_cursor
            }
            items.value.unshift(...newItems)
          })
        : Promise.resolve()
    loadNewPromise = (
      loadMorePromise
        ? loadMorePromise.catch(() => undefined).then(operation)
        : operation()
    ).finally(() => {
      loadNewPromise = undefined
    })
    return loadNewPromise
  }

  function invalidate(stale?: string[]): Promise<void> {
    if (stale) {
      const ids = new Set(stale)
      items.value = items.value.filter(({ id }) => !ids.has(id))
      return Promise.resolve()
    }
    if (refreshPromise) return refreshPromise

    generation++
    activeController?.abort()
    hasMore.value = true
    nextCursor = params.after
    seenCursors.clear()
    refreshPromise = run(async (signal, run) => {
      const response = await request(nextCursor, signal)
      if (run !== generation) return
      seenCursors.add(nextCursor)
      items.value = [
        ...new Map(response.assets.map((asset) => [asset.id, asset])).values()
      ]
      nextCursor = response.next_cursor
      hasMore.value = response.has_more
      if (hasMore.value && (!nextCursor || seenCursors.has(nextCursor))) {
        hasMore.value = false
      }
    }).finally(() => {
      refreshPromise = undefined
    })
    return refreshPromise
  }

  return { hasMore, invalidate, isLoading, items, loadMore, loadNew }
}
