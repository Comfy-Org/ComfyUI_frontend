import { useEventListener } from '@vueuse/core'
import { computed, ref } from 'vue'

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

export function useAssetDownloadProgress() {
  const activeDownloads = ref<Map<string, AssetDownload>>(new Map())

  useEventListener(
    api,
    'asset_download',
    (e: CustomEvent<AssetDownloadWsMessage>) => {
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

      if (data.status === 'completed' || data.status === 'failed') {
        activeDownloads.value.delete(data.prompt_id)
      } else {
        activeDownloads.value.set(data.prompt_id, download)
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
