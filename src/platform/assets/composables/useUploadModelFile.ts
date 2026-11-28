import { computed, onScopeDispose, ref, shallowRef, watch } from 'vue'
import type { WatchStopHandle } from 'vue'
import { useI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useModelTypes } from '@/platform/assets/composables/useModelTypes'
import type { UploadModelSuccess } from '@/platform/assets/types/modelImport'
import {
  isSupportedModelFileName,
  modelFileUploadApi
} from '@/platform/assets/services/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/assets/services/modelFileUploadApi'
import { createTimeoutSignal } from '@comfyorg/api-client/abortSignal'
import { reportError } from '@comfyorg/telemetry/reportError'
import {
  isDownloadCancelled,
  useAssetDownloadStore
} from '@/platform/assets/stores/assetDownloadStore'
import type { AssetDownloadStatus } from '@/platform/assets/stores/assetDownloadStore'
import { deploymentModelUploadApi } from '@/platform/workspace/api/deploymentModelUploadApi'
import type {
  DeploymentModelOutcome,
  DeploymentModelTarget,
  DeploymentModelUploadResult
} from '@/platform/workspace/api/deploymentModelUploadApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useApp } from '@/scripts/appInstance'

const DEFAULT_MODEL_TYPE = 'loras'
const ADDING_WAIT_MS = 60 * 60_000

type UploadStopped = Extract<
  ModelFileUploadResult | DeploymentModelUploadResult,
  { ok: false }
>

export type UploadDestination = 'library' | 'deployment'

const FAILURE_COPY: Partial<Record<UploadStopped['reason'], string>> = {
  accessDenied: 'assetBrowser.fileUpload.accessDenied',
  cancelled: 'assetBrowser.fileUpload.cancelled',
  featureDisabled: 'assetBrowser.fileUpload.featureDisabled',
  sessionExpired: 'assetBrowser.fileUpload.sessionExpired',
  unsupportedFile: 'assetBrowser.fileUpload.notSafetensors',
  unsupportedType: 'assetBrowser.fileUpload.unsupportedType',
  privateModelsDisabled: 'assetBrowser.fileUpload.privateModelsDisabled',
  planUnavailable: 'assetBrowser.fileUpload.planUnavailable',
  notOn: 'assetBrowser.fileUpload.deploymentModelsOff'
}

/** Where one model file upload stands. */
export type ModelFileUpload =
  | { status: 'idle'; error?: string }
  | { status: 'chosen'; file: File }
  | { status: 'stopping'; file: File }
  | { status: 'checking'; file: File }
  | { status: 'removing'; file: File }
  | {
      status: 'uploading' | 'reconnecting'
      file: File
      sent: number
      bytesPerSecond?: number
    }
  | { status: 'saving'; file: File }
  | { status: 'adding'; file: File }
  | { status: 'stillAdding'; file: File; modelType: string; modelId: string }
  | { status: 'done'; file: File; modelType: string; onDeployment?: true }
  | {
      status: 'failed'
      file: File
      error: string
      taskId?: string
      libraryOffered?: true
      listedModelId?: string
    }

type ReadyToSend = Extract<ModelFileUpload, { status: 'chosen' | 'failed' }>

type FailedUpload = Extract<ModelFileUpload, { status: 'failed' }>

type DeploymentUploadStopped = Extract<
  DeploymentModelUploadResult,
  { ok: false }
>

interface FollowedTask {
  id: string
  file: File
  modelType: string
  status?: AssetDownloadStatus
  error?: string
}

/**
 * Uploads one model file into the workspace library or onto the booted
 * deployment, with its type, destination, progress and cancel.
 */
