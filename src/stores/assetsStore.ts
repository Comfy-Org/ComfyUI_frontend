import { useAsyncState, whenever } from '@vueuse/core'
import { difference } from 'es-toolkit'
import { defineStore } from 'pinia'
import { computed, reactive, ref, shallowReactive } from 'vue'
import {
  mapInputFileToAssetItem,
  mapTaskOutputToAssetItem
} from '@/platform/assets/composables/media/assetMappers'
import type {
  AssetItem,
  TagsOperationResult
} from '@/platform/assets/schemas/assetSchema'
import {
  INPUT_TAG,
  OUTPUT_TAG,
  assetService
} from '@/platform/assets/services/assetService'
import type { PaginationOptions } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import {
  JobsApiError,
  fetchHistoryPage
} from '@/platform/remote/comfyui/jobs/fetchJobs'
import type {
  FetchHistoryPageResult,
  JobsPageRequest
} from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'

import { TaskItemImpl } from './queueStore'
import { useAssetDownloadStore } from './assetDownloadStore'
import { useModelToNodeStore } from './modelToNodeStore'

const INPUT_LIMIT = 100

/**
 * Fetch input files from the internal API (OSS version)
 */
async function fetchInputFilesFromAPI(): Promise<AssetItem[]> {
  const response = await fetch(api.internalURL('/files/input'), {
    headers: {
      'Comfy-User': api.user
    }
  })

  if (!response.ok) {
    throw new Error('Failed to fetch input files')
  }

  const filenames: string[] = await response.json()
  return filenames.map((name, index) =>
    mapInputFileToAssetItem(name, index, 'input')
  )
}

/**
 * Fetch input files from cloud service
 */
async function fetchInputFilesFromCloud(): Promise<AssetItem[]> {
  return await assetService.getAssetsByTag(INPUT_TAG, false, {
    limit: INPUT_LIMIT
  })
}

/**
 * Convert history job items to asset items
 */
function mapHistoryToAssets(historyItems: JobListItem[]): AssetItem[] {
  const assetItems: AssetItem[] = []

  for (const job of historyItems) {
    // Only process completed jobs with preview output
    if (job.status !== 'completed' || !job.preview_output) {
      continue
    }

    const task = new TaskItemImpl(job)

    if (!task.previewOutput) {
      continue
    }

    const assetItem = mapTaskOutputToAssetItem(task, task.previewOutput)

    assetItem.user_metadata = {
      ...assetItem.user_metadata,
      outputCount: task.outputsCount ?? task.previewableOutputs.length,
      allOutputs: task.previewableOutputs
    }

    assetItems.push(assetItem)
  }

  return assetItems.sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
  )
}

const BATCH_SIZE = 200
const MAX_HISTORY_ITEMS = 1000 // Maximum items to keep in memory
const FLAT_OUTPUT_PAGE_SIZE = 200

