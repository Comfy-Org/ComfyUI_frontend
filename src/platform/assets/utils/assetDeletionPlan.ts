import { compact, uniqBy } from 'es-toolkit'

import { isGeneratedTempOutput } from '@/platform/assets/adapters/outputAssetMappers'
import type { AssetId, AssetItem } from '@comfyorg/assets-core/schema'
import { getOutputAssetMetadata } from '@/platform/assets/types/outputAssetMetadata'
import {
  getAssetDisplayName,
  getOutputSubfolder,
  getAssetType
} from '@comfyorg/assets-core/metadata'
import { getStoredOutputIdentity } from '@/platform/assets/adapters/outputAssetResolver'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { isResultItemType } from '@/utils/typeGuardUtil'

interface BaseDeleteOperation {
  dependents?: DeleteOperation[]
  markDeletionId?: AssetId
  name?: string
}

export interface AssetDeletion extends BaseDeleteOperation {
  kind: 'asset'
  variants: string[]
  id: AssetId
  tags?: string[]
}

export interface JobDeletion extends BaseDeleteOperation {
  kind: 'job'
  id: string
}

export type DeleteOperation = AssetDeletion | JobDeletion

function widgetValueVariants(
  name: string | undefined,
  type: string | undefined,
  subfolder?: string,
  hash?: string
): string[] {
  const rootFolder = isResultItemType(type) ? type : undefined
  return compact([name, hash]).map((filename) =>
    createAnnotatedPath(filename, { rootFolder, subfolder })
  )
}

export function buildAssetDeletionPlan(
  assets: AssetItem[],
  { assetsEnabled }: { assetsEnabled: boolean }
): DeleteOperation[] {
  if (!assetsEnabled) {
    const operations: JobDeletion[] = assets.flatMap((asset) => {
      const { jobId } = getOutputAssetMetadata(asset.user_metadata) ?? {}
      if (!jobId) return []
      return [
        {
          kind: 'job',
          id: jobId,
          name: getAssetDisplayName(asset),
          markDeletionId: asset.id
        }
      ]
    })
    return uniqBy(operations, (op) => op.id)
  }
  return assets.flatMap((asset) => {
    const markDeletionId = asset.id
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    const childAssets: AssetDeletion[] = (metadata?.allOutputs ?? []).flatMap(
      (output) => {
        if (!output.assetId) return []
        return {
          kind: 'asset',
          markDeletionId,
          name: output.display_name || output.filename,
          id: output.assetId,
          tags: asset.tags,
          variants: widgetValueVariants(
            output.filename,
            output.type,
            output.subfolder,
            output.hash
          )
        }
      }
    )
    if (childAssets.length > 0) return childAssets

    const stored = getStoredOutputIdentity(asset)
    return [
      {
        kind: 'asset',
        id: asset.id,
        markDeletionId,
        name: getAssetDisplayName(asset),
        tags: asset.tags,
        variants: widgetValueVariants(
          asset.name,
          isGeneratedTempOutput(asset)
            ? 'temp'
            : (stored?.type ?? getAssetType(asset, 'input')),
          getOutputSubfolder(asset.user_metadata),
          asset.hash ?? stored?.hash
        )
      }
    ]
  })
}

export function getDeletionNames(operation: DeleteOperation): string[] {
  return [
    ...(operation.name ? [operation.name] : []),
    ...(operation.dependents
      ? operation.dependents.flatMap(getDeletionNames)
      : [])
  ]
}

export function getDeletionOperationCount(
  kind: DeleteOperation['kind'],
  operations: DeleteOperation[]
): number {
  return operations.reduce(
    (tally, op) =>
      tally +
      (op.kind === kind ? 1 : 0) +
      getDeletionOperationCount(kind, op.dependents ?? []),
    0
  )
}
