/* eslint-disable no-console */
import type { AssetMeta } from '@/types/media.types'

export interface MediaAssetActions {
  onSelect: (asset: AssetMeta) => void
  onView: (assetId: string) => void
  onDownload: (assetId: string) => void
  onDelete: (assetId: string) => void
  onPlay: (assetId: string) => void
  // Internal actions (not emitted to parent)
  onCopy: (assetId: string) => void
  onCopyJobId: (assetId: string) => void
  onMore: (assetId: string) => void
  onAddToWorkflow: (assetId: string) => void
  onOpenWorkflow: (assetId: string) => void
  onExportWorkflow: (assetId: string) => void
  onOutputCountClick: (assetId: string) => void
}

export function useMediaAssetActions(emit: any): MediaAssetActions {
  return {
    // Actions that emit to parent
    onSelect: (asset: AssetMeta) => emit('select', asset),
    onView: (assetId: string) => emit('view', assetId),
    onDownload: (assetId: string) => emit('download', assetId),
    onDelete: (assetId: string) => emit('delete', assetId),
    onPlay: (assetId: string) => emit('play', assetId),
    // Internal actions (can be extended later)
    onCopy: (assetId: string) => console.log('Copy:', assetId),
    onCopyJobId: (assetId: string) => console.log('Copy Job ID:', assetId),
    onMore: (assetId: string) => console.log('More:', assetId),
    onAddToWorkflow: (assetId: string) =>
      console.log('Add to workflow:', assetId),
    onOpenWorkflow: (assetId: string) => console.log('Open workflow:', assetId),
    onExportWorkflow: (assetId: string) =>
      console.log('Export workflow:', assetId),
    onOutputCountClick: (assetId: string) =>
      console.log('Output count:', assetId)
  }
}
