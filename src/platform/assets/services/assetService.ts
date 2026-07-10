import { fromZodError } from 'zod-validation-error'
import { z } from 'zod'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { st } from '@/i18n'

import {
  assetFilenameSchema,
  assetItemSchema,
  assetResponseSchema,
  asyncUploadResponseSchema,
  tagsOperationResultSchema
} from '@/platform/assets/schemas/assetSchema'
import type {
  AssetId,
  AssetItem,
  AssetMetadata,
  AssetResponse,
  AssetUpdatePayload,
  AsyncUploadResponse,
  ModelFile,
  TagsOperationResult
} from '@/platform/assets/schemas/assetSchema'
import { getAssetFilename } from '@/platform/assets/utils/assetMetadataUtils'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

export interface PaginationOptions {
  limit?: number
  offset?: number
}

export interface AssetPaginationOptions extends PaginationOptions {
  /**
   * Opaque keyset cursor from a prior response's `next_cursor`. When set, the
   * server resumes after that cursor and `offset` is ignored.
   */
  after?: string
  signal?: AbortSignal
}

interface AssetRequestOptions extends PaginationOptions {
  includeTags: string[]
  excludeTags?: string[]
  includePublic?: boolean
  after?: string
  signal?: AbortSignal
}

interface AssetExportOptions {
  job_ids?: string[]
  asset_ids?: AssetId[]
  naming_strategy?:
    | 'group_by_job_id'
    | 'group_by_job_time'
    | 'preserve'
    | 'asset_id'
  job_asset_name_filters?: Record<string, string[]>
  include_previews?: boolean
}

/**
 * Maps CivitAI validation error codes to localized error messages
 */
function getLocalizedErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    // Validation errors
    FILE_TOO_LARGE: st('assetBrowser.errorFileTooLarge', 'File too large'),
    FORMAT_NOT_ALLOWED: st(
      'assetBrowser.errorFormatNotAllowed',
      'Format not allowed'
    ),
    UNSAFE_PICKLE_SCAN: st(
      'assetBrowser.errorUnsafePickleScan',
      'Unsafe pickle scan'
    ),
    UNSAFE_VIRUS_SCAN: st(
      'assetBrowser.errorUnsafeVirusScan',
      'Unsafe virus scan'
    ),
    MODEL_TYPE_NOT_SUPPORTED: st(
      'assetBrowser.errorModelTypeNotSupported',
      'Model type not supported'
    ),

    // HTTP 400 - Bad Request
    INVALID_URL: st('assetBrowser.errorInvalidUrl', 'Please provide a URL.'),
    INVALID_URL_FORMAT: st(
      'assetBrowser.errorInvalidUrlFormat',
      'The URL format is invalid. Please check and try again.'
    ),
    UNSUPPORTED_SOURCE: st(
      'assetBrowser.errorUnsupportedSource',
      'This URL is not supported. Only Hugging Face and Civitai URLs are allowed.'
    ),

    // HTTP 401 - Unauthorized
    UNAUTHORIZED: st(
      'assetBrowser.errorUnauthorized',
      'Please sign in to continue.'
    ),

    // HTTP 422 - External Source Errors
    USER_TOKEN_INVALID: st(
      'assetBrowser.errorUserTokenInvalid',
      'Your stored API token is invalid or expired. Please update your token in settings.'
    ),
    USER_TOKEN_ACCESS_DENIED: st(
      'assetBrowser.errorUserTokenAccessDenied',
      'Your API token does not have access to this resource. Please check your token permissions.'
    ),
    UNAUTHORIZED_SOURCE: st(
      'assetBrowser.errorUnauthorizedSource',
      'This resource requires authentication. Please add your API token in settings.'
    ),
    ACCESS_FORBIDDEN: st(
      'assetBrowser.errorAccessForbidden',
      'Access to this resource is forbidden.'
    ),
    RESOURCE_NOT_FOUND: st(
      'assetBrowser.errorResourceNotFound',
      'The file was not found. Please check the URL and try again.'
    ),
    RATE_LIMITED: st(
      'assetBrowser.errorRateLimited',
      'Too many requests. Please try again in a few minutes.'
    ),
    SOURCE_SERVER_ERROR: st(
      'assetBrowser.errorSourceServerError',
      'The source server is experiencing issues. Please try again later.'
    ),
    NETWORK_TIMEOUT: st(
      'assetBrowser.errorNetworkTimeout',
      'Request timed out. Please try again.'
    ),
    CONNECTION_REFUSED: st(
      'assetBrowser.errorConnectionRefused',
      'Unable to connect to the source. Please try again later.'
    ),
    INVALID_HOST: st(
      'assetBrowser.errorInvalidHost',
      'The source URL hostname could not be resolved.'
    ),
    NETWORK_ERROR: st(
      'assetBrowser.errorNetworkError',
      'A network error occurred. Please check your connection and try again.'
    ),
    REQUEST_CANCELLED: st(
      'assetBrowser.errorRequestCancelled',
      'Request was cancelled.'
    ),
    DOWNLOAD_CANCELLED: st(
      'assetBrowser.errorDownloadCancelled',
      'Download was cancelled.'
    ),
    METADATA_FETCH_FAILED: st(
      'assetBrowser.errorMetadataFetchFailed',
      'Failed to fetch file information from the source.'
    ),
    HTTP_ERROR: st(
      'assetBrowser.errorHttpError',
      'An error occurred while fetching metadata.'
    ),

    // HTTP 500 - Internal Server Errors
    SERVICE_UNAVAILABLE: st(
      'assetBrowser.errorServiceUnavailable',
      'Service temporarily unavailable. Please try again later.'
    ),
    INTERNAL_ERROR: st(
      'assetBrowser.errorInternalError',
      'An unexpected error occurred. Please try again.'
    )
  }
  return (
    errorMessages[errorCode] ||
    st('assetBrowser.errorUnknown', 'Unknown error') ||
    'Unknown error'
  )
}

