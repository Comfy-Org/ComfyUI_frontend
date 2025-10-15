/* eslint-disable no-console */
import type { AssetMeta } from '../schemas/mediaAssetSchema'

export function useMediaAssetActions() {
  const selectAsset = (asset: AssetMeta) => {
    console.log('Asset selected:', asset)
  }

  const downloadAsset = (assetId: string) => {
    console.log('Downloading asset:', assetId)
  }

  const deleteAsset = (assetId: string) => {
    console.log('Deleting asset:', assetId)
  }

  const playAsset = (assetId: string) => {
    console.log('Playing asset:', assetId)
  }

  const copyAssetUrl = (assetId: string) => {
    console.log('Copy asset URL:', assetId)
  }

  const copyJobId = (jobId: string) => {
    console.log('Copy job ID:', jobId)
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
    copyAssetUrl,
    copyJobId,
    addWorkflow,
    openWorkflow,
    exportWorkflow,
    openMoreOutputs
  }
}
