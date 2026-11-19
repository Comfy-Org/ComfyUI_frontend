import { reportError } from '@comfyorg/telemetry/reportError'
import { defineStore } from 'pinia'
import { computed, shallowRef } from 'vue'

import {
  cloudUploadRequest,
  readCloudUploadFolders,
  readLocalModelSizes,
  waitForStoredModel
} from '@/platform/openOnCloud/localModelUploadApi'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import type { CloudWorkflowGaps } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { modelFileUploadApi } from '@/platform/workspace/api/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/workspace/api/modelFileUploadApi'

/** A model Comfy Cloud lacks: its folder and name. */
export type MissingModel = CloudWorkflowGaps['models'][number]

/** Why an upload stopped: the server's refusal, a cancel, or a failure. */
export type LocalModelUploadFailure = Extract<
  ModelFileUploadResult,
  { ok: false }
>['reason']

/** The file chosen for a missing model, if any. */
export type ModelPick =
  | { status: 'unchosen' }
  | { status: 'chosen'; file: File }
  | { status: 'wrongFile'; file: File }

type LocalModelUpload =
  | { phase: 'idle' }
  | { phase: 'uploading'; sent: number; total: number }
  | { phase: 'failed'; reason: LocalModelUploadFailure; message?: string }
  | { phase: 'done' }

/** Keys a missing model the way the check names it. */
export function modelKey({ folder, name }: MissingModel): string {
  return `${folder}/${name}`
}

function baseName(name: string): string {
  return name.replaceAll('\\', '/').split('/').pop() ?? name
}

function matchesModel(
  file: File,
  model: MissingModel,
  size: number | undefined
): boolean {
  if (file.name !== baseName(model.name)) return false
  return size === undefined || file.size === size
}

/** Uploads the models Comfy Cloud lacks into the workspace library. */
export const useLocalModelUploadStore = defineStore('localModelUpload', () => {
  const uploadFolders = shallowRef<string[] | null>(null)
  const sizes = shallowRef(new Map<string, number>())
  const picks = shallowRef(new Map<string, ModelPick>())
  const upload = shallowRef<LocalModelUpload>({ phase: 'idle' })
  let controller: AbortController | undefined

  const isUploading = computed(() => upload.value.phase === 'uploading')
  const percent = computed(() => {
    const current = upload.value
    if (current.phase !== 'uploading' || current.total === 0) return 0
    return Math.min(100, Math.round((current.sent / current.total) * 100))
  })

  async function prepare(models: MissingModel[]): Promise<void> {
    if (isUploading.value) return
    const folders = [...new Set(models.map((model) => model.folder))]
    const [served, ...localSizes] = await Promise.all([
      readCloudUploadFolders(),
      ...folders.map(readLocalModelSizes)
    ])
    uploadFolders.value = served
    const next = new Map<string, number>()
    folders.forEach((folder, index) => {
      for (const [name, size] of localSizes[index])
        next.set(`${folder}/${name}`, size)
    })
    sizes.value = next
  }

  function sizeOf(model: MissingModel): number | undefined {
    return sizes.value.get(
      `${model.folder}/${model.name.replaceAll('\\', '/')}`
    )
  }

  function takesFolder(folder: string): boolean {
    return uploadFolders.value?.includes(folder) ?? false
  }

  function pickOf(model: MissingModel): ModelPick {
    return picks.value.get(modelKey(model)) ?? { status: 'unchosen' }
  }

  function choose(model: MissingModel, file: File): void {
    const next = new Map(picks.value)
    next.set(
      modelKey(model),
      matchesModel(file, model, sizeOf(model))
        ? { status: 'chosen', file }
        : { status: 'wrongFile', file }
    )
    picks.value = next
    if (upload.value.phase === 'failed') upload.value = { phase: 'idle' }
  }

  function canUpload(models: MissingModel[]): boolean {
    return (
      models.length > 0 &&
      models.every(
        (model) =>
          takesFolder(model.folder) && pickOf(model).status === 'chosen'
      )
    )
  }

  async function start(models: MissingModel[]): Promise<void> {
    if (isUploading.value || !canUpload(models)) return
    controller = new AbortController()
    const { signal } = controller
    const files = models.map((model) => {
      const pick = pickOf(model)
      return { model, file: pick.status === 'chosen' ? pick.file : null }
    })
    const total = files.reduce((sum, { file }) => sum + (file?.size ?? 0), 0)
    let done = 0
    upload.value = { phase: 'uploading', sent: 0, total }

    for (const { model, file } of files) {
      if (!file) continue
      const result = await modelFileUploadApi.uploadModelFile(file, {
        tags: ['models', model.folder],
        signal,
        request: cloudUploadRequest,
        onProgress: (sent) => {
          if (upload.value.phase !== 'uploading') return
          upload.value = { phase: 'uploading', sent: done + sent, total }
        }
      })
      if (!result.ok) {
        if (result.reason === 'failed') {
          reportError(result.cause, {
            surface: 'platform',
            errorType: 'error_uploading_local_model_to_cloud',
            level: 'warning'
          })
        }
        upload.value = {
          phase: 'failed',
          reason: result.reason,
          message: result.message
        }
        return
      }
      const stored = await waitForStoredModel(result.taskId, signal)
      if (!stored.ok) {
        upload.value = {
          phase: 'failed',
          reason: stored.reason,
          message: stored.message
        }
        return
      }
      done += file.size
      upload.value = { phase: 'uploading', sent: done, total }
    }

    upload.value = { phase: 'done' }
    picks.value = new Map()
    void useCloudWorkflowCheckStore().check()
  }

  function cancel(): void {
    controller?.abort()
  }

  function reset(): void {
    if (isUploading.value) return
    upload.value = { phase: 'idle' }
  }

  return {
    upload,
    uploadFolders,
    isUploading,
    percent,
    prepare,
    sizeOf,
    takesFolder,
    pickOf,
    choose,
    canUpload,
    start,
    cancel,
    reset
  }
})
