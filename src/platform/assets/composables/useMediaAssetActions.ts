/* eslint-disable no-console */
import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import { downloadFile } from '@/base/common/downloadUtil'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'
import { getAssetType } from '../utils/assetTypeUtil'
import { getAssetUrl } from '../utils/assetUrlUtil'

import type { AssetItem } from '../schemas/assetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'

export function useMediaAssetActions() {
  const toast = useToast()
  const dialogStore = useDialogStore()
  const mediaContext = inject(MediaAssetKey, null)
  const { copyToClipboard } = useCopyToClipboard()

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
        downloadUrl = getAssetUrl(asset)
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

  const playAsset = (assetId: string) => {
    console.log('Playing asset:', assetId)
  }

  const copyJobId = async () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    // Try asset.id first (OSS), then fall back to metadata (Cloud)
    const metadata = getOutputAssetMetadata(asset.user_metadata)
    const promptId = asset.id || metadata?.promptId

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

  const addWorkflow = (assetId: string) => {
    console.log('Adding asset to workflow:', assetId)
  }

  const openWorkflow = (assetId: string) => {
    console.log('Opening workflow for asset:', assetId)
  }

  const exportWorkflow = (assetId: string) => {
    console.log('Exporting workflow for asset:', assetId)
  }

  const openMoreOutputs = (assetId: string) => {
    console.log('Opening more outputs for asset:', assetId)
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
              // Delete all assets using the shared helper
              // Silently skip assets that can't be deleted (e.g., input assets in non-cloud)
              await Promise.all(
                assets.map(async (asset) => {
                  const assetType = getAssetType(asset)
                  try {
                    await deleteAssetApi(asset, assetType)
                  } catch (error) {
                    // Log but don't fail the entire batch for individual errors
                    console.warn(`Failed to delete asset ${asset.name}:`, error)
                  }
                })
              )

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
    playAsset,
    copyJobId,
    addWorkflow,
    openWorkflow,
    exportWorkflow,
    openMoreOutputs
  }
}
