/* eslint-disable no-console */
import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import { isCloud } from '@/platform/distribution/types'
import { api } from '@/scripts/api'
import { extractPromptIdFromAssetId } from '@/utils/uuidUtil'

import type { AssetItem } from '../schemas/assetSchema'
import type { AssetMeta } from '../schemas/mediaAssetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'
import { assetService } from '../services/assetService'

export function useMediaAssetActions() {
  const toast = useToast()
  const mediaContext = inject(MediaAssetKey, null)

  const selectAsset = (asset: AssetMeta) => {
    console.log('Asset selected:', asset)
  }

  const downloadAsset = () => {
    const asset = mediaContext?.asset.value
    if (!asset) return

    try {
      const assetType = (asset as AssetItem).tags?.[0] || 'output'
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

  const deleteAsset = async (
    assetId: string,
    assetType: 'input' | 'output'
  ) => {
    try {
      if (assetType === 'output') {
        // For output files, delete from history
        const promptId = extractPromptIdFromAssetId(assetId)
        if (!promptId) {
          throw new Error('Unable to extract prompt ID from asset')
        }

        await api.deleteItem('history', promptId)

        toast.add({
          severity: 'success',
          summary: t('g.success'),
          detail: 'Asset deleted successfully',
          life: 2000
        })
        return true
      } else {
        // For input files, only allow deletion in cloud environment
        if (!isCloud) {
          toast.add({
            severity: 'warn',
            summary: t('g.warning'),
            detail:
              'Deleting imported files is only supported in cloud version',
            life: 3000
          })
          return false
        }

        // In cloud environment, use the assets API to delete
        await assetService.deleteAsset(assetId)

        toast.add({
          severity: 'success',
          summary: t('g.success'),
          detail: 'Asset deleted successfully',
          life: 2000
        })
        return true
      }

      throw new Error('Unable to determine asset type')
    } catch (error) {
      console.error('Failed to delete asset:', error)
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail:
          error instanceof Error ? error.message : 'Failed to delete asset',
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

    const promptId = extractPromptIdFromAssetId(asset.id)

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
        detail: 'Job ID copied to clipboard',
        life: 2000
      })
    } catch (error) {
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: 'Failed to copy job ID',
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

  return {
    selectAsset,
    downloadAsset,
    deleteAsset,
    playAsset,
    copyJobId,
    addWorkflow,
    openWorkflow,
    exportWorkflow,
    openMoreOutputs
  }
}
