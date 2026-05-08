import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import { fetchHistoryPage } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import { getFilePathSeparatorVariants, joinFilePath } from '@/utils/formatUtil'
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
  isCloud: boolean
  includeGeneratedAssets: boolean
  generatedMatchNames: ReadonlySet<string>
  allowCompactSuffix: boolean
}

export type MissingMediaAssetResolver = (
  options: ResolveMissingMediaAssetSourcesOptions
) => Promise<MissingMediaAssetSources>

export async function resolveMissingMediaAssetSources({
  signal,
  isCloud,
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
    const [inputAssets, generatedAssets] = await Promise.all([
      abortSiblingsOnFailure(
        isCloud
          ? assetService.getInputAssetsIncludingPublic(controller.signal)
          : Promise.resolve<AssetItem[]>([]),
        controller
      ),
      abortSiblingsOnFailure(
        includeGeneratedAssets
          ? fetchGeneratedAssets(controller.signal, {
              isCloud,
              generatedMatchNames,
              pathOptions
            })
          : Promise.resolve<AssetItem[]>([]),
        controller
      )
    ])

    return { inputAssets, generatedAssets }
  } finally {
    signal?.removeEventListener('abort', abortFromCaller)
  }
}

interface FetchGeneratedAssetsOptions {
  isCloud: boolean
  generatedMatchNames: ReadonlySet<string>
  pathOptions: MediaPathDetectionOptions
}

export function getAssetDetectionNames(
  asset: AssetItem,
  options: MediaPathDetectionOptions
): string[] {
  const names = new Set<string>()
  // Treat names and hashes as opaque match keys because Cloud may use either in widget values.
  addPathDetectionNames(names, asset.asset_hash, options)
  addPathDetectionNames(names, asset.name, options)

  const subfolder = asset.user_metadata?.subfolder
  if (typeof subfolder === 'string' && subfolder) {
    addSubfolderPathDetectionNames(names, subfolder, asset.name, options)
  }

  return Array.from(names)
}

async function fetchGeneratedAssets(
  signal: AbortSignal | undefined,
  { isCloud, generatedMatchNames, pathOptions }: FetchGeneratedAssetsOptions
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

async function abortSiblingsOnFailure<T>(
  promise: Promise<T>,
  controller: AbortController
): Promise<T> {
  try {
    return await promise
  } catch (err) {
    if (!controller.signal.aborted) controller.abort(err)
    throw err
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
