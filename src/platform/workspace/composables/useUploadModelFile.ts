import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { WatchStopHandle } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { UploadModelSuccess } from '@/platform/assets/composables/useUploadModelWizard'
import { modelFileUploadApi } from '@/platform/workspace/api/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/workspace/api/modelFileUploadApi'
import { reportError } from '@/platform/telemetry/reportError'
import {
  isDownloadCancelled,
  useAssetDownloadStore
} from '@/stores/assetDownloadStore'

const MODEL_FILE_EXTENSION = '.safetensors'
const DEFAULT_MODEL_TYPE = 'loras'

type UploadStopped = Extract<ModelFileUploadResult, { ok: false }>

const FAILURE_COPY: Partial<Record<UploadStopped['reason'], string>> = {
  cancelled: 'assetBrowser.fileUpload.cancelled',
  unsupportedFile: 'assetBrowser.fileUpload.notSafetensors',
  unsupportedType: 'assetBrowser.fileUpload.unsupportedType',
  privateModelsDisabled: 'assetBrowser.fileUpload.privateModelsDisabled',
  planUnavailable: 'assetBrowser.fileUpload.planUnavailable'
}

type ModelFileUpload =
  | { status: 'idle'; error?: string }
  | { status: 'chosen'; file: File }
  | { status: 'uploading'; file: File; sent: number }
  | { status: 'saving'; file: File }
  | { status: 'done'; file: File; modelType: string }
  | { status: 'failed'; file: File; error: string }

/**
 * One model file chosen from the computer and uploaded into the workspace
 * library: choose it, pick its type, upload with progress or cancel.
 */
export function useUploadModelFile() {
  const { t } = useI18n()
  const { flags } = useFeatureFlags()
  const downloads = useAssetDownloadStore()
  const uploadFolders = computed(() => flags.modelUploadFolders)
  const isAvailable = computed(() => uploadFolders.value.length > 0)

  function defaultModelType() {
    return uploadFolders.value.includes(DEFAULT_MODEL_TYPE)
      ? DEFAULT_MODEL_TYPE
      : (uploadFolders.value[0] ?? '')
  }

  const state = shallowRef<ModelFileUpload>({ status: 'idle' })
  const modelType = ref(defaultModelType())
  let controller: AbortController | undefined
  let stopTaskWatch: WatchStopHandle | undefined
  let generation = 0

  function stop() {
    generation++
    controller?.abort()
    stopTaskWatch?.()
    stopTaskWatch = undefined
  }

  onScopeDispose(stop)

  function choose(file: File) {
    stop()
    if (!file.name.toLowerCase().endsWith(MODEL_FILE_EXTENSION)) {
      state.value = {
        status: 'idle',
        error: t('assetBrowser.fileUpload.notSafetensors')
      }
      return
    }
    modelType.value = defaultModelType()
    state.value = { status: 'chosen', file }
  }

  function failureText(failure: UploadStopped) {
    const copy = FAILURE_COPY[failure.reason]
    if (copy) return t(copy)
    return failure.message ?? t('assetBrowser.fileUpload.failed')
  }

  function taskOutcome(
    taskId: string,
    file: File,
    type: string
  ): ModelFileUpload | undefined {
    if (downloads.lastCompletedDownload?.taskId === taskId) {
      return { status: 'done', file, modelType: type }
    }
    const download = downloads.downloadList.find((d) => d.taskId === taskId)
    if (!download) return undefined
    if (download.status === 'completed') {
      return { status: 'done', file, modelType: type }
    }
    if (download.status === 'failed') {
      return {
        status: 'failed',
        file,
        error: download.error || t('assetBrowser.fileUpload.failed')
      }
    }
    if (isDownloadCancelled(download.status)) {
      return {
        status: 'failed',
        file,
        error: t('assetBrowser.fileUpload.cancelled')
      }
    }
    return undefined
  }

  function followTask(taskId: string, file: File, type: string) {
    const run = generation
    downloads.trackDownload(taskId, type, file.name)
    state.value = { status: 'saving', file }
    stopTaskWatch = watch(
      () => taskOutcome(taskId, file, type),
      (outcome) => {
        if (run === generation && outcome) state.value = outcome
      },
      { immediate: true }
    )
  }

  async function upload(): Promise<UploadModelSuccess | null> {
    const current = state.value
    if (current.status !== 'chosen' && current.status !== 'failed') return null

    stop()
    const run = generation
    const { file } = current
    const type = modelType.value
    controller = new AbortController()
    state.value = { status: 'uploading', file, sent: 0 }

    const result = await modelFileUploadApi.uploadModelFile(file, {
      tags: ['models', type],
      signal: controller.signal,
      onProgress: (sent) => {
        if (run === generation)
          state.value = { status: 'uploading', file, sent }
      }
    })
    if (run !== generation) return null

    if (!result.ok) {
      if (result.reason === 'failed') {
        reportError(result.cause, {
          surface: 'assets',
          errorType: 'error_uploading_model_file',
          level: 'warning'
        })
      }
      state.value = { status: 'failed', file, error: failureText(result) }
      return null
    }

    followTask(result.taskId, file, type)
    return {
      filename: file.name,
      modelType: type,
      taskId: result.taskId,
      status: 'processing'
    }
  }

  function cancel() {
    controller?.abort()
  }

  function reset() {
    stop()
    state.value = { status: 'idle' }
    modelType.value = defaultModelType()
  }

  return {
    isAvailable,
    uploadFolders,
    state,
    modelType,
    choose,
    upload,
    cancel,
    reset
  }
}
