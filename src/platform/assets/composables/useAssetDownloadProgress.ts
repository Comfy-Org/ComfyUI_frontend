import { useEventListener } from '@vueuse/core'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

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

interface ToastState {
  dismissed: boolean
  completed: boolean
}

export interface AssetDownloadProgressOptions {
  onCompleted?: (download: AssetDownload) => void
  onFailed?: (download: AssetDownload) => void
}

export function useAssetDownloadProgress(
  options: AssetDownloadProgressOptions = {}
) {
  const { t } = useI18n()
  const toast = useToast()

  const activeDownloads = ref<Map<string, AssetDownload>>(new Map())
  const toastStates = ref<Map<string, ToastState>>(new Map())

  function showToast(download: AssetDownload) {
    const state = toastStates.value.get(download.taskId)

    if (download.status === 'completed') {
      if (state?.completed) return
      toastStates.value.set(download.taskId, {
        dismissed: false,
        completed: true
      })
      toast.add({
        severity: 'success',
        summary: t('g.completed'),
        detail: download.assetName,
        life: 5000,
        group: `download-${download.taskId}`
      })
      options.onCompleted?.(download)
      return
    }

    if (download.status === 'failed') {
      if (state?.completed) return
      toastStates.value.set(download.taskId, {
        dismissed: false,
        completed: true
      })
      toast.add({
        severity: 'error',
        summary: t('g.error'),
        detail: download.error ?? download.assetName,
        life: 10000,
        group: `download-${download.taskId}`
      })
      options.onFailed?.(download)
      return
    }

    if (state?.dismissed) return

    if (!state) {
      toastStates.value.set(download.taskId, { dismissed: false, completed: false })
    }

    toast.add({
      severity: 'info',
      summary: t('g.downloading'),
      detail: `${download.assetName} (${Math.round(download.progress * 100)}%)`,
      group: `download-${download.taskId}`,
      closable: true
    })
  }

  function dismissToast(taskId: string) {
    const state = toastStates.value.get(taskId)
    if (state) {
      state.dismissed = true
    }
    toast.removeGroup(`download-${taskId}`)
  }

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

      const state = toastStates.value.get(download.taskId)
      const isTerminal = data.status === 'completed' || data.status === 'failed'

      if (!isTerminal) {
        toast.removeGroup(`download-${download.taskId}`)
      }

      if (!state?.completed) {
        if (isTerminal) {
          toast.removeGroup(`download-${download.taskId}`)
        }
        showToast(download)
      }

      if (isTerminal) {
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
    downloadList,
    dismissToast
  }
}
