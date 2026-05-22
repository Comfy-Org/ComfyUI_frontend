import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { isCloud } from '@/platform/distribution/types'
import { fetchHistoryPage } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import { getFilePathSeparatorVariants, joinFilePath } from '@/utils/formatUtil'
import { isAbortError } from '@/utils/typeGuardUtil'
import { getMediaPathDetectionNames } from './mediaPathDetectionUtil'

const HISTORY_MEDIA_ASSETS_PAGE_SIZE = 200
const CLOUD_OUTPUT_ASSETS_PAGE_SIZE = 500

interface MediaPathDetectionOptions {
  allowCompactSuffix: boolean
}

export interface MissingMediaAssetSources {
  inputAssets: AssetItem[]
  generatedAssets: AssetItem[]
}

export interface ResolveMissingMediaAssetSourcesOptions {
  signal?: AbortSignal
  includeGeneratedAssets: boolean
  generatedMatchNames: ReadonlySet<string>
  allowCompactSuffix: boolean
}

export type MissingMediaAssetResolver = (
  options: ResolveMissingMediaAssetSourcesOptions
) => Promise<MissingMediaAssetSources>

export async function resolveMissingMediaAssetSources({
  signal,
  includeGeneratedAssets,
  generatedMatchNames,
  allowCompactSuffix
}: ResolveMissingMediaAssetSourcesOptions): Promise<MissingMediaAssetSources> {
  const pathOptions = { allowCompactSuffix }

  const controller = new AbortController()
  const abortFromCaller = () => controller.abort(signal?.reason)
  if (signal?.aborted) {
    abortFromCaller()
  } else {
    signal?.addEventListener('abort', abortFromCaller, { once: true })
  }

  try {
    // Input assets (`/api/assets`) and generated assets (Cloud asset API or
    // OSS `/history`) are independent oracles. Use `allSettled` so a failure
    // in one — e.g. `/api/assets` 404 on a pre-BE-786 OSS instance, or zod
    // schema skew during a BE-934 partial deploy — doesn't take down the
    // other path. Each branch soft-degrades to an empty list; the caller
    // then marks affected candidates missing instead of swallowing the
    // whole verification with a toast.
    const [inputResult, generatedResult] = await Promise.allSettled([
      assetService.getInputAssetsIncludingPublic(controller.signal),
      includeGeneratedAssets
        ? fetchGeneratedAssets(controller.signal, {
            generatedMatchNames,
            pathOptions
          })
        : Promise.resolve<AssetItem[]>([])
    ])

    return {
      inputAssets: unwrapAssetFetchResult(inputResult, 'inputAssets'),
      generatedAssets: unwrapAssetFetchResult(
        generatedResult,
        'generatedAssets'
      )
    }
  } finally {
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

function unwrapAssetFetchResult(
  result: PromiseSettledResult<AssetItem[]>,
  label: 'inputAssets' | 'generatedAssets'
): AssetItem[] {
  if (result.status === 'fulfilled') return result.value
  if (isAbortError(result.reason)) return []
  console.warn(
    `[missingMedia] ${label} fetch failed; degrading to empty list.`,
    result.reason
  )
  return []
}

interface FetchGeneratedAssetsOptions {
  generatedMatchNames: ReadonlySet<string>
  pathOptions: MediaPathDetectionOptions
}

/**
 * Derive comparison keys for matching workflow widget values against an asset.
 *
 * Per RFC BE-808 v2 (Asset Identity Semantics), `id` is the identity field;
 * `file_path` is a namespace-rooted locator/display string emitted on a
 * BEST EFFORT basis by BE-933 / BE-934. Workflow widget values predate the
 * `file_path` rollout and may still be bare filenames, hashes, or annotated
 * paths, so detection keys union `file_path`, `asset_hash`, `name`, and
 * `subfolder + name` variants — a widget value in any of those legacy
 * shapes must keep matching once an asset starts emitting `file_path`.
 * Both backends round-trip `name` through the BE-792 deprecation window,
 * so the legacy keys stay valid.
 */
export function getAssetDetectionNames(
  asset: AssetItem,
  options: MediaPathDetectionOptions
): string[] {
  const names = new Set<string>()

  addPathDetectionNames(names, asset.file_path, options)
  addPathDetectionNames(names, asset.asset_hash, options)
  addPathDetectionNames(names, asset.name, options)

  const subfolder = asset.user_metadata?.subfolder
  if (typeof subfolder === 'string' && subfolder) {
    addSubfolderPathDetectionNames(names, subfolder, asset.name, options)
  }

  return Array.from(names)
}

/**
 * Pick the generated-assets oracle by runtime. Cloud queries
 * `/api/assets?include_tags=output`; Core synthesizes `AssetItem` shells
 * from job-execution history because OSS does not auto-register output
 * files as assets (pre-BE-786). Unifying this oracle is a separate
 * concern — track as a follow-up to FE-746.
 */
async function fetchGeneratedAssets(
  signal: AbortSignal | undefined,
  { generatedMatchNames, pathOptions }: FetchGeneratedAssetsOptions
): Promise<AssetItem[]> {
  if (isCloud) {
    return await fetchCloudGeneratedAssets(
      signal,
      generatedMatchNames,
      pathOptions
    )
  }

  return await fetchGeneratedHistoryAssets(
    signal,
    generatedMatchNames,
    pathOptions
  )
}

async function fetchCloudGeneratedAssets(
  signal: AbortSignal | undefined,
  targetNames: ReadonlySet<string>,
  pathOptions: MediaPathDetectionOptions
): Promise<AssetItem[]> {
  const assets: AssetItem[] = []
  const foundTargetNames = new Set<string>()
  let offset = 0

  while (true) {
    signal?.throwIfAborted()

    const assetPage = await assetService.getAssetsPageByTag('output', true, {
      limit: CLOUD_OUTPUT_ASSETS_PAGE_SIZE,
      offset,
      signal
    })

    signal?.throwIfAborted()

    const batch = assetPage.assets
    if (batch.length === 0) return assets

    for (const asset of batch) {
      assets.push(asset)
      rememberResolvedTargetNames(
        asset,
        targetNames,
        foundTargetNames,
        pathOptions
      )
    }

    if (
      !assetPage.has_more ||
      hasResolvedAllTargetNames(targetNames, foundTargetNames)
    ) {
      return assets
    }

    offset += batch.length
  }
}

async function fetchGeneratedHistoryAssets(
  signal: AbortSignal | undefined,
  targetNames: ReadonlySet<string>,
  pathOptions: MediaPathDetectionOptions
): Promise<AssetItem[]> {
  const assets: AssetItem[] = []
  const foundTargetNames = new Set<string>()
  const seenJobIds = new Set<string>()
  let offset = 0

  while (true) {
    signal?.throwIfAborted()

    const requestedOffset = offset
    const historyPage = await fetchHistoryPage(
      api.fetchApi.bind(api),
      HISTORY_MEDIA_ASSETS_PAGE_SIZE,
      requestedOffset
    )

    signal?.throwIfAborted()

    let newJobCount = 0
    for (const job of historyPage.jobs) {
      if (seenJobIds.has(job.id)) continue
      seenJobIds.add(job.id)
      newJobCount += 1

      const asset = mapHistoryJobToAsset(job)
      if (!asset) continue

      assets.push(asset)
      rememberResolvedTargetNames(
        asset,
        targetNames,
        foundTargetNames,
        pathOptions
      )
    }

    if (
      !historyPage.hasMore ||
      historyPage.jobs.length === 0 ||
      newJobCount === 0 ||
      hasResolvedAllTargetNames(targetNames, foundTargetNames)
    ) {
      return assets
    }

    offset = requestedOffset + historyPage.jobs.length
  }
}

function addPathDetectionNames(
  names: Set<string>,
  value: string | null | undefined,
  options: MediaPathDetectionOptions
) {
  if (!value) return
  for (const name of getMediaPathDetectionNames(value, options)) {
    names.add(name)
  }
}

function addSubfolderPathDetectionNames(
  names: Set<string>,
  subfolder: string,
  value: string | null | undefined,
  options: MediaPathDetectionOptions
) {
  if (!value) return

  const filePath = joinFilePath(subfolder, value)
  for (const path of getFilePathSeparatorVariants(filePath)) {
    addPathDetectionNames(names, path, options)
  }
}

function rememberResolvedTargetNames(
  asset: AssetItem,
  targetNames: ReadonlySet<string>,
  foundTargetNames: Set<string>,
  options: MediaPathDetectionOptions
) {
  if (targetNames.size === 0) return

  for (const name of getAssetDetectionNames(asset, options)) {
    if (targetNames.has(name)) foundTargetNames.add(name)
  }
}

function hasResolvedAllTargetNames(
  targetNames: ReadonlySet<string>,
  foundTargetNames: ReadonlySet<string>
): boolean {
  return targetNames.size > 0 && foundTargetNames.size === targetNames.size
}

function mapHistoryJobToAsset(job: JobListItem): AssetItem | null {
  const output = job.preview_output
  if (job.status !== 'completed' || !output?.filename) return null

  return {
    id: `${job.id}-${output.filename}`,
    name: output.filename,
    display_name: output.display_name,
    mime_type: null,
    tags: ['output'],
    user_metadata: {
      subfolder: output.subfolder
    }
  }
}