export const useAssetsStore = defineStore('assets', () => {
  const assetDownloadStore = useAssetDownloadStore()
  const modelToNodeStore = useModelToNodeStore()

  // Track assets currently being deleted (for loading overlay)
  const deletingAssetIds = shallowReactive(new Set<string>())

  const setAssetDeleting = (assetId: string, isDeleting: boolean) => {
    if (isDeleting) {
      deletingAssetIds.add(assetId)
    } else {
      deletingAssetIds.delete(assetId)
    }
  }

  const isAssetDeleting = (assetId: string): boolean => {
    return deletingAssetIds.has(assetId)
  }

  // History pagination state
  const historyOffset = ref(0)
  const historyNextCursor = ref<string | null>(null)
  const hasMoreHistory = ref(true)
  const isLoadingMore = ref(false)

  const allHistoryItems = ref<AssetItem[]>([])

  const loadedIds = shallowReactive(new Set<string>())

  // Ids of every raw job walked so far, including ones that map to no
  // displayable asset (failed, cancelled, preview-less). Head-refresh gap
  // detection needs the full set: a burst of non-asset jobs at the top would
  // otherwise never overlap `loadedIds` and trigger a needless full reload.
  const loadedJobIds = new Set<string>()

  const fetchInputFiles = isCloud
    ? fetchInputFilesFromCloud
    : fetchInputFilesFromAPI

  const {
    state: inputAssets,
    isLoading: inputLoading,
    error: inputError,
    execute: executeUpdateInputs
  } = useAsyncState(fetchInputFiles, [], {
    immediate: false,
    resetOnExecute: false,
    onError: (err) => {
      console.error('Error fetching input assets:', err)
    }
  })

  const updateInputs = async () => {
    const result = await executeUpdateInputs()
    assetService.invalidateInputAssetsIncludingPublic()
    return result
  }

  /**
   * Insert assets in sorted order (newest first), skipping already-loaded ids
   */
  const mergeHistoryAssets = (newAssets: AssetItem[]) => {
    for (const asset of newAssets) {
      if (loadedIds.has(asset.id)) {
        continue
      }
      loadedIds.add(asset.id)

      const assetTime = new Date(asset.created_at ?? 0).getTime()
      // `<=` keeps same-timestamp ordering consistent with the initial
      // newest-first sort: new items land before existing equal-time items.
      const insertIndex = allHistoryItems.value.findIndex(
        (item) => new Date(item.created_at ?? 0).getTime() <= assetTime
      )

      if (insertIndex === -1) {
        allHistoryItems.value.push(asset)
      } else {
        allHistoryItems.value.splice(insertIndex, 0, asset)
      }
    }
  }

  const trimHistoryToLimit = () => {
    if (allHistoryItems.value.length <= MAX_HISTORY_ITEMS) return

    const removed = allHistoryItems.value.slice(MAX_HISTORY_ITEMS)
    allHistoryItems.value = allHistoryItems.value.slice(0, MAX_HISTORY_ITEMS)
    removed.forEach((item) => loadedIds.delete(item.id))
  }

  const fetchHistoryJobsPage = (page: JobsPageRequest) =>
    fetchHistoryPage(api.fetchApi.bind(api), BATCH_SIZE, page)

  // Invalidates in-flight history fetches whenever the list is replaced, so
  // a stale continuation can't merge into (or move the cursor of) the new walk.
  let historyFetchEpoch = 0

  // True once any `next_cursor` has been received in the current walk epoch;
  // stays true even after the cursor exhausts (`historyNextCursor` back to
  // null), so head-refresh merges keep preserving scroll-loaded items
  // instead of replacing them.
  let hadCursorThisWalk = false

  const isRejectedCursorError = (err: unknown): boolean =>
    err instanceof JobsApiError && err.status === 400

  const fetchHistoryPageWithCursorRecovery = async (
    after: string | null,
    epoch: number
  ): Promise<FetchHistoryPageResult> => {
    if (after == null)
      return fetchHistoryJobsPage({ offset: historyOffset.value })
    try {
      return await fetchHistoryJobsPage({ after })
    } catch (err) {
      // Drop only a rejected cursor (e.g. stale across a restart) to the
      // offset fallback; transient failures and superseded-walk
      // continuations must propagate so a valid/newer cursor isn't lost.
      if (!isRejectedCursorError(err) || epoch !== historyFetchEpoch) throw err
      console.warn('Stale history cursor rejected, resuming via offset:', err)
      historyNextCursor.value = null
      hadCursorThisWalk = false
      historyOffset.value = 0
      const page = await fetchHistoryJobsPage({ offset: 0 })
      // The destructive reset waits until the fallback page is in hand, so a
      // failed fallback leaves the loaded list intact instead of stranding
      // `historyAssets` with no backing items.
      if (epoch === historyFetchEpoch) {
        allHistoryItems.value = []
        loadedIds.clear()
        loadedJobIds.clear()
      }
      return page
    }
  }

  /**
   * Fetch one page of history assets and update reactive state.
   *
   * Pagination model: the server starts in offset mode and mints a
   * `next_cursor` on any page that has one; subsequent requests pass that
   * cursor (keyset mode). The walk upgrades automatically — offset paging is
   * only used until the first cursor is received.
   *
   * `hasMoreHistory` mirrors the server's `has_more`, with two local terminal
   * overrides: an empty page with no cursor (offset paging would refetch the
   * same page forever) and a cursor that hasn't advanced — the server echoed
   * back the value it was given (an infinite dedup loop otherwise).
   *
   * @param loadMore - When `true`, appends the next page to the existing list
   *   (infinite-scroll continuation). When `false` (default), resets all
   *   pagination state and replaces the list with the first page.
   * @returns The current accumulated list of history asset items.
   */
  const fetchHistoryAssets = async (loadMore = false): Promise<AssetItem[]> => {
    if (!loadMore) {
      historyFetchEpoch += 1
      historyOffset.value = 0
      historyNextCursor.value = null
      hadCursorThisWalk = false
      hasMoreHistory.value = true
      allHistoryItems.value = []
      loadedIds.clear()
      loadedJobIds.clear()
    }

    const epoch = historyFetchEpoch
    const requestedAfter = loadMore ? historyNextCursor.value : null
    const page = await fetchHistoryPageWithCursorRecovery(requestedAfter, epoch)
    if (epoch !== historyFetchEpoch) return allHistoryItems.value

    page.jobs.forEach((job) => loadedJobIds.add(job.id))
    const newAssets = mapHistoryToAssets(page.jobs)

    if (loadMore) {
      mergeHistoryAssets(newAssets)
    } else {
      allHistoryItems.value = newAssets
      newAssets.forEach((asset) => loadedIds.add(asset.id))
    }

    const cursorStuck =
      page.nextCursor != null && page.nextCursor === requestedAfter
    if (page.nextCursor != null) hadCursorThisWalk = true
    // The server ignores `offset` once the walk is keyset-paginated, so only
    // advance it while still in offset mode; otherwise the offset used by the
    // recovery fallback would drift past valid rows.
    if (!hadCursorThisWalk) historyOffset.value += page.jobs.length
    hasMoreHistory.value =
      page.hasMore &&
      !cursorStuck &&
      (page.jobs.length > 0 || page.nextCursor != null)
    // Drop the cursor once paging terminates so state never carries a live
    // cursor alongside `hasMoreHistory === false`.
    historyNextCursor.value = hasMoreHistory.value
      ? (page.nextCursor ?? null)
      : null

    trimHistoryToLimit()

    return allHistoryItems.value
  }

  const historyAssets = ref<AssetItem[]>([])
  const historyLoading = ref(false)
  const historyError = ref<unknown>(null)

  /**
   * Initial load of history assets
   */
  const updateHistory = async () => {
    historyLoading.value = true
    historyError.value = null
    try {
      await fetchHistoryAssets(false)
      historyAssets.value = allHistoryItems.value
    } catch (err) {
      console.error('Error fetching history assets:', err)
      historyError.value = err
    } finally {
      historyLoading.value = false
    }
  }

  /**
   * Load more history items (infinite scroll)
   */
  const loadMoreHistory = async () => {
    // Guard: prevent concurrent loads and check if more items available
    if (!hasMoreHistory.value || isLoadingMore.value) return

    isLoadingMore.value = true
    historyError.value = null

    const epoch = historyFetchEpoch
    try {
      await fetchHistoryAssets(true)
      if (epoch !== historyFetchEpoch) return
      historyAssets.value = allHistoryItems.value
    } catch (err) {
      if (epoch !== historyFetchEpoch) return
      console.error('Error loading more history:', err)
      historyError.value = err
    } finally {
      isLoadingMore.value = false
    }
  }

  /**
   * Replaces local history state with the given head page. Called either when
   * the page spans the whole timeline (`!hasMore`) — which also prunes jobs
   * deleted server-side (e.g. after the queue history is cleared from another
   * surface) — or when rebuilding from the top in offset mode.
   *
   * Bumps `historyFetchEpoch`, which cancels any concurrent
   * `loadMoreHistory`/`fetchHistoryAssets` continuation.
   */
  const replaceHistoryWithHeadPage = (page: FetchHistoryPageResult) => {
    historyFetchEpoch += 1
    const newAssets = mapHistoryToAssets(page.jobs)
    allHistoryItems.value = newAssets
    loadedIds.clear()
    newAssets.forEach((asset) => loadedIds.add(asset.id))
    loadedJobIds.clear()
    page.jobs.forEach((job) => loadedJobIds.add(job.id))
    historyOffset.value = page.jobs.length
    historyNextCursor.value = page.nextCursor ?? null
    hadCursorThisWalk = page.nextCursor != null
    hasMoreHistory.value = page.hasMore
  }

  let headRefreshInFlight: Promise<void> | null = null
  let headRefreshTrailing: Promise<void> | null = null

  /**
   * Merge newly completed jobs into the top of the list without resetting
   * pagination state, so items loaded via infinite scroll survive the
   * refresh. Cursors only walk toward older items, so new completions are
   * picked up by re-fetching the head page and deduplicating. Bursts of
   * status events share the in-flight refresh, and a call arriving
   * mid-flight schedules exactly one trailing refresh — the shared response
   * was dispatched before that caller's event, so it could miss the very
   * completion the caller is reacting to.
   *
   * Never rejects: failures are recorded in `historyError`.
   */
  const refreshHistoryHead = (): Promise<void> => {
    if (!headRefreshInFlight) {
      headRefreshInFlight = doRefreshHistoryHead().finally(() => {
        headRefreshInFlight = null
      })
      return headRefreshInFlight
    }
    // Re-entering refreshHistoryHead (not doRefreshHistoryHead) lets callers
    // arriving during the trailing window join the next leading slot.
    headRefreshTrailing ??= headRefreshInFlight.then(() => {
      headRefreshTrailing = null
      return refreshHistoryHead()
    })
    return headRefreshTrailing
  }

  const doRefreshHistoryHead = async () => {
    historyError.value = null
    if (!allHistoryItems.value.length) {
      await updateHistory()
      return
    }

    let epoch = historyFetchEpoch
    try {
      const page = await fetchHistoryJobsPage({ offset: 0 })
      if (epoch !== historyFetchEpoch) return

      const reachesLoadedItems = page.jobs.some((job) =>
        loadedJobIds.has(job.id)
      )
      // The head page didn't reach any already-loaded item and the server
      // still has more rows: the gap between the new head and the loaded list
      // can't be filled by merging, so restart the walk from scratch.
      if (page.hasMore && !reachesLoadedItems) {
        await updateHistory()
        return
      }

      // Merging only preserves scroll-loaded items safely in cursor mode,
      // including once the cursor has exhausted (historyNextCursor is null but
      // the loaded terminal pages must survive). In offset fallback mode,
      // prepending new head rows without advancing historyOffset would drift
      // the next offset request (the server timeline shifted down by the new
      // completions), so rebuild from the head page — which resets
      // historyOffset to a position consistent with that page.
      if (page.hasMore && hadCursorThisWalk) {
        page.jobs.forEach((job) => loadedJobIds.add(job.id))
        mergeHistoryAssets(mapHistoryToAssets(page.jobs))
        trimHistoryToLimit()
      } else {
        replaceHistoryWithHeadPage(page)
        // replaceHistoryWithHeadPage bumps the epoch; re-sync so the catch
        // guard below suppresses stale continuations, not genuine errors.
        epoch = historyFetchEpoch
      }
      historyAssets.value = allHistoryItems.value
    } catch (err) {
      if (epoch !== historyFetchEpoch) return
      console.error('Error refreshing history:', err)
      historyError.value = err
    }
  }

  const flatOutputAssets = ref<AssetItem[]>([])
  const flatOutputLoading = ref(false)
  const flatOutputError = ref<unknown>(null)
  const flatOutputOffset = ref(0)
  const flatOutputHasMore = ref(true)
  const flatOutputIsLoadingMore = ref(false)
  const flatOutputSeenIds = new Set<string>()
  let flatOutputNextCursor: string | undefined
  let flatOutputInFlight: Promise<AssetItem[]> | null = null

  async function fetchFlatOutputs(loadMore: boolean): Promise<AssetItem[]> {
    if (flatOutputInFlight) return flatOutputInFlight

    if (loadMore) {
      if (!flatOutputHasMore.value) return flatOutputAssets.value
      flatOutputIsLoadingMore.value = true
    } else {
      flatOutputLoading.value = true
      flatOutputOffset.value = 0
      flatOutputNextCursor = undefined
      flatOutputHasMore.value = true
      flatOutputSeenIds.clear()
    }
    flatOutputError.value = null

    flatOutputInFlight = (async () => {
      const requestedAfter = loadMore ? flatOutputNextCursor : undefined
      try {
        const page = await assetService.getAssetsPageByTag(OUTPUT_TAG, true, {
          limit: FLAT_OUTPUT_PAGE_SIZE,
          ...(requestedAfter
            ? { after: requestedAfter }
            : { offset: flatOutputOffset.value })
        })
        const batch = page.assets
        const fresh = loadMore
          ? batch.filter((asset) => !flatOutputSeenIds.has(asset.id))
          : batch
        for (const asset of fresh) flatOutputSeenIds.add(asset.id)
        flatOutputAssets.value = loadMore
          ? [...flatOutputAssets.value, ...fresh]
          : batch
        flatOutputOffset.value += batch.length
        const nextCursor = page.next_cursor || undefined
        const cursorStuck =
          nextCursor !== undefined && nextCursor === requestedAfter
        flatOutputNextCursor = cursorStuck ? undefined : nextCursor
        flatOutputHasMore.value =
          fresh.length > 0 && page.has_more && !cursorStuck
        return flatOutputAssets.value
      } catch (err) {
        flatOutputError.value = err
        console.error('Failed to fetch output assets:', err)
        return loadMore ? flatOutputAssets.value : []
      } finally {
        if (loadMore) flatOutputIsLoadingMore.value = false
        else flatOutputLoading.value = false
        flatOutputInFlight = null
      }
    })()

    return flatOutputInFlight
  }

  const updateFlatOutputs = () => fetchFlatOutputs(false)
  const loadMoreFlatOutputs = async () => {
    if (flatOutputIsLoadingMore.value) return
    await fetchFlatOutputs(true)
  }

  /**
   * Patch preview_id/preview_url for a single asset already in memory,
   * matched by name. Used after persistThumbnail succeeds so an open Asset
   * panel reflects the new thumbnail without refetching the whole history.
   * Match by name because the cloud assets API and the history API use
   * different id spaces; name is the stable cross-API identifier.
   */
  const setAssetPreview = (
    name: string,
    previewId: string,
    previewUrl: string
  ) => {
    const patch = (list: AssetItem[]) => {
      const idx = list.findIndex((a) => a.name === name)
      if (idx < 0) return
      list[idx] = {
        ...list[idx],
        preview_id: previewId,
        preview_url: previewUrl
      }
    }
    patch(historyAssets.value)
    patch(allHistoryItems.value)
    patch(inputAssets.value)
  }

  /**
   * Map of asset hash filename to asset item for O(1) lookup
   * Cloud assets use hash for the hash-based filename
   */
  const inputAssetsByFilename = computed(() => {
    const map = new Map<string, AssetItem>()
    for (const asset of inputAssets.value) {
      const hash = asset.hash
      if (hash) {
        map.set(hash, asset)
      }
    }
    return map
  })

  /**
   * @param filename Hash-based filename (e.g., "72e786ff...efb7.png")
   * @returns Human-readable asset name or original filename if not found
   */
  function getInputName(filename: string): string {
    return inputAssetsByFilename.value.get(filename)?.name ?? filename
  }

  const MODEL_BATCH_SIZE = 500

  interface ModelPaginationState {
    assets: Map<string, AssetItem>
    offset: number
    hasMore: boolean
    isLoading: boolean
    error?: Error
  }

  /**
   * Model assets cached by category (e.g., 'checkpoints', 'loras')
   * Multiple node types sharing the same category share the same cache entry.
   * Public API accepts nodeType for backwards compatibility but translates
   * to category internally using modelToNodeStore.getCategoryForNodeType().
   * Cloud-only feature - empty Maps in desktop builds
   */
  const getModelState = () => {
    if (isCloud) {
      const modelStateByCategory = ref(new Map<string, ModelPaginationState>())

      const assetsArrayCache = new Map<
        string,
        { source: Map<string, AssetItem>; array: AssetItem[] }
      >()

      const pendingRequestByCategory = new Map<string, ModelPaginationState>()
      const pendingPromiseByCategory = new Map<string, Promise<void>>()

      function createState(
        existingAssets?: Map<string, AssetItem>
      ): ModelPaginationState {
        const assets = new Map(existingAssets)
        return reactive({
          assets,
          offset: 0,
          hasMore: true,
          isLoading: true
        })
      }

      function isStale(category: string, state: ModelPaginationState): boolean {
        const committed = modelStateByCategory.value.get(category)
        const pending = pendingRequestByCategory.get(category)
        return committed !== state && pending !== state
      }

      const EMPTY_ASSETS: AssetItem[] = []

      /**
       * Resolve a key to a category. Handles both nodeType and tag:xxx formats.
       * @param key Either a nodeType (e.g., 'CheckpointLoaderSimple') or tag key (e.g., 'tag:models')
       * @returns The category or undefined if not resolvable
       */
      function resolveCategory(key: string): string | undefined {
        if (key.startsWith('tag:')) {
          return key
        }
        return modelToNodeStore.getCategoryForNodeType(key)
      }

      /**
       * Get assets by nodeType or tag key.
       * Translates nodeType to category internally for cache lookup.
       * @param key Either a nodeType (e.g., 'CheckpointLoaderSimple') or tag key (e.g., 'tag:models')
       */
      function getAssets(key: string): AssetItem[] {
        const category = resolveCategory(key)
        if (!category) return EMPTY_ASSETS

        const state = modelStateByCategory.value.get(category)
        const assetsMap = state?.assets
        if (!assetsMap) return EMPTY_ASSETS

        const cached = assetsArrayCache.get(category)
        if (cached && cached.source === assetsMap) {
          return cached.array
        }

        const array = Array.from(assetsMap.values())
        assetsArrayCache.set(category, { source: assetsMap, array })
        return array
      }

      function isLoading(key: string): boolean {
        const category = resolveCategory(key)
        if (!category) return false
        return modelStateByCategory.value.get(category)?.isLoading ?? false
      }

      function getError(key: string): Error | undefined {
        const category = resolveCategory(key)
        if (!category) return undefined
        return modelStateByCategory.value.get(category)?.error
      }

      function hasMore(key: string): boolean {
        const category = resolveCategory(key)
        if (!category) return false
        return modelStateByCategory.value.get(category)?.hasMore ?? false
      }

      function hasAssetKey(key: string): boolean {
        const category = resolveCategory(key)
        if (!category) return false
        return modelStateByCategory.value.has(category)
      }

      /**
       * Check if a category exists in the cache.
       * Checks both direct category keys and tag-prefixed keys.
       * @param category The category to check (e.g., 'checkpoints', 'loras')
       */
      function hasCategory(category: string): boolean {
        return (
          modelStateByCategory.value.has(category) ||
          modelStateByCategory.value.has(`tag:${category}`)
        )
      }

      /**
       * Internal helper to fetch and cache assets for a category.
       * Loads first batch immediately, then progressively loads remaining batches.
       * Keeps existing data visible until new data is successfully fetched.
       *
       * Concurrent calls for the same category are short-circuited: if a request
       * is already in progress (tracked via pendingRequestByCategory), subsequent
       * calls return immediately to avoid redundant work.
       */
      async function updateModelsForCategory(
        category: string,
        fetcher: (options: PaginationOptions) => Promise<AssetItem[]>
      ): Promise<void> {
        if (pendingPromiseByCategory.has(category)) {
          return pendingPromiseByCategory.get(category)!
        }

        const existingState = modelStateByCategory.value.get(category)
        const state = createState(existingState?.assets)

        const seenIds = new Set<string>()

        const hasExistingData = modelStateByCategory.value.has(category)
        if (hasExistingData) {
          pendingRequestByCategory.set(category, state)
        } else {
          // Also track in pending map for initial loads to prevent concurrent calls
          pendingRequestByCategory.set(category, state)
          modelStateByCategory.value.set(category, state)
        }

        async function loadBatches(): Promise<void> {
          while (state.hasMore) {
            try {
              const newAssets = await fetcher({
                limit: MODEL_BATCH_SIZE,
                offset: state.offset
              })

              if (isStale(category, state)) return

              const isFirstBatch = state.offset === 0
              if (isFirstBatch) {
                assetsArrayCache.delete(category)
                if (hasExistingData) {
                  pendingRequestByCategory.delete(category)
                  modelStateByCategory.value.set(category, state)
                }
              }

              // Merge new assets into existing map and track seen IDs
              for (const asset of newAssets) {
                seenIds.add(asset.id)
                state.assets.set(asset.id, asset)
              }
              state.assets = new Map(state.assets)

              state.offset += newAssets.length
              state.hasMore = newAssets.length === MODEL_BATCH_SIZE

              if (isFirstBatch) {
                state.isLoading = false
              }

              if (state.hasMore) {
                await new Promise((resolve) => setTimeout(resolve, 50))
              }
            } catch (err) {
              if (isStale(category, state)) return
              console.error(`Error loading batch for ${category}:`, err)

              state.error = err instanceof Error ? err : new Error(String(err))
              state.hasMore = false
              state.isLoading = false
              pendingRequestByCategory.delete(category)

              return
            }
          }

          const staleIds = [...state.assets.keys()].filter(
            (id) => !seenIds.has(id)
          )
          for (const id of staleIds) {
            state.assets.delete(id)
          }
          assetsArrayCache.delete(category)
          pendingRequestByCategory.delete(category)
        }

        const promise = loadBatches().finally(() => {
          pendingPromiseByCategory.delete(category)
        })
        pendingPromiseByCategory.set(category, promise)
        await promise
      }

      /**
       * Fetch and cache model assets for a specific node type.
       * Translates nodeType to category internally - multiple node types
       * sharing the same category will share the same cache entry.
       * @param nodeType The node type to fetch assets for (e.g., 'CheckpointLoaderSimple')
       */
      async function updateModelsForNodeType(nodeType: string): Promise<void> {
        const category = modelToNodeStore.getCategoryForNodeType(nodeType)
        if (!category) return

        // Use category as cache key but fetch using nodeType for API compatibility
        await updateModelsForCategory(category, (opts) =>
          assetService.getAssetsForNodeType(nodeType, opts)
        )
      }

      /**
       * Fetch and cache model assets for a specific tag
       * @param tag The tag to fetch assets for (e.g., 'models')
       */
      async function updateModelsForTag(tag: string): Promise<void> {
        const category = `tag:${tag}`
        await updateModelsForCategory(category, (opts) =>
          assetService.getAssetsByTag(tag, true, opts)
        )
      }

      /**
       * Invalidate the cache for a specific category.
       * Forces a refetch on next access.
       * @param category The category to invalidate (e.g., 'checkpoints', 'loras')
       */
      function invalidateCategory(category: string): void {
        modelStateByCategory.value.delete(category)
        assetsArrayCache.delete(category)
        pendingRequestByCategory.delete(category)
        pendingPromiseByCategory.delete(category)
      }

      /**
       * Optimistically update an asset in the cache
       * @param assetId The asset ID to update
       * @param updates Partial asset data to merge
       * @param cacheKey Optional cache key to target (nodeType or 'tag:xxx')
       */
      function updateAssetInCache(
        assetId: string,
        updates: Partial<AssetItem>,
        cacheKey?: string
      ) {
        const category = cacheKey ? resolveCategory(cacheKey) : undefined
        if (cacheKey && !category) return

        const categoriesToCheck = category
          ? [category]
          : Array.from(modelStateByCategory.value.keys())

        for (const cat of categoriesToCheck) {
          const state = modelStateByCategory.value.get(cat)
          if (!state?.assets) continue

          const existingAsset = state.assets.get(assetId)
          if (existingAsset) {
            const updatedAsset = { ...existingAsset, ...updates }
            state.assets.set(assetId, updatedAsset)
            assetsArrayCache.delete(cat)
            if (cacheKey) return
          }
        }
      }

      /**
       * Update asset metadata with optimistic cache update
       * @param asset The asset to update
       * @param userMetadata The user_metadata to save
       * @param cacheKey Optional cache key to target for optimistic update
       */
      async function updateAssetMetadata(
        asset: AssetItem,
        userMetadata: Record<string, unknown>,
        cacheKey?: string
      ) {
        const originalMetadata = asset.user_metadata
        updateAssetInCache(asset.id, { user_metadata: userMetadata }, cacheKey)

        try {
          const updatedAsset = await assetService.updateAsset(asset.id, {
            user_metadata: userMetadata
          })
          updateAssetInCache(asset.id, updatedAsset, cacheKey)
        } catch (error) {
          console.error('Failed to update asset metadata:', error)
          updateAssetInCache(
            asset.id,
            { user_metadata: originalMetadata },
            cacheKey
          )
        }
      }

      /**
       * Update asset tags using add/remove endpoints
       * @param asset The asset to update (used to read current tags)
       * @param newTags The desired tags array
       * @param cacheKey Optional cache key to target for optimistic update
       */
      async function updateAssetTags(
        asset: AssetItem,
        newTags: string[],
        cacheKey?: string
      ) {
        const originalTags = asset.tags
        const tagsToAdd = difference(newTags, originalTags)
        const tagsToRemove = difference(originalTags, newTags)

        if (tagsToAdd.length === 0 && tagsToRemove.length === 0) return

        updateAssetInCache(asset.id, { tags: newTags }, cacheKey)

        let removedTagsOnServer: string[] = []
        try {
          let removeResult: TagsOperationResult | undefined
          if (tagsToRemove.length > 0) {
            removeResult = await assetService.removeAssetTags(
              asset.id,
              tagsToRemove
            )
            removedTagsOnServer = removeResult.removed ?? tagsToRemove
          }

          const addResult =
            tagsToAdd.length > 0
              ? await assetService.addAssetTags(asset.id, tagsToAdd)
              : undefined

          const finalTags = (addResult ?? removeResult)?.total_tags
          if (finalTags) {
            updateAssetInCache(asset.id, { tags: finalTags }, cacheKey)
          }
        } catch (error) {
          console.error('Failed to update asset tags:', error)
          updateAssetInCache(asset.id, { tags: originalTags }, cacheKey)

          if (removedTagsOnServer.length > 0) {
            try {
              await assetService.addAssetTags(asset.id, removedTagsOnServer)
            } catch (compensationError) {
              console.error(
                'Failed to restore tags after partial failure; invalidating cache to force refetch:',
                compensationError
              )
              const categoriesToInvalidate = new Set<string>()
              const resolved = cacheKey ? resolveCategory(cacheKey) : undefined
              if (resolved) {
                categoriesToInvalidate.add(resolved)
              }
              for (const [
                category,
                state
              ] of modelStateByCategory.value.entries()) {
                if (state.assets?.has(asset.id)) {
                  categoriesToInvalidate.add(category)
                }
              }
              for (const category of categoriesToInvalidate) {
                invalidateCategory(category)
              }
            }
          }
        }
      }

      /**
       * Invalidate model caches for a given category (e.g., 'checkpoints', 'loras')
       * Clears the category cache and tag-based caches so next access triggers refetch
       * @param category The model category to invalidate (e.g., 'checkpoints')
       */
      function invalidateModelsForCategory(category: string): void {
        invalidateCategory(category)
        invalidateCategory(`tag:${category}`)
        invalidateCategory('tag:models')
      }

      return {
        getAssets,
        isLoading,
        getError,
        hasMore,
        hasAssetKey,
        hasCategory,
        updateModelsForNodeType,
        updateModelsForTag,
        invalidateCategory,
        updateAssetMetadata,
        updateAssetTags,
        invalidateModelsForCategory
      }
    }

    const emptyAssets: AssetItem[] = []
    return {
      getAssets: () => emptyAssets,
      isLoading: () => false,
      getError: () => undefined,
      hasMore: () => false,
      hasAssetKey: () => false,
      hasCategory: () => false,
      updateModelsForNodeType: async () => {},
      invalidateCategory: () => {},
      updateModelsForTag: async () => {},
      updateAssetMetadata: async () => {},
      updateAssetTags: async () => {},
      invalidateModelsForCategory: () => {}
    }
  }

  const {
    getAssets,
    isLoading: isModelLoading,
    getError,
    hasMore,
    hasAssetKey,
    hasCategory,
    updateModelsForNodeType,
    updateModelsForTag,
    invalidateCategory,
    updateAssetMetadata,
    updateAssetTags,
    invalidateModelsForCategory
  } = getModelState()

  // Watch for completed downloads and refresh model caches
  whenever(
    () => assetDownloadStore.lastCompletedDownload,
    async (latestDownload) => {
      const { modelType } = latestDownload

      const providers = modelToNodeStore
        .getAllNodeProviders(modelType)
        .filter((provider) => provider.nodeDef?.name)

      const nodeTypeUpdates = providers.map((provider) =>
        updateModelsForNodeType(provider.nodeDef.name).then(
          () => provider.nodeDef.name
        )
      )

      // Also update by tag in case modal was opened with assetType
      const tagUpdates = [
        updateModelsForTag(modelType),
        updateModelsForTag('models')
      ]

      const results = await Promise.allSettled([
        ...nodeTypeUpdates,
        ...tagUpdates
      ])

      for (const result of results) {
        if (result.status === 'rejected') {
          console.error(
            `Failed to refresh model cache for provider: ${result.reason}`
          )
        }
      }
    }
  )

  return {
    // States
    inputAssets,
    historyAssets,
    inputLoading,
    historyLoading,
    inputError,
    historyError,
    hasMoreHistory,
    isLoadingMore,

    // Deletion tracking
    deletingAssetIds,
    setAssetDeleting,
    isAssetDeleting,

    // Actions
    updateInputs,
    updateHistory,
    loadMoreHistory,
    refreshHistoryHead,
    setAssetPreview,

    // Flat output assets (cloud-only, tag-based)
    flatOutputAssets,
    flatOutputLoading,
    flatOutputError,
    flatOutputHasMore,
    flatOutputIsLoadingMore,
    updateFlatOutputs,
    loadMoreFlatOutputs,

    // Input mapping helpers
    inputAssetsByFilename,
    getInputName,

    // Model assets - accessors
    getAssets,
    isModelLoading,
    getError,
    hasMore,
    hasAssetKey,
    hasCategory,

    // Model assets - actions
    updateModelsForNodeType,
    updateModelsForTag,
    invalidateCategory,
    updateAssetMetadata,
    updateAssetTags,
    invalidateModelsForCategory
  }
})
