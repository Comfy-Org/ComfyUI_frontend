import { useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { AssetDownloadWsMessage } from '@/schemas/apiSchema'
import { api } from '@/scripts/api'

export interface AssetDownload {
  taskId: string
  assetId: string
  assetName: string
  bytesTotal: number
  bytesDownloaded: number
  progress: number
  status: 'created' | 'running' | 'completed' | 'failed'
  error?: string
}

export function useAssetDownloadProgress() {
  const activeDownloads = ref<Map<string, AssetDownload>>(new Map())

  useEventListener(
    api,
    'asset_download',
    (e: CustomEvent<AssetDownloadWsMessage>) => {
      const data = e.detail
      const download: AssetDownload = {
        taskId: data.task_id,
        assetId: data.asset_id,
        assetName: data.asset_name,
        bytesTotal: data.bytes_total,
        bytesDownloaded: data.bytes_downloaded,
        progress: data.progress,
        status: data.status,
        error: data.error
      }

      if (data.status === 'completed' || data.status === 'failed') {
        activeDownloads.value.delete(data.task_id)
      } else {
        activeDownloads.value.set(data.task_id, download)
      }
    }
  )

  const hasActiveDownloads = computed(() => activeDownloads.value.size > 0)

  const downloadList = computed(() =>
    Array.from(activeDownloads.value.values())
  )

  return {
    activeDownloads,
    hasActiveDownloads,
    downloadList
  }
}
