/* eslint-disable no-console */
import { useToast } from 'primevue/usetoast'
import { inject } from 'vue'

import { downloadFile } from '@/base/common/downloadUtil'
import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { getOutputAssetMetadata } from '../schemas/assetMetadataSchema'

import type { AssetMeta } from '../schemas/mediaAssetSchema'
import { MediaAssetKey } from '../schemas/mediaAssetSchema'

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

  const deleteAsset = (assetId: string) => {
    console.log('Deleting asset:', assetId)
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
