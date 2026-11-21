import { reportError } from '@comfyorg/telemetry/reportError'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import {
  cloudUploadRequest,
  readCloudUploadFolders,
  readLocalModelSizes,
  waitForStoredModel
} from '@/platform/openOnCloud/localModelUploadApi'
import { checkCloudModelsAvailable } from '@/platform/openOnCloud/cloudCompatibilityApi'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import type { CloudWorkflowGaps } from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  isSupportedModelFileName,
  modelFileUploadApi
} from '@/platform/workspace/api/modelFileUploadApi'
import type {
  ModelFileUploadResult,
  StagedModelFile,
  UploadRouteRequest
} from '@/platform/workspace/api/modelFileUploadApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

/** A model Comfy Cloud lacks: its folder and name. */
export type MissingModel = CloudWorkflowGaps['models'][number]

/** Why an upload stopped: the server's refusal, a cancel, or a failure. */
export type LocalModelUploadFailure =
  | UploadFailure['reason']
  | 'accountChanged'
  | 'confirmationPending'
  | 'storagePending'

/** The file chosen for a missing model, if any. */
export type ModelPick =
  | { status: 'unchosen' }
  | { status: 'chosen'; file: File }
  | { status: 'wrongFile'; file: File }
  | { status: 'stored' }
  | StagedModel
  | SubmittedModel

type StagedModel = { status: 'staged'; file: File; staged: StagedModelFile }
type SubmittedModel = { status: 'submitted'; file: File; taskId: string }
type UploadableModelPick = Extract<
  ModelPick,
  { status: 'chosen' | 'staged' | 'submitted' }
>

function isUploadablePick(pick: ModelPick): pick is UploadableModelPick {
  return pick.status === 'chosen' || isPendingPick(pick)
}

function isPendingPick(pick: ModelPick): pick is StagedModel | SubmittedModel {
  return pick.status === 'staged' || pick.status === 'submitted'
}

const COMPLETION_TIMEOUT_MS = 20_000

export type ModelUploadBlock = 'folder' | 'subfolder' | 'fileType' | 'size'

type LocalModelUpload =
  | { phase: 'idle' }
  | {
      phase: 'uploading'
      sent: number
      total: number
      models: MissingModel[]
      canCancel: boolean
    }
  | {
      phase: 'failed'
      reason: LocalModelUploadFailure
      message?: string
      models?: MissingModel[]
    }
  | { phase: 'done' }

type UploadStop = Extract<LocalModelUpload, { phase: 'failed' }>
type UploadFailure = Extract<ModelFileUploadResult, { ok: false }>

const COMPLETION_RETRY_REASONS = new Set<UploadFailure['reason']>([
  'storageLimit',
  'planUnavailable',
  'accessDenied'
])

function reportUploadFailure(cause: unknown) {
  reportError(cause, {
    surface: 'platform',
    errorType: 'error_uploading_local_model_to_cloud',
    level: 'warning'
  })
}

/** Keys a missing model the way the check names it. */
export function modelKey({ folder, name }: MissingModel): string {
  return `${folder}/${name}`
}

function matchesModel(
  file: File,
  model: MissingModel,
  size: number | undefined
): boolean {
  return file.name === model.name && file.size === size
}

function useUploadOwner() {
  const { resolvedUserInfo } = useCurrentUser()
  const workspaces = useTeamWorkspaceStore()
  return computed(
    () =>
      `${resolvedUserInfo.value?.id ?? ''}|${workspaces.activeWorkspaceId ?? ''}`
  )
}