export function useUploadModelFile(
  initialDestination: UploadDestination = 'library'
) {
  const { t } = useI18n()
  const { flags } = useFeatureFlags()
  const downloads = useAssetDownloadStore()
  const deploymentPick = useDeploymentPickStore()
  const workspaceStore = useTeamWorkspaceStore()
  const { modelTypes, fetchModelTypes } = useModelTypes()
  const uploadFolders = computed(() => flags.modelUploadFolders)
  const deploymentFolders = computed(() =>
    modelTypes.value.map(({ value }) => value)
  )
  const isAvailable = computed(() => uploadFolders.value.length > 0)
  const deploymentTarget = computed<DeploymentModelTarget | undefined>(() => {
    const deploymentId = deploymentPick.bootDeployment?.deployment_id
    const workspaceId = workspaceStore.workspaceId
    return deploymentId && workspaceId
      ? { workspaceId, deploymentId }
      : undefined
  })
  const canChooseDestination = computed(
    () => deploymentTarget.value !== undefined
  )
  const destination = ref<UploadDestination>(initialDestination)
  const goesToDeployment = computed(
    () => canChooseDestination.value && destination.value === 'deployment'
  )
  const typeFolders = computed(() =>
    goesToDeployment.value ? deploymentFolders.value : uploadFolders.value
  )

  function defaultModelType() {
    return typeFolders.value.includes(DEFAULT_MODEL_TYPE)
      ? DEFAULT_MODEL_TYPE
      : (typeFolders.value[0] ?? '')
  }

  const state = shallowRef<ModelFileUpload>({ status: 'idle' })
  const modelType = ref(defaultModelType())

  watch(typeFolders, (folders) => {
    if (!folders.includes(modelType.value)) modelType.value = defaultModelType()
  })
  void fetchModelTypes()
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
    if (!isSupportedModelFileName(file.name)) {
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

  function progressHandlers(run: number, signal: AbortSignal, file: File) {
    let sampleTime = performance.now()
    let sampleBytes = 0
    const isCurrent = () => run === generation && !signal.aborted
    return {
      startSending() {
        if (!isCurrent()) return
        sampleTime = performance.now()
        sampleBytes = 0
        state.value = { status: 'uploading', file, sent: 0 }
      },
      onProgress(sent: number) {
        if (!isCurrent()) return
        const current = state.value
        if (current.status !== 'uploading' && current.status !== 'reconnecting')
          return
        const seconds = (performance.now() - sampleTime) / 1000
        const bytesPerSecond =
          current.status === 'uploading' && seconds > 0 && sent >= sampleBytes
            ? (sent - sampleBytes) / seconds
            : undefined
        state.value = { ...current, sent, bytesPerSecond }
      },
      onReconnecting(reconnecting: boolean) {
        if (!isCurrent()) return
        const current = state.value
        if (current.status !== 'uploading' && current.status !== 'reconnecting')
          return
        const status = reconnecting ? 'reconnecting' : 'uploading'
        if (current.status === status) return
        sampleTime = performance.now()
        sampleBytes = current.sent
        state.value = { status, file, sent: current.sent }
      }
    }
  }

  function failedUpload(
    file: File,
    result: UploadStopped,
    to: UploadDestination
  ): FailedUpload {
    if (result.reason === 'failed') {
      reportError(result.cause, {
        surface: 'assets',
        errorType: 'error_uploading_model_file',
        level: 'warning',
        tags: { destination: to }
      })
    }
    const error = failureText(result)
    if (result.reason !== 'notOn' || !isAvailable.value) {
      return { status: 'failed', file, error }
    }
    destination.value = 'library'
    return { status: 'failed', file, error, libraryOffered: true }
  }

  function failedOnDeployment(
    file: File,
    result: DeploymentUploadStopped
  ): ModelFileUpload {
    const failed = failedUpload(file, result, 'deployment')
    if (!result.modelId) return failed
    const error = result.stillListed
      ? t('assetBrowser.fileUpload.stillListed')
      : failed.error
    return { ...failed, error, listedModelId: result.modelId }
  }

  function outcomeOnDeployment(
    outcome: DeploymentModelOutcome | undefined,
    file: File,
    type: string,
    modelId: string
  ): ModelFileUpload {
    if (outcome === undefined) {
      return { status: 'stillAdding', file, modelType: type, modelId }
    }
    if (outcome === 'ready') {
      return { status: 'done', file, modelType: type, onDeployment: true }
    }
    return {
      status: 'failed',
      file,
      error: t('assetBrowser.fileUpload.notAddedToDeployment', {
        name: file.name
      }),
      listedModelId: modelId
    }
  }

  async function followDeploymentModel(
    target: DeploymentModelTarget,
    modelId: string,
    file: File,
    type: string,
    run: number
  ) {
    const outcome = await deploymentModelUploadApi.waitForDeploymentModel(
      target,
      modelId,
      createTimeoutSignal(ADDING_WAIT_MS)
    )
    if (outcome === 'ready') {
      void useApp()
        .refreshComboInNodes()
        .catch((error: unknown) =>
          reportError(error, {
            surface: 'assets',
            errorType: 'error_refreshing_deployment_models',
            level: 'warning'
          })
        )
    }
    if (run !== generation || state.value.status !== 'adding') return
    state.value = outcomeOnDeployment(outcome, file, type, modelId)
  }

  function checkAgain() {
    const current = state.value
    const target = deploymentTarget.value
    if (current.status !== 'stillAdding' || !target) return
    state.value = { status: 'adding', file: current.file }
    void followDeploymentModel(
      target,
      current.modelId,
      current.file,
      current.modelType,
      generation
    )
  }

  async function clearListedModel(
    file: File,
    target: DeploymentModelTarget,
    listedModelId: string,
    run: number,
    signal: AbortSignal
  ): Promise<boolean> {
    state.value = { status: 'removing', file }
    const cleared = await deploymentModelUploadApi.clearDeploymentModel(
      target,
      listedModelId,
      signal
    )
    if (run !== generation) return false
    if (cleared) return true
    state.value = {
      status: 'failed',
      file,
      listedModelId,
      error: t(
        signal.aborted
          ? 'assetBrowser.fileUpload.cancelled'
          : 'assetBrowser.fileUpload.stillListed'
      )
    }
    return false
  }

  async function uploadToDeployment(
    current: ReadyToSend,
    type: string,
    target: DeploymentModelTarget,
    run: number,
    signal: AbortSignal
  ): Promise<UploadModelSuccess | null> {
    const { file } = current
    const listedModelId =
      current.status === 'failed' ? current.listedModelId : undefined
    if (
      listedModelId &&
      !(await clearListedModel(file, target, listedModelId, run, signal))
    ) {
      return null
    }
    state.value = { status: 'checking', file }
    const progress = progressHandlers(run, signal, file)
    const result = await deploymentModelUploadApi.uploadModelToDeployment(
      file,
      target,
      {
        type,
        signal,
        onSending: progress.startSending,
        onProgress: progress.onProgress
      }
    )
    if (run !== generation) return null
    if (!result.ok) {
      state.value = failedOnDeployment(file, result)
      return null
    }
    state.value = { status: 'adding', file }
    void followDeploymentModel(target, result.modelId, file, type, run)
    return { filename: file.name, modelType: type, status: 'processing' }
  }

  async function uploadToLibrary(
    current: ReadyToSend,
    type: string,
    run: number,
    signal: AbortSignal
  ): Promise<UploadModelSuccess | null> {
    const { file } = current
    const progress = progressHandlers(run, signal, file)
    progress.startSending()

    const result = await modelFileUploadApi.uploadModelFile(file, {
      tags: ['models', type],
      signal,
      onProgress: progress.onProgress,
      onReconnecting: progress.onReconnecting
    })
    if (run !== generation) return null

    if (!result.ok) {
      state.value = failedUpload(file, result, 'library')
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

  async function upload(): Promise<UploadModelSuccess | null> {
    const current = state.value
    if (current.status !== 'chosen' && current.status !== 'failed') return null

    const { run, signal } = beginAttempt()
    const type = modelType.value
    const target = goesToDeployment.value ? deploymentTarget.value : undefined
    const followed = followedTaskOf(current)
    if (followed && !(await settleFollowedTask(followed, run, signal))) {
      return null
    }
    stopFollowing()
    if (!target) return uploadToLibrary(current, type, run, signal)
    return uploadToDeployment(current, type, target, run, signal)
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
    typeFolders,
    canChooseDestination,
    destination,
    goesToDeployment,
    state,
    modelType,
    choose,
    upload,
    checkAgain,
    cancel,
    reset
  }
}
