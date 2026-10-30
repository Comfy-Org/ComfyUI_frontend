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
import type { AssetDownloadStatus } from '@/stores/assetDownloadStore'

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

/** Where one model file upload stands. */
export type ModelFileUpload =
  | { status: 'idle'; error?: string }
  | { status: 'chosen'; file: File }
  | { status: 'stopping'; file: File }
  | { status: 'uploading'; file: File; sent: number }
  | { status: 'saving'; file: File }
  | { status: 'done'; file: File; modelType: string }
  | { status: 'failed'; file: File; error: string; taskId?: string }

type ReadyToSend = Extract<ModelFileUpload, { status: 'chosen' | 'failed' }>

interface FollowedTask {
  id: string
  file: File
  modelType: string
  status?: AssetDownloadStatus
  error?: string
}

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
  let task: FollowedTask | undefined
  let stopTaskWatch: WatchStopHandle | undefined
  let generation = 0

  function stopFollowing() {
    stopTaskWatch?.()
    stopTaskWatch = undefined
    task = undefined
  }

  function stop() {
    generation++
    controller?.abort()
    stopFollowing()
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

  function progressRow(taskId: string) {
    return downloads.downloadList.find((d) => d.taskId === taskId)
  }

  function taskOutcome(followed: FollowedTask): ModelFileUpload | undefined {
    const { status, file, id: taskId } = followed
    if (status === 'completed') {
      return { status: 'done', file, modelType: followed.modelType }
    }
    if (status === 'failed') {
      return {
        status: 'failed',
        file,
        taskId,
        error: followed.error || t('assetBrowser.fileUpload.failed')
      }
    }
    if (status && isDownloadCancelled(status)) {
      return {
        status: 'failed',
        file,
        taskId,
        error: t('assetBrowser.fileUpload.cancelled')
      }
    }
    return undefined
  }

  function heldBack(followed: FollowedTask, error: string): ModelFileUpload {
    const outcome = taskOutcome(followed)
    if (outcome?.status === 'done') return outcome
    return { status: 'failed', file: followed.file, taskId: followed.id, error }
  }

  function watchTask(followed: FollowedTask) {
    return watch(
      () => {
        if (downloads.lastCompletedDownload?.taskId === followed.id) {
          return { status: 'completed' as const, error: undefined }
        }
        const row = progressRow(followed.id)
        return { status: row?.status, error: row?.error }
      },
      ({ status, error }) => {
        if (!status || followed.status === 'completed') return
        if (status === followed.status && error === followed.error) return
        followed.status = status
        followed.error = error
        const outcome = taskOutcome(followed)
        if (task === followed && state.value.status !== 'stopping' && outcome) {
          state.value = outcome
        }
      },
      { immediate: true, flush: 'sync' }
    )
  }

  function followTask(taskId: string, file: File, type: string) {
    downloads.trackDownload(taskId, type, file.name, { source: 'upload' })
    state.value = { status: 'saving', file }
    const followed: FollowedTask = { id: taskId, file, modelType: type }
    task = followed
    stopTaskWatch = watchTask(followed)
  }

  function cancellationSettled(
    taskId: string,
    signal: AbortSignal
  ): Promise<void> {
    const pending = () => progressRow(taskId)?.status === 'cancellation_pending'
    if (signal.aborted || !pending()) return Promise.resolve()
    return new Promise((resolve) => {
      const settle = () => {
        unwatch()
        signal.removeEventListener('abort', settle)
        resolve()
      }
      const unwatch = watch(pending, (stillPending) => {
        if (!stillPending) settle()
      })
      signal.addEventListener('abort', settle)
    })
  }

  function hasStopped(followed: FollowedTask) {
    return followed.status === 'cancelled' || followed.status === 'failed'
  }

  function followedTaskOf(previous: ReadyToSend) {
    return previous.status === 'failed' && previous.taskId === task?.id
      ? task
      : undefined
  }

  async function requestStop(followed: FollowedTask, signal: AbortSignal) {
    if (!progressRow(followed.id)) {
      downloads.trackDownload(
        followed.id,
        followed.modelType,
        followed.file.name,
        { source: 'upload' }
      )
    }
    const cancelled = await downloads.cancelDownload(followed.id)
    if (!cancelled.ok) {
      reportError(cancelled.error, {
        surface: 'assets',
        errorType: 'asset_download_cancellation_failure',
        level: 'warning'
      })
      return false
    }
    await cancellationSettled(followed.id, signal)
    return true
  }

  async function settleFollowedTask(
    followed: FollowedTask,
    run: number,
    signal: AbortSignal
  ): Promise<boolean> {
    if (followed.status === 'cancelled') return true
    state.value = { status: 'stopping', file: followed.file }
    const requested = await requestStop(followed, signal)
    if (run !== generation) return false
    if (signal.aborted) {
      state.value = heldBack(followed, t('assetBrowser.fileUpload.cancelled'))
      return false
    }
    if (requested && hasStopped(followed)) return true
    state.value = heldBack(followed, t('assetBrowser.fileUpload.notStopped'))
    return false
  }

  function beginAttempt() {
    generation++
    controller?.abort()
    controller = new AbortController()
    return { run: generation, signal: controller.signal }
  }

  async function upload(): Promise<UploadModelSuccess | null> {
    const current = state.value
    if (current.status !== 'chosen' && current.status !== 'failed') return null

    const { run, signal } = beginAttempt()
    const { file } = current
    const type = modelType.value

    const followed = followedTaskOf(current)
    if (followed && !(await settleFollowedTask(followed, run, signal))) {
      return null
    }
    stopFollowing()
    state.value = { status: 'uploading', file, sent: 0 }

    const result = await modelFileUploadApi.uploadModelFile(file, {
      tags: ['models', type],
      signal,
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