/** Uploads the models Comfy Cloud lacks into the workspace library. */
export const useLocalModelUploadStore = defineStore('localModelUpload', () => {
  const owner = useUploadOwner()
  const { flags } = useFeatureFlags()
  const uploadFolders = shallowRef<string[] | null>(null)
  const sizes = shallowRef(new Map<string, number>())
  const picks = shallowRef(new Map<string, ModelPick>())
  const upload = shallowRef<LocalModelUpload>({ phase: 'idle' })
  const retryBatches = shallowRef<MissingModel[][]>([])
  let batch:
    | { controller: AbortController; owner: string; ownerChanged: boolean }
    | undefined
  let preparation = 0
  let modelSnapshot: MissingModel[] | undefined

  const isUploading = computed(() => upload.value.phase === 'uploading')
  const activeModels = computed(() => {
    const current = upload.value
    if (
      current.phase === 'uploading' ||
      (current.phase === 'failed' && current.models)
    )
      return current.models

    return retryBatches.value[0]
  })
  const canCancel = computed(
    () => upload.value.phase === 'uploading' && upload.value.canCancel
  )
  const percent = computed(() => {
    const current = upload.value
    if (current.phase !== 'uploading' || current.total === 0) return 0
    return Math.min(100, Math.round((current.sent / current.total) * 100))
  })

  watch(
    owner,
    () => {
      if (batch) {
        batch.ownerChanged = true
        batch.controller.abort()
      }
      picks.value = new Map()
      retryBatches.value = []
      if (upload.value.phase === 'failed' && upload.value.models) {
        upload.value = { phase: 'failed', reason: 'accountChanged' }
      }
      clearPreparation()
    },
    { flush: 'sync' }
  )

  function clearPreparation(): void {
    preparation++
    uploadFolders.value = null
    sizes.value = new Map()
  }

  async function prepare(models: MissingModel[]): Promise<void> {
    if (isUploading.value) return
    clearPreparation()
    const currentPreparation = preparation
    const folders = [...new Set(models.map((model) => model.folder))]
    const [served, ...localSizes] = await Promise.all([
      readCloudUploadFolders(),
      ...folders.map(readLocalModelSizes)
    ])
    if (currentPreparation !== preparation) return
    const next = new Map<string, number>()
    folders.forEach((folder, index) => {
      for (const [name, size] of localSizes[index])
        next.set(`${folder}/${name}`, size)
    })
    sizes.value = next
    uploadFolders.value = served
  }

  function sizeOf(model: MissingModel): number | undefined {
    return sizes.value.get(
      `${model.folder}/${model.name.replaceAll('\\', '/')}`
    )
  }

  function blockedBy(model: MissingModel): ModelUploadBlock | undefined {
    const pick = pickOf(model)
    if (isPendingPick(pick)) return
    if (!uploadFolders.value?.includes(model.folder)) return 'folder'
    if (/[\\/]/.test(model.name)) return 'subfolder'
    if (!isSupportedModelFileName(model.name)) return 'fileType'
    if (sizeOf(model) === undefined && pick.status !== 'stored') return 'size'
  }

  function canTake(model: MissingModel): boolean {
    return pickOf(model).status === 'stored' || blockedBy(model) === undefined
  }

  function pickOf(model: MissingModel): ModelPick {
    const pick = picks.value.get(modelKey(model))
    if (pick?.status !== 'chosen') return pick ?? { status: 'unchosen' }
    return matchesModel(pick.file, model, sizeOf(model))
      ? pick
      : { status: 'wrongFile', file: pick.file }
  }

  function setPick(model: MissingModel, pick: ModelPick): void {
    picks.value = new Map(picks.value).set(modelKey(model), pick)
  }

  function choose(model: MissingModel, file: File): void {
    if (isUploading.value || blockedBy(model) || isPendingPick(pickOf(model)))
      return
    setPick(model, { status: 'chosen', file })
    if (upload.value.phase === 'failed' && !upload.value.models)
      upload.value = { phase: 'idle' }
  }

  function canUpload(models: MissingModel[]): boolean {
    if (!flags.openOnCloudModelUploadEnabled) return false
    const statuses = models.map((model) => canTake(model) && pickOf(model))
    return (
      statuses.length > 0 &&
      statuses.every(
        (pick) => pick && (isUploadablePick(pick) || pick.status === 'stored')
      )
    )
  }

  function boundRequest(startedBy: string): UploadRouteRequest {
    return (route, init) =>
      owner.value === startedBy
        ? cloudUploadRequest(route, init)
        : Promise.reject(new DOMException('Account changed', 'AbortError'))
  }

  function disableCancel(): void {
    if (upload.value.phase === 'uploading')
      upload.value = { ...upload.value, canCancel: false }
  }

  function handleUploadFailure(
    model: MissingModel,
    file: File,
    result: UploadFailure,
    staged: StagedModelFile | undefined,
    signal: AbortSignal
  ): UploadStop {
    if (result.reason === 'failed') {
      reportUploadFailure(result.cause)
      if (staged) return { phase: 'failed', reason: 'storagePending' }
    }
    if (
      staged &&
      !signal.aborted &&
      !COMPLETION_RETRY_REASONS.has(result.reason)
    )
      setPick(model, { status: 'chosen', file })
    return { phase: 'failed', reason: result.reason, message: result.message }
  }

  async function submitModel(
    model: MissingModel,
    pick: Exclude<UploadableModelPick, SubmittedModel>,
    progress: (sent: number) => void,
    signal: AbortSignal,
    request: UploadRouteRequest
  ): Promise<SubmittedModel | UploadStop> {
    if (pick.status === 'chosen' && !flags.openOnCloudModelUploadEnabled)
      return { phase: 'failed', reason: 'featureDisabled' }
    const { file } = pick
    let staged = pick.status === 'staged' ? pick.staged : undefined
    const result = await modelFileUploadApi.uploadModelFile(file, {
      tags: ['models', model.folder],
      signal,
      request,
      onProgress: progress,
      resumeFrom: staged,
      completionTimeoutMs: COMPLETION_TIMEOUT_MS,
      canStartTransfer: () => flags.openOnCloudModelUploadEnabled,
      onCompleting: (upload) => {
        disableCancel()
        staged = upload
        if (!signal.aborted) setPick(model, { status: 'staged', file, staged })
      }
    })
    if (!result.ok)
      return handleUploadFailure(model, file, result, staged, signal)
    const submitted: SubmittedModel = {
      status: 'submitted',
      file,
      taskId: result.taskId
    }
    if (!signal.aborted) setPick(model, submitted)
    return submitted
  }

  async function sendOne(
    model: MissingModel,
    pick: UploadableModelPick,
    progress: (sent: number) => void,
    { controller, owner: startedBy }: NonNullable<typeof batch>
  ): Promise<UploadStop | undefined> {
    const { signal } = controller
    const request = boundRequest(startedBy)
    const submitted =
      pick.status === 'submitted'
        ? pick
        : await submitModel(model, pick, progress, signal, request)
    if ('phase' in submitted) return submitted

    disableCancel()
    const stored = await waitForStoredModel(submitted.taskId, signal, request)
    if (stored.ok) return
    if (stored.reason === 'taskUnavailable')
      return await recheckMissingTask(model, submitted, signal)
    if (!signal.aborted && stored.reason !== 'storagePending')
      setPick(model, { status: 'chosen', file: submitted.file })
    return { phase: 'failed', reason: stored.reason, message: stored.message }
  }

  async function recheckMissingTask(
    model: MissingModel,
    submitted: SubmittedModel,
    signal: AbortSignal
  ): Promise<UploadStop | undefined> {
    const available = await checkCloudModelsAvailable([model], signal)
    if (signal.aborted) return { phase: 'failed', reason: 'cancelled' }
    if (available) return
    if (available === false) {
      setPick(model, { status: 'chosen', file: submitted.file })
      return { phase: 'failed', reason: 'sessionExpired' }
    }
    return { phase: 'failed', reason: 'storagePending' }
  }

  async function sendAll(
    models: MissingModel[],
    queue: { model: MissingModel; pick: UploadableModelPick }[],
    current: NonNullable<typeof batch>
  ): Promise<UploadStop | undefined> {
    const total = queue.reduce(
      (sum, { pick }) => sum + (pick.status === 'chosen' ? pick.file.size : 0),
      0
    )
    let done = 0
    const { signal } = current.controller
    for (const { model, pick } of queue) {
      upload.value = {
        phase: 'uploading',
        sent: done,
        total,
        models,
        canCancel: pick.status === 'chosen'
      }
      const stop = await sendOne(
        model,
        pick,
        (sent) => {
          const state = upload.value
          if (!signal.aborted && state.phase === 'uploading')
            upload.value = { ...state, sent: done + sent }
        },
        current
      )
      if (signal.aborted) {
        const hasProgress = models.some((model) => {
          const pick = pickOf(model)
          return pick.status === 'stored' || isPendingPick(pick)
        })
        return {
          phase: 'failed',
          reason: 'cancelled',
          ...(hasProgress ? { models } : {})
        }
      }
      if (stop) return { ...stop, models }
      setPick(model, { status: 'stored' })
      if (pick.status === 'chosen') done += pick.file.size
    }
    return undefined
  }

  function recordBatchResult(
    models: MissingModel[],
    needsRetry: boolean
  ): void {
    const keys = new Set(models.map(modelKey))
    const otherBatches = retryBatches.value.filter(
      (batch) =>
        batch.length !== keys.size ||
        batch.some((model) => !keys.has(modelKey(model)))
    )
    retryBatches.value = needsRetry ? [models, ...otherBatches] : otherBatches
  }

  async function confirmBatch(
    models: MissingModel[],
    signal: AbortSignal
  ): Promise<UploadStop | undefined> {
    if (signal.aborted) return
    upload.value = {
      phase: 'uploading',
      sent: 0,
      total: 0,
      models,
      canCancel: false
    }
    const confirmed = await checkCloudModelsAvailable(models, signal)
    if (!confirmed)
      return { phase: 'failed', reason: 'confirmationPending', models }
  }

  function finishBatch(
    models: MissingModel[],
    stop: UploadStop | undefined,
    ownerChanged: boolean
  ): boolean {
    if (ownerChanged) {
      upload.value = { phase: 'failed', reason: 'accountChanged' }
      return false
    }
    recordBatchResult(models, !!stop?.models)
    upload.value = stop ?? { phase: 'done' }
    return !stop
  }

  function refreshCompatibility(shouldCheck: boolean): void {
    const workflowCheck = useCloudWorkflowCheckStore()
    if (shouldCheck) void workflowCheck.check()
    else workflowCheck.invalidate()
  }

  async function start(
    models: MissingModel[],
    { refreshWorkflow = true }: { refreshWorkflow?: boolean } = {}
  ): Promise<void> {
    if (batch || isUploading.value || !canUpload(models)) return
    const workflows = useWorkflowStore()
    const workflow = workflows.activeWorkflow
    const queue = models.flatMap((model) => {
      const pick = pickOf(model)
      return isUploadablePick(pick) ? [{ model, pick }] : []
    })
    const current = {
      controller: new AbortController(),
      owner: owner.value,
      ownerChanged: false
    }
    batch = current
    try {
      const stop =
        (await sendAll(models, queue, current)) ??
        (await confirmBatch(models, current.controller.signal))
      if (finishBatch(models, stop, current.ownerChanged))
        refreshCompatibility(
          refreshWorkflow && workflows.activeWorkflow === workflow
        )
    } catch (cause) {
      reportUploadFailure(cause)
      finishBatch(
        models,
        { phase: 'failed', reason: 'failed', models },
        current.ownerChanged
      )
    } finally {
      if (batch === current) batch = undefined
    }
  }

  function cancel(): void {
    if (canCancel.value) batch?.controller.abort()
  }

  function reset(
    models: MissingModel[],
    { freshVerdict = false }: { freshVerdict?: boolean } = {}
  ): void {
    if (isUploading.value) return
    clearPreparation()
    const current = upload.value
    if (current.phase === 'failed' && modelSnapshot === models) return
    const recovery = current.phase === 'failed' ? current.models : undefined
    if (!recovery) upload.value = { phase: 'idle' }
    const keys = new Set(models.map(modelKey))
    const recoverableKeys = new Set(
      retryBatches.value.flatMap((batch) => batch.map(modelKey))
    )
    picks.value = new Map(
      [...picks.value].filter(([key, pick]) => {
        const wasStored = keys.has(key) && pick.status === 'stored'
        if (freshVerdict && wasStored && !recoverableKeys.has(key)) return false
        return recoverableKeys.has(key) || isPendingPick(pick) || wasStored
      })
    )
    modelSnapshot = models
  }

  return {
    owner,
    upload,
    uploadFolders,
    isUploading,
    activeModels,
    retryBatches,
    canCancel,
    percent,
    prepare,
    sizeOf,
    blockedBy,
    canTake,
    pickOf,
    choose,
    canUpload,
    start,
    cancel,
    reset
  }
})
