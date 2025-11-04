/* eslint-disable no-console */
import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'

import ConfirmationDialogContent from '@/components/dialog/content/ConfirmationDialogContent.vue'
import { downloadFile } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'
import { useAssetsStore } from '@/stores/assetsStore'
import { useDialogStore } from '@/stores/dialogStore'

import type { AssetItem } from '../schemas/assetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'

export function useMediaAssetActions() {
  const toast = useToast()
  const dialogStore = useDialogStore()
  const mediaContext = inject(MediaAssetKey, null)

  const downloadAsset = () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    try {
      const assetType = asset.tags?.[0] || 'output'
      const filename = asset.name
      const downloadUrl = api.apiURL(
        `/view?filename=${encodeURIComponent(filename)}&type=${assetType}`
      )

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
        const assetType = asset.tags?.[0] || 'output'
        const filename = asset.name
        const downloadUrl = api.apiURL(
          `/view?filename=${encodeURIComponent(filename)}&type=${assetType}`
        )
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

  const playAsset = (assetId: string) => {
    console.log('Playing asset:', assetId)
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

    try {
      await navigator.clipboard.writeText(promptId)
      toast.add({
        severity: 'success',
        summary: t('g.success'),
        detail: t('mediaAsset.jobIdToast.jobIdCopied'),
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: t('mediaAsset.jobIdToast.jobIdCopyFailed'),
        life: 3000
      })
    }
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
    playAsset,
    copyJobId,
    addWorkflow,
    openWorkflow,
    exportWorkflow,
    openMoreOutputs
  }
}
