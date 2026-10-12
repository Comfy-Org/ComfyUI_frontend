import type { CreateAssetExportData } from '@comfyorg/ingest-types'

import type { ResultItem } from '@/platform/remote/comfyui/execution/types'
import { api } from '@/scripts/api'

type AssetExportRequest = CreateAssetExportData['body']

export type DownloadableOutput = ResultItem & { filename: string }

export function isDownloadableOutput(
  item: ResultItem | null | undefined
): item is DownloadableOutput {
  return !!item?.filename
}

export function buildOutputsExportRequest(
  outputs: DownloadableOutput[]
): AssetExportRequest | undefined {
  const assetIds = outputs.map((output) => output.id)
  if (assetIds.length === 0 || !assetIds.every((id): id is string => !!id)) {
    return undefined
  }
  return { asset_ids: assetIds, naming_strategy: 'preserve' }
}

export function outputFileUrl({
  filename,
  subfolder,
  type
}: DownloadableOutput): string {
  const params = new URLSearchParams({
    filename,
    subfolder: subfolder ?? '',
    type: type ?? 'output'
  })
  return api.apiURL(`/view?${params}`)
}
