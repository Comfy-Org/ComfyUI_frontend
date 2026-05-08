import type { AssetItem } from '@/platform/assets/schemas/assetSchema'
import { assetService } from '@/platform/assets/services/assetService'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { api } from '@/scripts/api'
import { getMediaPathDetectionNames } from './mediaPathDetectionUtil'

const HISTORY_MEDIA_ASSETS_PAGE_SIZE = 200

interface MediaPathDetectionOptions {
  allowCompactSuffix: boolean
}

export interface MissingMediaAssetSources {
  inputAssets: AssetItem[]
  generatedAssets: AssetItem[]
}

export interface ResolveMissingMediaAssetSourcesOptions {
  signal?: AbortSignal
  includeCloudInputAssets: boolean
  includeGeneratedAssets: boolean
  generatedMatchNames: ReadonlySet<string>
  allowCompactSuffix: boolean
}

export type MissingMediaAssetResolver = (
  options: ResolveMissingMediaAssetSourcesOptions
) => Promise<MissingMediaAssetSources>

export async function resolveMissingMediaAssetSources({
  signal,
  includeCloudInputAssets,
  includeGeneratedAssets,
  generatedMatchNames,
  allowCompactSuffix
}: ResolveMissingMediaAssetSourcesOptions): Promise<MissingMediaAssetSources> {
  const pathOptions = { allowCompactSuffix }
  const [inputAssets, generatedAssets] = await Promise.all([
    includeCloudInputAssets
      ? assetService.getInputAssetsIncludingPublic(signal)
      : Promise.resolve<AssetItem[]>([]),
    includeGeneratedAssets
      ? fetchGeneratedHistoryAssets(signal, generatedMatchNames, pathOptions)
      : Promise.resolve<AssetItem[]>([])
  ])

  return { inputAssets, generatedAssets }
}

export function getAssetDetectionNames(
  asset: AssetItem,
  options: MediaPathDetectionOptions
): string[] {
  const names = new Set<string>()
  addPathDetectionNames(names, asset.asset_hash, options)
  addPathDetectionNames(names, asset.name, options)

  const subfolder = asset.user_metadata?.subfolder
  if (typeof subfolder === 'string' && subfolder) {
    addSubfolderPathDetectionNames(names, subfolder, asset.asset_hash, options)
    addSubfolderPathDetectionNames(names, subfolder, asset.name, options)
  }

  return Array.from(names)
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
    throwIfAborted(signal)

    const requestedOffset = offset
    const historyPage = await api.getHistoryPage(
      HISTORY_MEDIA_ASSETS_PAGE_SIZE,
      {
        offset: requestedOffset
      }
    )

    throwIfAborted(signal)

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

  const slashSubfolder = subfolder.replace(/\\/g, '/')
  const backslashSubfolder = subfolder.replace(/\//g, '\\')
  addPathDetectionNames(names, `${slashSubfolder}/${value}`, options)
  addPathDetectionNames(names, `${backslashSubfolder}\\${value}`, options)
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

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
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
