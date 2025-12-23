import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { st } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { AssetDownloadWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'
import { useAssetsStore } from '@/stores/assetsStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

export interface AssetDownload {
  promptId: string
  assetName: string
  bytesTotal: number
  bytesDownloaded: number
  progress: number
  status: 'running' | 'completed' | 'failed'
  error?: string
}

export const useAssetDownloadStore = defineStore('assetDownload', () => {
  const toastStore = useToastStore()
  const assetsStore = useAssetsStore()
  const modelToNodeStore = useModelToNodeStore()
  const activeDownloads = ref<Map<string, AssetDownload>>(new Map())
  const pendingModelTypes = new Map<string, string>()

  const hasActiveDownloads = computed(() => activeDownloads.value.size > 0)
  const downloadList = computed(() =>
    Array.from(activeDownloads.value.values())
  )

  function trackDownload(taskId: string, modelType: string) {
    pendingModelTypes.set(taskId, modelType)
  }

  async function refreshModelCaches(modelType: string) {
    const providers = modelToNodeStore.getAllNodeProviders(modelType)
    await Promise.all(
      providers.map((provider) =>
        assetsStore.updateModelsForNodeType(provider.nodeDef.name)
      )
    )
  }

  function handleAssetDownload(e: CustomEvent<AssetDownloadWsMessage>) {
    const data = e.detail
    const download: AssetDownload = {
      promptId: data.prompt_id,
      assetName: data.asset_name,
      bytesTotal: data.bytes_total,
      bytesDownloaded: data.bytes_downloaded,
      progress: data.progress,
      status: data.status,
      error: data.error
    }

    if (data.status === 'completed') {
      activeDownloads.value.delete(data.prompt_id)
      const modelType = pendingModelTypes.get(data.prompt_id)
      if (modelType) {
        void refreshModelCaches(modelType)
        pendingModelTypes.delete(data.prompt_id)
      }
      toastStore.add({
        severity: 'success',
        summary: st('assetBrowser.download.complete', 'Download complete'),
        detail: data.asset_name,
        life: 5000
      })
    } else if (data.status === 'failed') {
      activeDownloads.value.delete(data.prompt_id)
      pendingModelTypes.delete(data.prompt_id)
      toastStore.add({
        severity: 'error',
        summary: st('assetBrowser.download.failed', 'Download failed'),
        detail: data.error || data.asset_name,
        life: 8000
      })
    } else {
      activeDownloads.value.set(data.prompt_id, download)
    }
  }

  function bindDownloadEvents() {
    api.addEventListener('asset_download', handleAssetDownload)
  }

  function unbindDownloadEvents() {
    api.removeEventListener('asset_download', handleAssetDownload)
  }

  return {
    activeDownloads,
    hasActiveDownloads,
    downloadList,
    trackDownload,
    bindDownloadEvents,
    unbindDownloadEvents
  }
})
