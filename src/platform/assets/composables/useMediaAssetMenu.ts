import { useI18n } from 'vue-i18n'

import { isCloud } from '@/platform/distribution/types'
import type { MenuEntry } from '@/types/menuTypes'
import { isPreviewableMediaType } from '@/utils/formatUtil'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'
import { supportsWorkflowMetadata } from '@/platform/workflow/utils/workflowExtractionUtil'

import { useMediaAssetActions } from './useMediaAssetActions'
import type { AssetItem } from '../schemas/assetSchema'
import type { AssetContext, MediaKind } from '../schemas/mediaAssetSchema'

type MediaAssetMenuContext = {
  asset: AssetItem
  assetType: AssetContext['type']
  fileKind: MediaKind
  showDeleteButton?: boolean
  selectedAssets?: AssetItem[]
  isBulkMode?: boolean
}

type MediaAssetMenuHandlers = {
  inspectAsset?: (asset: AssetItem) => void | Promise<void>
  assetDeleted?: (asset: AssetItem) => void | Promise<void>
  bulkDownload?: (assets: AssetItem[]) => void | Promise<void>
  bulkDelete?: (assets: AssetItem[]) => void | Promise<void>
  bulkAddToWorkflow?: (assets: AssetItem[]) => void | Promise<void>
  bulkOpenWorkflow?: (assets: AssetItem[]) => void | Promise<void>
  bulkExportWorkflow?: (assets: AssetItem[]) => void | Promise<void>
}

function canAddToWorkflow(
  candidate: AssetItem,
  assetType: AssetContext['type']
): boolean {
  if (assetType === 'output') return true

  if (assetType === 'input' && candidate.name) {
    return detectNodeTypeFromFilename(candidate.name).nodeType !== null
  }

  return false
}

function canShowWorkflowActions(
  candidate: AssetItem,
  assetType: AssetContext['type']
): boolean {
  if (assetType === 'output') return true

  if (assetType === 'input' && candidate.name) {
    return supportsWorkflowMetadata(candidate.name)
  }

  return false
}

function canDeleteAsset(
  assetType: AssetContext['type'],
  showDeleteButton?: boolean
): boolean {
  const propAllows = showDeleteButton ?? true
  const typeAllows =
    assetType === 'output' || (assetType === 'input' && isCloud)

  return propAllows && typeAllows
}

