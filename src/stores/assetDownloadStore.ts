import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { st } from '@/i18n'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { AssetDownloadWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

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
  const activeDownloads = ref<Map<string, AssetDownload>>(new Map())
  const completionCallbacks = new Map<string, () => void>()

  const hasActiveDownloads = computed(() => activeDownloads.value.size > 0)
  const downloadList = computed(() =>
    Array.from(activeDownloads.value.values())
  )

  function onTaskComplete(taskId: string, callback: () => void) {
    completionCallbacks.set(taskId, callback)
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
      completionCallbacks.get(data.prompt_id)?.()
      completionCallbacks.delete(data.prompt_id)
      toastStore.add({
        severity: 'success',
        summary: st('assetBrowser.download.complete', 'Download complete'),
        detail: data.asset_name,
        life: 5000
      })
    } else if (data.status === 'failed') {
      activeDownloads.value.delete(data.prompt_id)
      completionCallbacks.delete(data.prompt_id)
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
    onTaskComplete,
    bindDownloadEvents,
    unbindDownloadEvents
  }
})
