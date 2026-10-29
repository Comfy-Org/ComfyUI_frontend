import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { WatchStopHandle } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type { UploadModelSuccess } from '@/platform/assets/composables/useUploadModelWizard'
import { modelFileUploadApi } from '@/platform/workspace/api/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/workspace/api/modelFileUploadApi'
import { reportError } from '@comfyorg/telemetry/reportError'
import { useAssetDownloadStore } from '@/stores/assetDownloadStore'

const MODEL_FILE_EXTENSION = '.safetensors'
const DEFAULT_MODEL_TYPE = 'loras'

type UploadStopped = Extract<ModelFileUploadResult, { ok: false }>

/** The words for each way an upload stops; any other failure shows the server's message or the generic one. */
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
  const isAvailable = computed(
    () => flags.runtimeLibraryModelsEnabled && uploadFolders.value.length > 0
  )

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

  function followTask(taskId: string, file: File, type: string) {
    const run = generation
    downloads.trackDownload(taskId, type, file.name)
    state.value = { status: 'saving', file }
    stopTaskWatch = watch(
      () => downloads.downloadList.find((d) => d.taskId === taskId),
      (download) => {
        if (run !== generation || !download) return
        if (download.status === 'completed') {
          state.value = { status: 'done', file, modelType: type }
        } else if (download.status === 'failed') {
          state.value = {
            status: 'failed',
            file,
            error: download.error || t('assetBrowser.fileUpload.failed')
          }
        }
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
