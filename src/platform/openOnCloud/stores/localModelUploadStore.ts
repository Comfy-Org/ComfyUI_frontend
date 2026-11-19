import { reportError } from '@comfyorg/telemetry/reportError'
import { defineStore } from 'pinia'
import { computed, shallowRef, watch } from 'vue'

import {
  cloudUploadRequest,
  readCloudUploadFolders,
  readLocalModelSizes,
  waitForStoredModel
} from '@/platform/openOnCloud/localModelUploadApi'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import type { CloudWorkflowGaps } from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  isSupportedModelFileName,
  modelFileUploadApi
} from '@/platform/workspace/api/modelFileUploadApi'
import type {
  ModelFileUploadResult,
  UploadRouteRequest
} from '@/platform/workspace/api/modelFileUploadApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/** A model Comfy Cloud lacks: its folder and name. */
export type MissingModel = CloudWorkflowGaps['models'][number]

/** Why an upload stopped: the server's refusal, a cancel, or a failure. */
export type LocalModelUploadFailure =
  | Extract<ModelFileUploadResult, { ok: false }>['reason']
  | 'accountChanged'

/** The file chosen for a missing model, if any. */
export type ModelPick =
  | { status: 'unchosen' }
  | { status: 'chosen'; file: File }
  | { status: 'wrongFile'; file: File }
  | { status: 'stored' }

export type ModelUploadBlock = 'folder' | 'subfolder' | 'fileType' | 'size'

type LocalModelUpload =
  | { phase: 'idle' }
  | { phase: 'uploading'; sent: number; total: number }
  | { phase: 'failed'; reason: LocalModelUploadFailure; message?: string }
  | { phase: 'done' }

type UploadStop = Extract<LocalModelUpload, { phase: 'failed' }>

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
  const uploadFolders = shallowRef<string[] | null>(null)
  const sizes = shallowRef(new Map<string, number>())
  const picks = shallowRef(new Map<string, ModelPick>())
  const upload = shallowRef<LocalModelUpload>({ phase: 'idle' })
  let batch:
    | { controller: AbortController; owner: string; ownerChanged: boolean }
    | undefined
  let preparation = 0
  let modelSnapshot: MissingModel[] | undefined

  const isUploading = computed(() => upload.value.phase === 'uploading')
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
    if (!uploadFolders.value?.includes(model.folder)) return 'folder'
    if (/[\\/]/.test(model.name)) return 'subfolder'
    if (!isSupportedModelFileName(model.name)) return 'fileType'
    if (sizeOf(model) === undefined && pickOf(model).status !== 'stored')
      return 'size'
  }

  function canTake(model: MissingModel): boolean {
    return blockedBy(model) === undefined
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
    if (isUploading.value || !canTake(model)) return
    setPick(model, { status: 'chosen', file })
    if (upload.value.phase === 'failed') upload.value = { phase: 'idle' }
  }

  function canUpload(models: MissingModel[]): boolean {
    const statuses = models.map((model) => canTake(model) && pickOf(model))
    return (
      statuses.some((pick) => pick && pick.status === 'chosen') &&
      statuses.every(
        (pick) => pick && (pick.status === 'chosen' || pick.status === 'stored')
      )
    )
  }

  function boundRequest(startedBy: string): UploadRouteRequest {
    return (route, init) =>
      owner.value === startedBy
        ? cloudUploadRequest(route, init)
        : Promise.reject(new DOMException('Account changed', 'AbortError'))
  }

  async function sendOne(
    model: MissingModel,
    file: File,
    progress: (sent: number) => void,
    { controller, owner: startedBy }: NonNullable<typeof batch>
  ): Promise<UploadStop | undefined> {
    const { signal } = controller
    const request = boundRequest(startedBy)
    const result = await modelFileUploadApi.uploadModelFile(file, {
      tags: ['models', model.folder],
      signal,
      request,
      onProgress: progress
    })
    if (!result.ok) {
      if (result.reason === 'failed')
        reportError(result.cause, {
          surface: 'platform',
          errorType: 'error_uploading_local_model_to_cloud',
          level: 'warning'
        })
      return { phase: 'failed', reason: result.reason, message: result.message }
    }
    const stored = await waitForStoredModel(result.taskId, signal, request)
    return stored.ok
      ? undefined
      : { phase: 'failed', reason: stored.reason, message: stored.message }
  }

  async function sendAll(
    queue: { model: MissingModel; file: File }[],
    current: NonNullable<typeof batch>
  ): Promise<UploadStop | undefined> {
    const total = queue.reduce((sum, { file }) => sum + file.size, 0)
    let done = 0
    const { signal } = current.controller
    upload.value = { phase: 'uploading', sent: 0, total }
    for (const { model, file } of queue) {
      const stop = await sendOne(
        model,
        file,
        (sent) => {
          if (!signal.aborted && isUploading.value)
            upload.value = { phase: 'uploading', sent: done + sent, total }
        },
        current
      )
      if (signal.aborted) return { phase: 'failed', reason: 'cancelled' }
      if (stop) return stop
      setPick(model, { status: 'stored' })
      done += file.size
      upload.value = { phase: 'uploading', sent: done, total }
    }
    return undefined
  }

  async function start(models: MissingModel[]): Promise<void> {
    if (isUploading.value || !canUpload(models)) return
    const queue = models.flatMap((model) => {
      const pick = pickOf(model)
      return pick.status === 'chosen' ? [{ model, file: pick.file }] : []
    })
    const current = {
      controller: new AbortController(),
      owner: owner.value,
      ownerChanged: false
    }
    batch = current
    try {
      const stop = await sendAll(queue, current)
      if (current.ownerChanged) {
        upload.value = { phase: 'failed', reason: 'accountChanged' }
        return
      }
      upload.value = stop ?? { phase: 'done' }
      if (!stop) void useCloudWorkflowCheckStore().check()
    } catch (cause) {
      reportError(cause, {
        surface: 'platform',
        errorType: 'error_uploading_local_model_to_cloud',
        level: 'warning'
      })
      upload.value = {
        phase: 'failed',
        reason: current.ownerChanged ? 'accountChanged' : 'failed'
      }
    } finally {
      if (batch === current) batch = undefined
    }
  }

  function cancel(): void {
    batch?.controller.abort()
  }

  function reset(models: MissingModel[]): void {
    if (isUploading.value) return
    clearPreparation()
    if (modelSnapshot === models && upload.value.phase === 'failed') return
    upload.value = { phase: 'idle' }
    picks.value =
      modelSnapshot === models
        ? new Map(
            [...picks.value].filter(([, pick]) => pick.status === 'stored')
          )
        : new Map()
    modelSnapshot = models
  }

  return {
    owner,
    upload,
    uploadFolders,
    isUploading,
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
