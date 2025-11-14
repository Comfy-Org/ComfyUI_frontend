import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import { downloadFile } from '@/base/common/downloadUtil'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import { api } from '@/scripts/api'
import { getWorkflowDataFromFile } from '@/scripts/metadata/parser'
import { downloadBlob } from '@/scripts/utils'
import { useDialogService } from '@/services/dialogService'
import { useLitegraphService } from '@/services/litegraphService'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'
import { createAnnotatedPath } from '@/utils/createAnnotatedPath'
import { appendJsonExt } from '@/utils/formatUtil'

import type { AssetItem } from '../schemas/assetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'
import type { ResultItemType } from '@/schemas/apiSchema'

export function useMediaAssetActions() {
  const toast = useToast()
  const dialogStore = useDialogStore()
  const mediaContext = inject(MediaAssetKey, null)
  const { copyToClipboard } = useCopyToClipboard()
  const workflowStore = useWorkflowStore()
  const workflowService = useWorkflowService()
  const litegraphService = useLitegraphService()
  const nodeDefStore = useNodeDefStore()
  const settingStore = useSettingStore()
  const dialogService = useDialogService()

  const downloadAsset = () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    try {
      const filename = asset.name
      let downloadUrl: string

      // In cloud, use preview_url directly (from cloud storage)
      // In OSS/localhost, use the /view endpoint
      if (isCloud && asset.src) {
        downloadUrl = asset.src
      } else {
        const assetType = asset.tags?.[0] || 'output'
        downloadUrl = api.apiURL(
          `/view?filename=${encodeURIComponent(filename)}&type=${assetType}`
        )
      }

      downloadFile(downloadUrl, filename)

      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('g.downloadStarted'),
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
          const assetType = asset.tags?.[0] || 'output'
          downloadUrl = api.apiURL(
            `/view?filename=${encodeURIComponent(filename)}&type=${assetType}`
          )
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
    const assetType = asset.tags?.[0] || 'output'

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
      if (assetType === 'output') {
        // For output files, delete from history
        const promptId =
          asset.id || getOutputAssetMetadata(asset.user_metadata)?.promptId
        if (!promptId) {
          throw new Error('Unable to extract prompt ID from asset')
        }

        await api.deleteItem('history', promptId)

        // Update history assets in store after deletion
        await assetsStore.updateHistory()

        toast.add({
          severity: 'success',
          summary: t('g.success'),
          detail: t('mediaAsset.assetDeletedSuccessfully'),
          life: 2000
        })
        return true
      } else {
        // For input files, only allow deletion in cloud environment
        if (!isCloud) {
          toast.add({
            severity: 'warn',
            summary: t('g.warning'),
            detail: t('mediaAsset.deletingImportedFilesCloudOnly'),
            life: 3000
          })
          return false
        }

        // In cloud environment, use the assets API to delete
        await assetService.deleteAsset(asset.id)

        // Update input assets in store after deletion
        await assetsStore.updateInputs()

        toast.add({
          severity: 'success',
          summary: t('g.success'),
          detail: t('mediaAsset.assetDeletedSuccessfully'),
          life: 2000
        })
        return true
      }
    } catch (error) {
      console.error('Failed to delete asset:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail:
          error instanceof Error
            ? error.message
            : t('mediaAsset.failedToDeleteAsset'),
        life: 3000
      })
      return false
    }
  }

  const copyJobId = async () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    // Get promptId from metadata instead of parsing the ID string
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    const promptId = metadata?.promptId

    if (!promptId) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: 'No job ID found for this asset',
        life: 2000
      })
      return
    }

    await copyToClipboard(promptId)
  }

  /**
   * Helper function to get workflow data from asset
   * Tries to get workflow from metadata first, then falls back to extracting from file
   */
  const getWorkflowFromAsset = async (
    asset: AssetItem
  ): Promise<ComfyWorkflowJSON | null> => {
    // First try to get workflow from metadata (for output assets)
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    if (metadata?.workflow) {
      return metadata.workflow as ComfyWorkflowJSON
    }

    // For input assets or assets with embedded workflow, try to extract from file
    // Fetch the file and extract workflow metadata
    try {
      const assetType = asset.tags?.[0] || 'output'
      const fileUrl = api.apiURL(
        `/view?filename=${encodeURIComponent(asset.name)}&type=${assetType}`
      )
      const response = await fetch(fileUrl)
      if (!response.ok) {
        return null
      }

      const blob = await response.blob()
      const file = new File([blob], asset.name, { type: blob.type })

      const workflowData = await getWorkflowDataFromFile(file)
      if (workflowData?.workflow) {
        // Handle both string and object workflow data
        if (typeof workflowData.workflow === 'string') {
          return JSON.parse(workflowData.workflow) as ComfyWorkflowJSON
        }
        return workflowData.workflow as ComfyWorkflowJSON
      }
    } catch (error) {
      console.error('Failed to extract workflow from file:', error)
    }

    return null
  }

  /**
   * Add a loader node to the current workflow for this asset
   * Similar to useJobMenu's addOutputLoaderNode
   */
  const addWorkflow = async () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    // Determine the appropriate loader node type based on file extension
    const filename = asset.name.toLowerCase()
    let nodeType: 'LoadImage' | 'LoadVideo' | 'LoadAudio' | null = null
    let widgetName: 'image' | 'file' | 'audio' | null = null

    if (
      filename.endsWith('.png') ||
      filename.endsWith('.jpg') ||
      filename.endsWith('.jpeg') ||
      filename.endsWith('.webp') ||
      filename.endsWith('.gif')
    ) {
      nodeType = 'LoadImage'
      widgetName = 'image'
    } else if (
      filename.endsWith('.mp4') ||
      filename.endsWith('.webm') ||
      filename.endsWith('.mov')
    ) {
      nodeType = 'LoadVideo'
      widgetName = 'file'
    } else if (
      filename.endsWith('.mp3') ||
      filename.endsWith('.wav') ||
      filename.endsWith('.ogg') ||
      filename.endsWith('.flac')
    ) {
      nodeType = 'LoadAudio'
      widgetName = 'audio'
    }

    if (!nodeType || !widgetName) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: 'Unsupported file type for loader node',
        life: 2000
      })
      return
    }

    const nodeDef = nodeDefStore.nodeDefsByName[nodeType]
    if (!nodeDef) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: `Node type ${nodeType} not found`,
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
        detail: 'Failed to create node',
        life: 3000
      })
      return
    }

    // Get metadata to construct the annotated path
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    const assetType = asset.tags?.[0] || 'input'

    const isResultItemType = (v: string | undefined): v is ResultItemType =>
      v === 'input' || v === 'output' || v === 'temp'

    // Create annotated path for the asset
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

    toast.add({
      severity: 'success',
      summary: t('g.success'),
      detail: `${nodeType} node added to workflow`,
      life: 2000
    })
  }

  /**
   * Open the workflow from this asset in a new tab
   * Similar to useJobMenu's openJobWorkflow
   */
  const openWorkflow = async () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    const workflow = await getWorkflowFromAsset(asset)
    if (!workflow) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: 'No workflow data found in this asset',
        life: 2000
      })
      return
    }

    try {
      const filename = `${asset.name.replace(/\.[^/.]+$/, '')}.json`
      const temp = workflowStore.createTemporary(filename, workflow)
      await workflowService.openWorkflow(temp)

      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: 'Workflow opened in new tab',
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail:
          error instanceof Error ? error.message : 'Failed to open workflow',
        life: 3000
      })
    }
  }

  /**
   * Export the workflow from this asset as a JSON file
   * Similar to useJobMenu's exportJobWorkflow
   */
  const exportWorkflow = async () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    const workflow = await getWorkflowFromAsset(asset)
    if (!workflow) {
      toast.add({
        severity: 'warn',
        summary: t('g.warning'),
        detail: 'No workflow data found in this asset',
        life: 2000
      })
      return
    }

    try {
      let filename = `${asset.name.replace(/\.[^/.]+$/, '')}.json`

      if (settingStore.get('Comfy.PromptFilename')) {
        const input = await dialogService.prompt({
          title: t('workflowService.exportWorkflow'),
          message: t('workflowService.enterFilename') + ':',
          defaultValue: filename
        })
        if (!input) return
        filename = appendJsonExt(input)
      }

      const json = JSON.stringify(workflow, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      downloadBlob(filename, blob)

      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: 'Workflow exported successfully',
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail:
          error instanceof Error ? error.message : 'Failed to export workflow',
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
              // Delete all assets
              await Promise.all(
                assets.map(async (asset) => {
                  const assetType = asset.tags?.[0] || 'output'
                  if (assetType === 'output') {
                    const promptId =
                      asset.id ||
                      getOutputAssetMetadata(asset.user_metadata)?.promptId
                    if (promptId) {
                      await api.deleteItem('history', promptId)
                    }
                  } else if (isCloud) {
                    await assetService.deleteAsset(asset.id)
                  }
                })
              )

              // Update stores after deletions
              await assetsStore.updateHistory()
              if (assets.some((a) => a.tags?.[0] === 'input')) {
                await assetsStore.updateInputs()
              }

              toast.add({
                severity: 'success',
                summary: t('g.success'),
                detail: t('mediaAsset.selection.assetsDeletedSuccessfully', {
                  count: assets.length
                }),
                life: 2000
              })
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
    openWorkflow,
    exportWorkflow
  }
}