const ASSETS_ENDPOINT = '/assets'
const ASSETS_SEED_ENDPOINT = '/assets/seed'
const ASSETS_DOWNLOAD_ENDPOINT = '/assets/download'
const ASSETS_EXPORT_ENDPOINT = '/assets/export'
const EXPERIMENTAL_WARNING = `EXPERIMENTAL: If you are seeing this please make sure "Comfy.Assets.UseAssetAPI" is set to "false" in your ComfyUI Settings.\n`
const DEFAULT_LIMIT = 500
const INPUT_ASSETS_WITH_PUBLIC_LIMIT = 500

export const MODELS_TAG = 'models'
/** Prefix for the namespaced tag that carries a model's folder category, e.g. `model_type:checkpoints`. */
const MODEL_TYPE_TAG_PREFIX = 'model_type:'
export const INPUT_TAG = 'input'
export const OUTPUT_TAG = 'output'
/** Asset tag used by the backend for placeholder records that are not installed. */
export const MISSING_TAG = 'missing'
const DEFAULT_EXCLUDED_ASSET_TAGS = [MISSING_TAG]
const EMPTY_PAGE: AssetResponse = { assets: [], total: 0, has_more: false }

const uploadedAssetResponseSchema = assetItemSchema.extend({
  created_new: z.boolean()
})

function createAbortError(): DOMException {
  return new DOMException('Aborted', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError()
}

function normalizeAssetTags(tags: string[]): string[] {
  return tags.map((tag) => tag.trim()).filter(Boolean)
}

/**
 * Resolves the model folder a tag represents, or undefined when the tag is not
 * a folder category. `supports_model_type_tags` backends carry the category as
 * a namespaced `model_type:<folder>` tag; older backends mint bare tags, which
 * may carry subfolder paths (e.g. `Chatterbox/sub/model`) and group by their
 * top-level segment, matching the asset browser's legacy grouping.
 */
function modelFolderFromTag(
  tag: string,
  modelTypeMode: boolean
): string | undefined {
  if (modelTypeMode) {
    return tag.startsWith(MODEL_TYPE_TAG_PREFIX)
      ? tag.slice(MODEL_TYPE_TAG_PREFIX.length)
      : undefined
  }
  if (tag === MODELS_TAG || tag.length === 0) return undefined
  return tag.split('/')[0]
}

/**
 * Orders loader paths as subdirectories before files at every level,
 * alphabetical within each group. The asset API returns models in storage
 * order, which would otherwise interleave root-level files with folder
 * contents in the sidebar tree.
 */
function compareLoaderPaths(a: string, b: string): number {
  const aSegments = a.split('/')
  const bSegments = b.split('/')
  const sharedDepth = Math.min(aSegments.length, bSegments.length)
  for (let i = 0; i < sharedDepth; i++) {
    const aIsFile = i === aSegments.length - 1
    const bIsFile = i === bSegments.length - 1
    if (aIsFile !== bIsFile) return aIsFile ? 1 : -1
    const order = aSegments[i].localeCompare(bSegments[i], undefined, {
      numeric: true
    })
    if (order !== 0) return order
  }
  return 0
}

async function withCallerAbort<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  throwIfAborted(signal)
  if (!signal) return await promise

  let removeAbortListener = () => {}
  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => reject(createAbortError())
    signal.addEventListener('abort', onAbort, { once: true })
    removeAbortListener = () => signal.removeEventListener('abort', onAbort)
  })

  try {
    return await Promise.race([promise, abortPromise])
  } finally {
    removeAbortListener()
  }
}