export function useMediaAssetMenu(handlers: MediaAssetMenuHandlers = {}) {
  const { t } = useI18n()
  const actions = useMediaAssetActions()

  async function deleteAsset(asset: AssetItem) {
    const deleted = await actions.deleteAssets(asset)

    if (deleted) {
      await handlers.assetDeleted?.(asset)
    }
  }

  async function deleteSelectedAssets(selectedAssets: AssetItem[]) {
    if (handlers.bulkDelete) {
      await handlers.bulkDelete(selectedAssets)
      return
    }

    await actions.deleteAssets(selectedAssets)
  }

  function getMenuEntries({
    asset,
    assetType,
    fileKind,
    showDeleteButton,
    selectedAssets,
    isBulkMode
  }: MediaAssetMenuContext): MenuEntry[] {
    const isSelectedAsset = selectedAssets?.some(
      (selectedAsset) => selectedAsset.id === asset.id
    )
    const showBulkActions =
      isBulkMode &&
      selectedAssets &&
      selectedAssets.length > 0 &&
      isSelectedAsset

    if (showBulkActions) {
      const allSelectedCanAddToWorkflow = selectedAssets.every(
        (selectedAsset) => canAddToWorkflow(selectedAsset, assetType)
      )
      const allSelectedSupportWorkflowActions = selectedAssets.every(
        (selectedAsset) => canShowWorkflowActions(selectedAsset, assetType)
      )
      const bulkDeleteEnabled = canDeleteAsset(assetType, showDeleteButton)

      return [
        {
          key: 'bulk-selection-header',
          label: t('mediaAsset.selection.multipleSelectedAssets'),
          disabled: true
        },
        ...(allSelectedCanAddToWorkflow
          ? [
              {
                key: 'bulk-add-to-workflow',
                label: t('mediaAsset.selection.insertAllAssetsAsNodes'),
                icon: 'icon-[comfy--node]',
                onClick: () => {
                  if (handlers.bulkAddToWorkflow) {
                    return handlers.bulkAddToWorkflow(selectedAssets)
                  }
                  return actions.addMultipleToWorkflow(selectedAssets)
                }
              } satisfies MenuEntry
            ]
          : []),
        ...(allSelectedSupportWorkflowActions
          ? [
              {
                key: 'bulk-open-workflow',
                label: t('mediaAsset.selection.openWorkflowAll'),
                icon: 'icon-[comfy--workflow]',
                onClick: () => {
                  if (handlers.bulkOpenWorkflow) {
                    return handlers.bulkOpenWorkflow(selectedAssets)
                  }
                  return actions.openMultipleWorkflows(selectedAssets)
                }
              } satisfies MenuEntry,
              {
                key: 'bulk-export-workflow',
                label: t('mediaAsset.selection.exportWorkflowAll'),
                icon: 'icon-[lucide--file-output]',
                onClick: () => {
                  if (handlers.bulkExportWorkflow) {
                    return handlers.bulkExportWorkflow(selectedAssets)
                  }
                  return actions.exportMultipleWorkflows(selectedAssets)
                }
              } satisfies MenuEntry
            ]
          : []),
        {
          key: 'bulk-download',
          label: t('mediaAsset.selection.downloadSelectedAll'),
          icon: 'icon-[lucide--download]',
          onClick: () => {
            if (handlers.bulkDownload) {
              return handlers.bulkDownload(selectedAssets)
            }
            return actions.downloadMultipleAssets(selectedAssets)
          }
        },
        ...(bulkDeleteEnabled
          ? [
              {
                key: 'bulk-delete',
                label: t('mediaAsset.selection.deleteSelectedAll'),
                icon: 'icon-[lucide--trash-2]',
                onClick: async () => {
                  await deleteSelectedAssets(selectedAssets)
                }
              } satisfies MenuEntry
            ]
          : [])
      ]
    }

    const entries: MenuEntry[] = []
    const showWorkflowActions = canShowWorkflowActions(asset, assetType)
    const deleteEnabled = canDeleteAsset(assetType, showDeleteButton)

    if (isPreviewableMediaType(fileKind)) {
      entries.push({
        key: 'inspect',
        label: t('mediaAsset.actions.inspect'),
        icon: 'icon-[lucide--zoom-in]',
        onClick: () => handlers.inspectAsset?.(asset)
      })
    }

    if (canAddToWorkflow(asset, assetType)) {
      entries.push({
        key: 'add-to-workflow',
        label: t('mediaAsset.actions.insertAsNodeInWorkflow'),
        icon: 'icon-[comfy--node]',
        onClick: () => actions.addWorkflow(asset)
      })
    }

    entries.push({
      key: 'download',
      label: t('mediaAsset.actions.download'),
      icon: 'icon-[lucide--download]',
      onClick: () => actions.downloadAsset(asset)
    })

    if (showWorkflowActions) {
      entries.push({ kind: 'divider', key: 'workflow-divider' })
      entries.push({
        key: 'open-workflow',
        label: t('mediaAsset.actions.openWorkflow'),
        icon: 'icon-[comfy--workflow]',
        onClick: () => actions.openWorkflow(asset)
      })
      entries.push({
        key: 'export-workflow',
        label: t('mediaAsset.actions.exportWorkflow'),
        icon: 'icon-[lucide--file-output]',
        onClick: () => actions.exportWorkflow(asset)
      })
    }

    if (assetType !== 'input') {
      entries.push({ kind: 'divider', key: 'copy-job-id-divider' })
      entries.push({
        key: 'copy-job-id',
        label: t('mediaAsset.actions.copyJobId'),
        icon: 'icon-[lucide--copy]',
        onClick: async () => {
          await actions.copyJobId(asset)
        }
      })
    }

    if (deleteEnabled) {
      entries.push({ kind: 'divider', key: 'delete-divider' })
      entries.push({
        key: 'delete',
        label: t('mediaAsset.actions.delete'),
        icon: 'icon-[lucide--trash-2]',
        onClick: async () => deleteAsset(asset)
      })
    }

    return entries
  }

  return { getMenuEntries }
}
