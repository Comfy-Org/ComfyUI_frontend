import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import type { CloudMissingModel } from '@/platform/openOnCloud/cloudWorkflowCheck'
import type { ModelUploadState } from '@/platform/openOnCloud/modelUpload'
import { totalBytes } from '@/platform/openOnCloud/modelUpload'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'

const PROTOTYPE_UPLOAD_MS = 20_000
const PROTOTYPE_UPLOAD_TICK_MS = 250

export const useModelUploadStore = defineStore('openOnCloudModelUpload', () => {
  const checkStore = useCloudWorkflowCheckStore()
  const state = shallowRef<ModelUploadState>({ phase: 'idle' })
  let ticker: ReturnType<typeof setInterval> | undefined

  function stopTicking() {
    clearInterval(ticker)
    ticker = undefined
  }

  function tick(models: CloudMissingModel[], step: number) {
    const current = state.value
    if (current.phase !== 'uploading') return
    const uploadedBytes = current.uploadedBytes + step
    if (uploadedBytes < totalBytes(models)) {
      state.value = { ...current, uploadedBytes }
      return
    }
    stopTicking()
    state.value = { phase: 'idle' }
    checkStore.markUploaded(models.map((model) => model.name))
  }

  function start(models: CloudMissingModel[]) {
    stopTicking()
    const step =
      totalBytes(models) / (PROTOTYPE_UPLOAD_MS / PROTOTYPE_UPLOAD_TICK_MS)
    state.value = { phase: 'uploading', models, uploadedBytes: 0 }
    ticker = setInterval(() => tick(models, step), PROTOTYPE_UPLOAD_TICK_MS)
  }

  function cancel() {
    stopTicking()
    state.value = { phase: 'idle' }
  }

  function reset() {
    cancel()
    checkStore.forgetUploads()
  }

  return { state, start, cancel, reset }
})
