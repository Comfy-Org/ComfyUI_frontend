import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'
import { useI18n } from 'vue-i18n'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import { downloadFile } from '@/base/common/downloadUtil'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { isCloud } from '@/platform/distribution/types'
import { useWorkflowActionsService } from '@/platform/workflow/core/services/workflowActionsService'
import { extractWorkflowFromAsset } from '@/platform/workflow/utils/workflowExtractionUtil'
import { api } from '@/scripts/api'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getAssetType } from '../utils/assetTypeUtil'
import { getAssetUrl } from '../utils/assetUrlUtil'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { detectNodeTypeFromFilename } from '@/utils/loaderNodeUtil'
import { isResultItemType } from '@/utils/typeGuardUtil'

import type { AssetItem } from '../schemas/assetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'

export function useMediaAssetActions() {
  const { t } = useI18n()
  const toast = useToast()
  const dialogStore = useDialogStore()
  const mediaContext = inject(MediaAssetKey, null)
  const { copyToClipboard } = useCopyToClipboard()
  const workflowActions = useWorkflowActionsService()
  const litegraphService = useLitegraphService()
  const nodeDefStore = useNodeDefStore()

  /**
   * Internal helper to perform the API deletion for a single asset
   * Handles both output assets (via history API) and input assets (via asset service)
   * @throws Error if deletion fails or is not allowed
   */
  const deleteAssetApi = async (
    asset: AssetItem,
    assetType: string
  ): Promise<void> => {
    if (assetType === 'output') {
      const promptId =
        asset.id || getOutputAssetMetadata(asset.user_metadata)?.promptId
      if (!promptId) {
        throw new Error('Unable to extract prompt ID from asset')
      }
      await api.deleteItem('history', promptId)
    } else {
      // Input assets can only be deleted in cloud environment
      if (!isCloud) {
        throw new Error(t('mediaAsset.deletingImportedFilesCloudOnly'))
      }
      await assetService.deleteAsset(asset.id)
    }
  }

  const downloadAsset = (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    try {
      const filename = targetAsset.name
      let downloadUrl: string

      // In cloud, use preview_url directly (from cloud storage)
      // In OSS/localhost, use the /view endpoint
      if (isCloud && targetAsset.preview_url) {
        downloadUrl = targetAsset.preview_url
      } else {
        downloadUrl = getAssetUrl(targetAsset)
      }

      downloadFile(downloadUrl, filename)

      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.downloadsStarted', { count: 1 }),
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.failedToDownloadImage'),
        life: 3000
      })
    }
  }

  /**
   * Download multiple assets at once
   * @param assets Array of assets to download
   */
  const downloadMultipleAssets = (assets: AssetItem[]) => {
    if (!assets || assets.length === 0) return

    try {
      assets.forEach((asset) => {
        const filename = asset.name
        let downloadUrl: string

        // In cloud, use preview_url directly (from GCS or other cloud storage)
        // In OSS/localhost, use the /view endpoint
        if (isCloud && asset.preview_url) {
          downloadUrl = asset.preview_url
        } else {
          downloadUrl = getAssetUrl(asset)
        }
        downloadFile(downloadUrl, filename)
      })

      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.downloadsStarted', {
          count: assets.length
        }),
        life: 2000
      })
    } catch (error) {
      console.error('Failed to download assets:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('g.failedToDownloadImage'),
        life: 3000
      })
    }
  }

  /**
   * Show confirmation dialog and delete asset if confirmed
   * @param asset The asset to delete
   * @returns true if the asset was deleted, false otherwise
   */
  const confirmDelete = async (asset: AssetItem): Promise<boolean> => {
    const assetType = getAssetType(asset)

    return new Promise((resolve) => {
      dialogStore.showDialog({
        key: 'delete-asset-confirmation',
        title: t('mediaAsset.deleteAssetTitle'),
        component: ConfirmationDialogContent,
        props: {
          message: t('mediaAsset.deleteAssetDescription'),
          type: 'delete',
          itemList: [asset.name],
          onConfirm: async () => {
            const success = await deleteAsset(asset, assetType)
            resolve(success)
          },
          onCancel: () => {
            resolve(false)
          }
        }
      })
    })
  }

  const deleteAsset = async (asset: AssetItem, assetType: string) => {
    const assetsStore = useAssetsStore()

    try {
      // Perform the deletion
      await deleteAssetApi(asset, assetType)

      // Update the appropriate store based on asset type
      if (assetType === 'output') {
        await assetsStore.updateHistory()
      } else {
        await assetsStore.updateInputs()
      }

      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.assetDeletedSuccessfully'),
        life: 2000
      })
      return true
    } catch (error) {
      console.error('Failed to delete asset:', error)
      const errorMessage = error instanceof Error ? error.message : ''
      const isCloudWarning = errorMessage.includes('Cloud')

      toast.add({
        severity: isCloudWarning ? 'warn' : 'error',
        summary: isCloudWarning ? t('g.warning') : t('g.error'),
        detail: errorMessage || t('mediaAsset.failedToDeleteAsset'),
        life: 3000
      })
      return false
    }
  }

  const copyJobId = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    // Try asset.id first (OSS), then fall back to metadata (Cloud)
    const metadata = getOutputAssetMetadata(targetAsset.user_metadata)
    const promptId = targetAsset.id || metadata?.promptId

    if (!promptId) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.noJobIdFound'),
        life: 2000
      })
      return
    }

    await copyToClipboard(promptId)
  }

  /**
   * Add a loader node to the current workflow for this asset
   * Uses shared utility to detect appropriate node type based on file extension
   */
  const addWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    // Detect node type using shared utility
    const { nodeType, widgetName } = detectNodeTypeFromFilename(
      targetAsset.name
    )

    if (!nodeType || !widgetName) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.unsupportedFileType'),
        life: 2000
      })
      return
    }

    const nodeDef = nodeDefStore.nodeDefsByName[nodeType]
    if (!nodeDef) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('mediaAsset.nodeTypeNotFound', { nodeType }),
        life: 3000
      })
      return
    }

    const node = litegraphService.addNodeOnGraph(nodeDef, {
      pos: litegraphService.getCanvasCenter()
    })

    if (!node) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('mediaAsset.failedToCreateNode'),
        life: 3000
      })
      return
    }

    // Get metadata to construct the annotated path
    const metadata = getOutputAssetMetadata(targetAsset.user_metadata)
    const assetType = getAssetType(targetAsset, 'input')

    // Create annotated path for the asset
    const annotated = createAnnotatedPath(
      {
        filename: targetAsset.name,
        subfolder: metadata?.subfolder || '',
        type: isResultItemType(assetType) ? assetType : undefined
      },
      {
        rootFolder: isResultItemType(assetType) ? assetType : undefined
      }
    )

    const widget = node.widgets?.find((w) => w.name === widgetName)
    if (widget) {
      widget.value = annotated
      widget.callback?.(annotated)
    }
    node.graph?.setDirtyCanvas(true, true)

    toast.add({
      severity: 'success',
      summary: t('g.success'),
      detail: t('mediaAsset.nodeAddedToWorkflow', { nodeType }),
      life: 2000
    })
  }

  /**
   * Open the workflow from this asset in a new tab
   * Uses shared workflow extraction and action service
   */
  const openWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    // Extract workflow using shared utility
    const { workflow, filename } = await extractWorkflowFromAsset(targetAsset)

    // Use shared action service
    const result = await workflowActions.openWorkflowAction(workflow, filename)

    if (!result.success) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: result.error || t('mediaAsset.noWorkflowDataFound'),
        life: 2000
      })
    } else {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.workflowOpenedInNewTab'),
        life: 2000
      })
    }
  }

  /**
   * Export the workflow from this asset as a JSON file
   * Uses shared workflow extraction and action service
   */
  const exportWorkflow = async (asset?: AssetItem) => {
    const targetAsset = asset ?? mediaContext?.asset.value
    if (!targetAsset) return

    // Extract workflow using shared utility
    const { workflow, filename } = await extractWorkflowFromAsset(targetAsset)

    // Use shared action service
    const result = await workflowActions.exportWorkflowAction(
      workflow,
      filename
    )

    if (!result.success) {
      const isNoWorkflow = result.error?.includes('No workflow')
      toast.add({
        severity: isNoWorkflow ? 'warn' : 'error',
        summary: isNoWorkflow ? t('g.warning') : t('g.error'),
        detail: result.error || t('mediaAsset.failedToExportWorkflow'),
        life: 3000
      })
    } else {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.workflowExportedSuccessfully'),
        life: 2000
      })
    }
  }

  /**
   * Add multiple assets to the current workflow
   * Creates loader nodes for each asset
   */
  const addMultipleToWorkflow = async (assets: AssetItem[]) => {
    if (!assets || assets.length === 0) return

    const NODE_OFFSET = 50
    let nodeIndex = 0
    let succeeded = 0
    let failed = 0

    for (const asset of assets) {
      const { nodeType, widgetName } = detectNodeTypeFromFilename(asset.name)

      if (!nodeType || !widgetName) {
        failed++
        continue
      }

      const nodeDef = nodeDefStore.nodeDefsByName[nodeType]
      if (!nodeDef) {
        failed++
        continue
      }

      const center = litegraphService.getCanvasCenter()
      const node = litegraphService.addNodeOnGraph(nodeDef, {
        pos: [
          center[0] + nodeIndex * NODE_OFFSET,
          center[1] + nodeIndex * NODE_OFFSET
        ]
      })

      if (!node) {
        failed++
        continue
      }

      const metadata = getOutputAssetMetadata(asset.user_metadata)
      const assetType = getAssetType(asset, 'input')

      const annotated = createAnnotatedPath(
        {
          filename: asset.name,
          subfolder: metadata?.subfolder || '',
          type: isResultItemType(assetType) ? assetType : undefined
        },
        {
          rootFolder: isResultItemType(assetType) ? assetType : undefined
        }
      )

      const widget = node.widgets?.find((w) => w.name === widgetName)
      if (widget) {
        widget.value = annotated
        widget.callback?.(annotated)
      }
      node.graph?.setDirtyCanvas(true, true)
      succeeded++
      nodeIndex++
    }

    if (failed === 0) {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.nodesAddedToWorkflow', {
          count: succeeded
        }),
        life: 2000
      })
    } else if (succeeded === 0) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('mediaAsset.selection.failedToAddNodes'),
        life: 3000
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.partialAddNodesSuccess', {
          succeeded,
          failed
        }),
        life: 3000
      })
    }
  }

  /**
   * Open workflows from multiple assets in new tabs
   */
  const openMultipleWorkflows = async (assets: AssetItem[]) => {
    if (!assets || assets.length === 0) return

    let succeeded = 0
    let failed = 0

    for (const asset of assets) {
      try {
        const { workflow, filename } = await extractWorkflowFromAsset(asset)
        const result = await workflowActions.openWorkflowAction(
          workflow,
          filename
        )

        if (result.success) {
          succeeded++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    if (failed === 0) {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.workflowsOpened', { count: succeeded }),
        life: 2000
      })
    } else if (succeeded === 0) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.noWorkflowsFound'),
        life: 3000
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.partialWorkflowsOpened', {
          succeeded,
          failed
        }),
        life: 3000
      })
    }
  }

  /**
   * Export workflows from multiple assets as JSON files
   */
  const exportMultipleWorkflows = async (assets: AssetItem[]) => {
    if (!assets || assets.length === 0) return

    let succeeded = 0
    let failed = 0

    for (const asset of assets) {
      try {
        const { workflow, filename } = await extractWorkflowFromAsset(asset)
        const result = await workflowActions.exportWorkflowAction(
          workflow,
          filename
        )

        if (result.success) {
          succeeded++
        } else {
          failed++
        }
      } catch {
        failed++
      }
    }

    if (failed === 0) {
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.selection.workflowsExported', {
          count: succeeded
        }),
        life: 2000
      })
    } else if (succeeded === 0) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.noWorkflowsToExport'),
        life: 3000
      })
    } else {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: t('mediaAsset.selection.partialWorkflowsExported', {
          succeeded,
          failed
        }),
        life: 3000
      })
    }
  }

  /**
   * Delete multiple assets with confirmation dialog
   * @param assets Array of assets to delete
   */
  const deleteMultipleAssets = async (assets: AssetItem[]) => {
    if (!assets || assets.length === 0) return

    const assetsStore = useAssetsStore()

    return new Promise<void>((resolve) => {
      dialogStore.showDialog({
        key: 'delete-multiple-assets-confirmation',
        title: t('mediaAsset.deleteSelectedTitle'),
        component: ConfirmationDialogContent,
        props: {
          message: t('mediaAsset.deleteSelectedDescription', {
            count: assets.length
          }),
          type: 'delete',
          itemList: assets.map((asset) => asset.name),
          onConfirm: async () => {
            try {
              // Delete all assets using Promise.allSettled to track individual results
              const results = await Promise.allSettled(
                assets.map((asset) =>
                  deleteAssetApi(asset, getAssetType(asset))
                )
              )

              // Count successes and failures
              const succeeded = results.filter(
                (r) => r.status === 'fulfilled'
              ).length
              const failed = results.filter((r) => r.status === 'rejected')

              // Log failed deletions for debugging
              failed.forEach((result, index) => {
                console.warn(
                  `Failed to delete asset ${assets[index].name}:`,
                  result.reason
                )
              })

              // Update stores after deletions
              const hasOutputAssets = assets.some(
                (a) => getAssetType(a) === 'output'
              )
              const hasInputAssets = assets.some(
                (a) => getAssetType(a) === 'input'
              )

              if (hasOutputAssets) {
                await assetsStore.updateHistory()
              }
              if (hasInputAssets) {
                await assetsStore.updateInputs()
              }

              // Show appropriate feedback based on results
              if (failed.length === 0) {
                // All succeeded
                toast.add({
                  severity: 'success',
                  summary: t('g.success'),
                  detail: t('mediaAsset.selection.assetsDeletedSuccessfully', {
                    count: succeeded
                  }),
                  life: 2000
                })
              } else if (succeeded === 0) {
                // All failed
                toast.add({
                  severity: 'error',
                  summary: t('g.error'),
                  detail: t('mediaAsset.selection.failedToDeleteAssets'),
                  life: 3000
                })
              } else {
                // Partial success
                toast.add({
                  severity: 'warn',
                  summary: t('g.warning'),
                  detail: t('mediaAsset.selection.partialDeleteSuccess', {
                    succeeded,
                    failed: failed.length
                  }),
                  life: 3000
                })
              }
            } catch (error) {
              console.error('Failed to delete assets:', error)
              toast.add({
                severity: 'error',
                summary: t('g.error'),
                detail: t('mediaAsset.selection.failedToDeleteAssets'),
                life: 3000
              })
            }

            resolve()
          },
          onCancel: () => {
            resolve()
          }
        }
      })
    })
  }

  return {
    downloadAsset,
    downloadMultipleAssets,
    confirmDelete,
    deleteAsset,
    deleteMultipleAssets,
    copyJobId,
    addWorkflow,
    addMultipleToWorkflow,
    openWorkflow,
    openMultipleWorkflows,
    exportWorkflow,
    exportMultipleWorkflows
  }
}