/**
 * Validates asset response data using Zod schema
 */
function validateAssetResponse(data: unknown): AssetResponse {
  const result = assetResponseSchema.safeParse(data)
  if (result.success) return result.data

  const error = fromZodError(result.error)
  throw new Error(
    `${EXPERIMENTAL_WARNING}Invalid asset response against zod schema:\n${error}`
  )
}

function validateUploadedAssetResponse(
  data: unknown
): AssetItem & { created_new: boolean } {
  const result = uploadedAssetResponseSchema.safeParse(data)
  if (result.success) {
    return result.data
  }

  console.error('Invalid asset upload response:', fromZodError(result.error))
  throw new Error(
    st(
      'assetBrowser.errorUploadFailed',
      'Failed to upload asset. Please try again.'
    )
  )
}

/**
 * Private service for asset-related network requests
 * Not exposed globally - used internally by ComfyApi
 */
function createAssetService() {
  let inputAssetsIncludingPublic: AssetItem[] | null = null
  let inputAssetsIncludingPublicRequestId = 0
  let pendingInputAssetsIncludingPublic: Promise<AssetItem[]> | null = null

  /**
   * Model assets bucketed by folder category, built from a single walk of the
   * `models` tag rather than a fetch per category. Shared by the folder list
   * and per-folder listings so the sidebar loads every model in one pass.
   */
  let modelBuckets: Map<string, AssetItem[]> | null = null
  let modelBucketsRequestId = 0
  let pendingModelBuckets: Promise<Map<string, AssetItem[]>> | null = null

  /**
   * Discards the cached model buckets so the next read re-walks the models
   * tag. Bumping the request id keeps a walk that was already in flight from
   * repopulating the cache with pre-invalidation data.
   */
  function invalidateModelBuckets(): void {
    modelBucketsRequestId++
    modelBuckets = null
    pendingModelBuckets = null
  }

  /** Invalidates the cached public-inclusive input assets without aborting in-flight readers. */
  function invalidateInputAssetsIncludingPublic(): void {
    inputAssetsIncludingPublicRequestId++
    pendingInputAssetsIncludingPublic = null
    inputAssetsIncludingPublic = null
  }

  function invalidateInputAssetsCacheIfNeeded(tags?: string[]): void {
    if (tags?.includes('input')) invalidateInputAssetsIncludingPublic()
  }

  /**
   * Handles API response with consistent error handling and Zod validation
   */
  async function handleAssetRequest(
    options: AssetRequestOptions,
    context: string
  ): Promise<AssetResponse> {
    const {
      includeTags,
      excludeTags = DEFAULT_EXCLUDED_ASSET_TAGS,
      limit = DEFAULT_LIMIT,
      offset,
      after,
      includePublic,
      signal
    } = options
    const normalizedIncludeTags = normalizeAssetTags(includeTags)
    const normalizedExcludeTags = normalizeAssetTags(excludeTags)

    const queryParams = new URLSearchParams({
      include_tags: normalizedIncludeTags.join(','),
      limit: limit.toString()
    })
    if (normalizedExcludeTags.length > 0) {
      queryParams.set('exclude_tags', normalizedExcludeTags.join(','))
    }
    // `after` (keyset cursor) takes precedence over `offset`; the server ignores
    // `offset` when a cursor is supplied, so we avoid sending a redundant param.
    if (after !== undefined) {
      queryParams.set('after', after)
    } else if (offset !== undefined && offset > 0) {
      queryParams.set('offset', offset.toString())
    }
    if (includePublic !== undefined) {
      queryParams.set('include_public', includePublic ? 'true' : 'false')
    }

    const url = `${ASSETS_ENDPOINT}?${queryParams.toString()}`
    const res = signal
      ? await api.fetchApi(url, { signal })
      : await api.fetchApi(url)
    if (!res.ok) {
      throw new Error(
        `${EXPERIMENTAL_WARNING}Unable to load ${context}: Server returned ${res.status}. Please try again.`
      )
    }
    const data = await res.json()
    return validateAssetResponse(data)
  }
  /**
   * Walks every `models`-tagged asset once and buckets each into the folder
   * categories carried by its `model_type:` tags. A single asset lands in every
   * category it is tagged with (e.g. a shared-root model in both `checkpoints`
   * and `diffusion_models`). Which folders are actually shown is decided by
   * `/experiment/models`; models with no category tag are dropped with a warning
   * rather than hidden silently.
   */
  async function buildModelBuckets(): Promise<Map<string, AssetItem[]>> {
    const assets = await getAllAssetsByTag(MODELS_TAG, true)
    const modelTypeMode = useFeatureFlags().flags.supportsModelTypeTags
    const buckets = new Map<string, AssetItem[]>()

    for (const asset of assets) {
      const folders = asset.tags
        .map((tag) => modelFolderFromTag(tag, modelTypeMode))
        .filter((folder): folder is string => folder !== undefined)

      if (folders.length === 0) {
        console.warn(
          `Asset ${asset.id} (${asset.name}) is tagged '${MODELS_TAG}' but has no model category; skipping.`
        )
        continue
      }

      // On loader_path-contract backends a null loader_path marks an
      // unloadable asset (e.g. an orphan): it must not mint a widget value,
      // and `name` is deprecated for path semantics.
      if (modelTypeMode && !asset.loader_path) {
        console.warn(
          `Asset ${asset.id} (${asset.name}) has no loader_path; skipping.`
        )
        continue
      }

      // The loader value flows into viewMetadata URLs and widget values, so a
      // traversal-shaped path must not pass through even if the backend's own
      // validation ever regresses.
      const loaderValue = asset.loader_path ?? getAssetFilename(asset)
      if (!assetFilenameSchema.safeParse(loaderValue).success) {
        console.warn(
          `Asset ${asset.id} (${asset.name}) has an unsafe loader path ('${loaderValue}'); skipping.`
        )
        continue
      }

      for (const folder of folders) {
        const bucket = buckets.get(folder)
        if (bucket) bucket.push(asset)
        else buckets.set(folder, [asset])
      }
    }

    for (const bucket of buckets.values()) {
      bucket.sort((a, b) =>
        compareLoaderPaths(
          a.loader_path ?? getAssetFilename(a),
          b.loader_path ?? getAssetFilename(b)
        )
      )
    }

    return buckets
  }

  /** Returns the memoized model buckets, walking the models tag on first read. */
  async function loadModelBuckets(): Promise<Map<string, AssetItem[]>> {
    if (modelBuckets) return modelBuckets
    if (pendingModelBuckets) return pendingModelBuckets

    const requestId = ++modelBucketsRequestId
    const walk = async () => {
      try {
        const buckets = await buildModelBuckets()
        if (requestId === modelBucketsRequestId) {
          modelBuckets = buckets
        }
        return buckets
      } finally {
        if (requestId === modelBucketsRequestId) {
          pendingModelBuckets = null
        }
      }
    }

    pendingModelBuckets = walk()
    return pendingModelBuckets
  }

  /**
   * Gets the models in the specified folder from the single models walk.
   * @param folder The folder to list models from, such as 'checkpoints'
   * @returns The list of model filenames within the specified folder
   */
  async function getAssetModels(folder: string): Promise<ModelFile[]> {
    const buckets = await loadModelBuckets()
    return (buckets.get(folder) ?? []).map((asset) => ({
      // `loader_path` is the category-relative path the loader widget expects
      // and the source for the sidebar tree. Backends that predate it (bare-tag
      // mode; today's cloud) fall back to the filename metadata — the same
      // value the asset browser serializes — rather than `name`, which is a
      // content hash on cloud.
      name: asset.loader_path ?? getAssetFilename(asset),
      pathIndex: 0
    }))
  }

  /**
   * Asks the backend to rescan the model roots on disk so newly added files
   * become assets. Fire-and-forget: the scan's fast (insert) phase already
   * writes the category tags and filenames the sidebar needs and is announced
   * by an `assets.seed.fast_complete` websocket event. A 409 means a scan is
   * already running, which will emit the same event, so it is not an error.
   */
  async function seedModelAssets(): Promise<void> {
    const res = await api.fetchApi(ASSETS_SEED_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roots: ['models'] })
    })
    if (!res.ok && res.status !== 409) {
      throw new Error(
        `Unable to start asset scan: Server returned ${res.status}`
      )
    }
  }

  /**
   * Subscribes to the backend's scan fast-phase completion broadcast — the
   * moment newly scanned files' tags and loader paths become queryable. The
   * wire-level event (`assets.seed.fast_complete`) is owned here; consumers
   * receive a callback and an unsubscribe function.
   */
  function onModelsScanned(callback: () => void | Promise<void>): () => void {
    const handler = () => {
      void callback()
    }
    api.addCustomEventListener('assets.seed.fast_complete', handler)
    return () => {
      api.removeCustomEventListener('assets.seed.fast_complete', handler)
    }
  }

  /**
   * Checks if a widget input should use the asset browser based on both input name and node comfyClass
   *
   * @param nodeType - The ComfyUI node comfyClass (e.g., 'CheckpointLoaderSimple', 'LoraLoader')
   * @param widgetName - The name of the widget to check (e.g., 'ckpt_name')
   * @returns true if this input should use asset browser
   */
  function isAssetBrowserEligible(
    nodeType: string | undefined,
    widgetName: string
  ): boolean {
    if (!nodeType || !widgetName) return false
    return (
      useModelToNodeStore().getRegisteredNodeTypes()[nodeType] === widgetName
    )
  }

  /**
   * Checks if the asset API is enabled (cloud environment + user setting).
   */
  function isAssetAPIEnabled(): boolean {
    if (!isCloud) return false
    return !!useSettingStore().get('Comfy.Assets.UseAssetAPI')
  }

  /**
   * Checks if the asset browser should be used for a given node input.
   * Combines the cloud environment check, user setting, and eligibility check.
   *
   * @param nodeType - The ComfyUI node comfyClass
   * @param widgetName - The name of the widget to check
   * @returns true if this input should use the asset browser
   */
  function shouldUseAssetBrowser(
    nodeType: string | undefined,
    widgetName: string
  ): boolean {
    return isAssetAPIEnabled() && isAssetBrowserEligible(nodeType, widgetName)
  }

  /**
   * Gets assets for a specific node type by finding the matching category
   * and fetching all assets with that category tag
   *
   * @param nodeType - The ComfyUI node type (e.g., 'CheckpointLoaderSimple')
   * @param options - Pagination options
   * @param options.limit - Maximum number of assets to return (default: 500)
   * @param options.offset - Number of assets to skip (default: 0)
   * @returns Promise<AssetItem[]> - Full asset objects with preserved metadata
   */
  async function getAssetsForNodeType(
    nodeType: string,
    options: PaginationOptions = {}
  ): Promise<AssetItem[]> {
    const data = await getAssetsPageForNodeType(nodeType, options)

    // Return full AssetItem[] objects (don't strip like getAssetModels does)
    return data.assets
  }

  /**
   * Gets one paginated asset response for a specific node type by finding the
   * matching category and fetching assets with that category tag.
   *
   * Unlike {@link getAssetsForNodeType}, the full response envelope is
   * returned so callers can drive keyset cursor pagination from
   * `next_cursor`/`has_more`.
   *
   * @param nodeType - The ComfyUI node type (e.g., 'CheckpointLoaderSimple')
   * @param options - Pagination options
   * @param options.limit - Maximum number of assets to return (default: 500)
   * @param options.offset - Number of assets to skip (ignored when `after` is set)
   * @param options.after - Keyset cursor from a prior response's `next_cursor`
   * @param options.signal - Optional abort signal for cancelling the request
   * @returns Promise<AssetResponse> - Page of assets plus pagination metadata
   */
  async function getAssetsPageForNodeType(
    nodeType: string,
    {
      limit = DEFAULT_LIMIT,
      offset = 0,
      after,
      signal
    }: AssetPaginationOptions = {}
  ): Promise<AssetResponse> {
    if (!nodeType || typeof nodeType !== 'string') {
      return EMPTY_PAGE
    }

    // Find the category for this node type using efficient O(1) lookup
    const modelToNodeStore = useModelToNodeStore()
    const category = modelToNodeStore.getCategoryForNodeType(nodeType)

    if (!category) {
      return EMPTY_PAGE
    }

    // Fetch assets for this category using same API pattern as getAssetModels
    return await handleAssetRequest(
      { includeTags: [MODELS_TAG, category], limit, offset, after, signal },
      `assets for ${nodeType}`
    )
  }

  /**
   * Gets complete details for a specific asset by ID
   * Calls the detail endpoint which includes user_metadata and all fields
   *
   * @param id - The asset ID
   * @returns Promise<AssetItem> - Complete asset object with user_metadata
   */
  async function getAssetDetails(id: AssetId): Promise<AssetItem> {
    const res = await api.fetchApi(`${ASSETS_ENDPOINT}/${id}`)
    if (!res.ok) {
      throw new Error(
        `${EXPERIMENTAL_WARNING}Unable to load asset details for ${id}: Server returned ${res.status}. Please try again.`
      )
    }
    const data = await res.json()

    const result = assetItemSchema.safeParse(data)
    if (result.success) return result.data

    const error = result.error
      ? fromZodError(result.error)
      : 'Unknown validation error'
    throw new Error(
      `${EXPERIMENTAL_WARNING}Invalid asset response against zod schema:\n${error}`
    )
  }

  /**
   * Gets assets filtered by a specific tag
   *
   * @param tag - The tag to filter by (e.g., 'models', 'input')
   * @param includePublic - Whether to include public assets (default: true)
   * @param options - Pagination options
   * @param options.limit - Maximum number of assets to return (default: 500)
   * @param options.offset - Number of assets to skip (default: 0)
   * @param options.signal - Optional abort signal for cancelling the request
   * @returns Promise<AssetItem[]> - Full asset objects filtered by tag, excluding missing assets
   */
  async function getAssetsByTag(
    tag: string,
    includePublic: boolean = true,
    {
      limit = DEFAULT_LIMIT,
      offset = 0,
      after,
      signal
    }: AssetPaginationOptions = {}
  ): Promise<AssetItem[]> {
    const data = await getAssetsPageByTag(tag, includePublic, {
      limit,
      offset,
      after,
      signal
    })

    return data.assets
  }

  /**
   * Gets one paginated asset response filtered by a specific tag.
   */
  async function getAssetsPageByTag(
    tag: string,
    includePublic: boolean = true,
    {
      limit = DEFAULT_LIMIT,
      offset = 0,
      after,
      signal
    }: AssetPaginationOptions = {}
  ): Promise<AssetResponse> {
    return await handleAssetRequest(
      { includeTags: [tag], limit, offset, after, includePublic, signal },
      `assets for tag ${tag}`
    )
  }

  /**
   * Gets every asset for a tag by walking paginated asset API responses.
   *
   * Uses keyset (cursor) pagination: each page is fetched with the prior
   * response's `next_cursor`, which is stable under concurrent inserts/deletes
   * and avoids the duplicate/skip drift that offset paging exhibits when the
   * underlying set changes mid-walk. Falls back to terminating on `has_more`
   * when the server omits `next_cursor`.
   *
   * @param tag - The tag to filter by (e.g., 'models', 'input')
   * @param includePublic - Whether to include public assets (default: true)
   * @param options - Pagination options
   * @param options.limit - Page size for each request (default: 500)
   * @param options.signal - Optional abort signal for cancelling requests
   * @returns Promise<AssetItem[]> - Full asset objects filtered by tag
   */
  async function getAllAssetsByTag(
    tag: string,
    includePublic: boolean = true,
    {
      limit = DEFAULT_LIMIT,
      signal
    }: Pick<AssetPaginationOptions, 'limit' | 'signal'> = {}
  ): Promise<AssetItem[]> {
    const assets: AssetItem[] = []
    const pageSize = limit > 0 ? limit : DEFAULT_LIMIT
    let after: string | undefined

    while (true) {
      if (signal?.aborted) throw createAbortError()

      const data = await getAssetsPageByTag(tag, includePublic, {
        limit: pageSize,
        after,
        signal
      })
      const batch = data.assets
      if (batch.length === 0) {
        return assets
      }

      assets.push(...batch)

      // A server that returns a non-advancing cursor would loop forever.
      if (!data.has_more || !data.next_cursor || data.next_cursor === after) {
        return assets
      }

      after = data.next_cursor
    }
  }

  function startInputAssetsIncludingPublicRequest(): Promise<AssetItem[]> {
    const requestId = ++inputAssetsIncludingPublicRequestId

    pendingInputAssetsIncludingPublic = getAllAssetsByTag('input', true, {
      limit: INPUT_ASSETS_WITH_PUBLIC_LIMIT
    })
      .then((assets) => {
        if (requestId === inputAssetsIncludingPublicRequestId) {
          inputAssetsIncludingPublic = assets
        }
        return assets
      })
      .finally(() => {
        if (requestId === inputAssetsIncludingPublicRequestId) {
          pendingInputAssetsIncludingPublic = null
        }
      })

    void pendingInputAssetsIncludingPublic.catch(() => {})
    return pendingInputAssetsIncludingPublic
  }

  /**
   * Gets cached input assets including public assets for missing media checks.
   * Caller aborts cancel only that caller; shared fetches are invalidated
   * through invalidateInputAssetsIncludingPublic().
   */
  async function getInputAssetsIncludingPublic(
    signal?: AbortSignal
  ): Promise<AssetItem[]> {
    throwIfAborted(signal)
    if (inputAssetsIncludingPublic) return inputAssetsIncludingPublic

    const request =
      pendingInputAssetsIncludingPublic ??
      startInputAssetsIncludingPublicRequest()
    return await withCallerAbort(request, signal)
  }

  /**
   * Deletes an asset by ID
   * Only available in cloud environment
   *
   * @param id - The asset ID (UUID)
   * @returns Promise<void>
   * @throws Error if deletion fails
   */
  async function deleteAsset(id: AssetId): Promise<void> {
    const res = await api.fetchApi(`${ASSETS_ENDPOINT}/${id}`, {
      method: 'DELETE'
    })

    if (!res.ok) {
      throw new Error(
        `Unable to delete asset ${id}: Server returned ${res.status}`
      )
    }

    invalidateInputAssetsIncludingPublic()
  }

  /**
   * Update metadata of an asset by ID
   * Only available in cloud environment
   *
   * @param id - The asset ID (UUID)
   * @param newData - The data to update
   * @returns Promise<AssetItem>
   * @throws Error if update fails
   */
  async function updateAsset(
    id: AssetId,
    newData: AssetUpdatePayload
  ): Promise<AssetItem> {
    const res = await api.fetchApi(`${ASSETS_ENDPOINT}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(newData)
    })

    if (!res.ok) {
      throw new Error(
        `Unable to update asset ${id}: Server returned ${res.status}`
      )
    }

    const newAsset = assetItemSchema.safeParse(await res.json())
    if (newAsset.success) {
      return newAsset.data
    }

    throw new Error(
      `Unable to update asset ${id}: Invalid response - ${newAsset.error}`
    )
  }

  /**
   * Retrieves metadata from a download URL without downloading the file
   *
   * @param url - Download URL to retrieve metadata from (will be URL-encoded)
   * @returns Promise with metadata including content_length, final_url, filename, etc.
   * @throws Error if metadata retrieval fails
   */
  async function getAssetMetadata(url: string): Promise<AssetMetadata> {
    const encodedUrl = encodeURIComponent(url)
    const res = await api.fetchApi(
      `${ASSETS_ENDPOINT}/remote-metadata?url=${encodedUrl}`
    )

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}))
      throw new Error(
        getLocalizedErrorMessage(errorData.code || 'UNKNOWN_ERROR')
      )
    }

    const data: AssetMetadata = await res.json()
    if (data.validation?.is_valid === false) {
      throw new Error(
        getLocalizedErrorMessage(
          data.validation?.errors?.[0]?.code || 'UNKNOWN_ERROR'
        )
      )
    }

    return data
  }

  /**
   * Uploads an asset by providing a URL to download from
   *
   * @param params - Upload parameters
   * @param params.url - HTTP/HTTPS URL to download from
   * @param params.name - Display name (determines extension)
   * @param params.tags - Optional freeform tags
   * @param params.user_metadata - Optional custom metadata object
   * @param params.preview_id - Optional UUID for preview asset
   * @returns Promise<AssetItem & { created_new: boolean }> - Asset object with created_new flag
   * @throws Error if upload fails
   */
  async function uploadAssetFromUrl(params: {
    url: string
    name: string
    tags?: string[]
    user_metadata?: Record<string, unknown>
    preview_id?: string
  }): Promise<AssetItem & { created_new: boolean }> {
    const res = await api.fetchApi(ASSETS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(params)
    })

    if (!res.ok) {
      throw new Error(
        st(
          'assetBrowser.errorUploadFailed',
          'Failed to upload asset. Please try again.'
        )
      )
    }

    const asset = validateUploadedAssetResponse(await res.json())
    invalidateInputAssetsCacheIfNeeded(params.tags)
    return asset
  }

  /**
   * Uploads an asset from base64 data
   *
   * @param params - Upload parameters
   * @param params.data - Base64 data URL (e.g., "data:image/png;base64,...")
   * @param params.name - Display name (determines extension)
   * @param params.tags - Optional freeform tags
   * @param params.user_metadata - Optional custom metadata object
   * @returns Promise<AssetItem & { created_new: boolean }> - Asset object with created_new flag
   * @throws Error if upload fails
   */
  async function uploadAssetFromBase64(params: {
    data: string
    name: string
    tags?: string[]
    user_metadata?: Record<string, unknown>
  }): Promise<AssetItem & { created_new: boolean }> {
    // Validate that data is a data URL
    if (!params.data || !params.data.startsWith('data:')) {
      throw new Error(
        'Invalid data URL: expected a string starting with "data:"'
      )
    }

    // Convert base64 data URL to Blob
    const blob = await fetch(params.data).then((r) => r.blob())

    // Create FormData and append the blob
    const formData = new FormData()
    formData.append('file', blob, params.name)

    if (params.tags) {
      formData.append('tags', JSON.stringify(params.tags))
    }

    if (params.user_metadata) {
      formData.append('user_metadata', JSON.stringify(params.user_metadata))
    }

    const res = await api.fetchApi(ASSETS_ENDPOINT, {
      method: 'POST',
      body: formData
    })

    if (!res.ok) {
      throw new Error(
        `Failed to upload asset from base64: ${res.status} ${res.statusText}`
      )
    }

    const asset = validateUploadedAssetResponse(await res.json())
    invalidateInputAssetsCacheIfNeeded(params.tags)
    return asset
  }

  /**
   * Add tags to an asset
   * @param id - The asset ID (UUID)
   * @param tags - Tags to add
   * @returns Promise<TagsOperationResult>
   */
  async function addAssetTags(
    id: string,
    tags: string[]
  ): Promise<TagsOperationResult> {
    const res = await api.fetchApi(`${ASSETS_ENDPOINT}/${id}/tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    })

    if (!res.ok) {
      throw new Error(
        `Unable to add tags to asset ${id}: Server returned ${res.status}`
      )
    }

    const result = await res.json()
    const parseResult = tagsOperationResultSchema.safeParse(result)
    if (!parseResult.success) {
      throw fromZodError(parseResult.error)
    }
    invalidateInputAssetsIncludingPublic()
    return parseResult.data
  }

  /**
   * Remove tags from an asset
   * @param id - The asset ID (UUID)
   * @param tags - Tags to remove
   * @returns Promise<TagsOperationResult>
   */
  async function removeAssetTags(
    id: string,
    tags: string[]
  ): Promise<TagsOperationResult> {
    const res = await api.fetchApi(`${ASSETS_ENDPOINT}/${id}/tags`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags })
    })

    if (!res.ok) {
      throw new Error(
        `Unable to remove tags from asset ${id}: Server returned ${res.status}`
      )
    }

    const result = await res.json()
    const parseResult = tagsOperationResultSchema.safeParse(result)
    if (!parseResult.success) {
      throw fromZodError(parseResult.error)
    }
    invalidateInputAssetsIncludingPublic()
    return parseResult.data
  }

  /**
   * Uploads an asset asynchronously using the /api/assets/download endpoint
   * Returns immediately with either the asset (if already exists) or a task to track
   *
   * @param params - Upload parameters
   * @param params.source_url - HTTP/HTTPS URL to download from
   * @param params.tags - Optional freeform tags
   * @param params.user_metadata - Optional custom metadata object
   * @param params.preview_id - Optional UUID for preview asset
   * @returns Promise<AsyncUploadResponse> - Either sync asset or async task info
   * @throws Error if upload fails
   */
  async function uploadAssetAsync(params: {
    source_url: string
    tags?: string[]
    user_metadata?: Record<string, unknown>
    preview_id?: string
  }): Promise<AsyncUploadResponse> {
    const res = await api.fetchApi(ASSETS_DOWNLOAD_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    if (!res.ok) {
      throw new Error(
        st(
          'assetBrowser.errorUploadFailed',
          'Failed to upload asset. Please try again.'
        )
      )
    }

    const data = await res.json()

    if (res.status === 202) {
      const result = asyncUploadResponseSchema.safeParse({
        type: 'async',
        task: data
      })
      if (!result.success) {
        throw new Error(
          st(
            'assetBrowser.errorUploadFailed',
            'Failed to parse async upload response. Please try again.'
          )
        )
      }
      if (
        params.tags?.includes('input') &&
        result.data.type === 'async' &&
        result.data.task.status === 'completed'
      ) {
        invalidateInputAssetsIncludingPublic()
      }
      return result.data
    }

    const result = asyncUploadResponseSchema.safeParse({
      type: 'sync',
      asset: data
    })
    if (!result.success) {
      throw new Error(
        st(
          'assetBrowser.errorUploadFailed',
          'Failed to parse sync upload response. Please try again.'
        )
      )
    }
    invalidateInputAssetsCacheIfNeeded(params.tags)
    return result.data
  }

  async function createAssetExport(
    params: AssetExportOptions
  ): Promise<{ task_id: string; status: string; message?: string }> {
    const res = await api.fetchApi(ASSETS_EXPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })

    if (!res.ok) {
      throw new Error(`Failed to create asset export: ${res.status}`)
    }

    return await res.json()
  }

  async function getExportDownloadUrl(
    exportName: string
  ): Promise<{ url: string; expires_at?: string }> {
    const res = await api.fetchApi(`/assets/exports/${exportName}`)

    if (!res.ok) {
      throw new Error(`Failed to get export download URL: ${res.status}`)
    }

    return await res.json()
  }

  return {
    getAssetModels,
    invalidateModelBuckets,
    onModelsScanned,
    seedModelAssets,
    isAssetAPIEnabled,
    isAssetBrowserEligible,
    shouldUseAssetBrowser,
    getAssetsForNodeType,
    getAssetsPageForNodeType,
    getAssetDetails,
    getAssetsByTag,
    getAssetsPageByTag,
    getAllAssetsByTag,
    getInputAssetsIncludingPublic,
    invalidateInputAssetsIncludingPublic,
    deleteAsset,
    updateAsset,
    addAssetTags,
    removeAssetTags,
    getAssetMetadata,
    uploadAssetFromUrl,
    uploadAssetFromBase64,
    uploadAssetAsync,
    createAssetExport,
    getExportDownloadUrl
  }
}

export const assetService = createAssetService()
