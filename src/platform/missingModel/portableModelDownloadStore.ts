import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'

import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import {
  getModelDownloadBatch,
  startModelDownloadBatch
} from '@/platform/missingModel/modelDownloadApi'
import type { ModelDownloadStatus } from '@/platform/missingModel/modelDownloadApi'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

const SESSION_KEY = 'Comfy.PortableModelDownloadBatch'
const POLL_INTERVAL_MS = 2000

type DownloadState =
  | { phase: 'idle' }
  | { phase: 'starting' }
  | { phase: 'running'; batchId: string; models: ModelDownloadStatus[] }
  | { phase: 'finished'; models: ModelDownloadStatus[] }
  | { phase: 'error'; reason: 'unavailable' | 'failed' }

export const usePortableModelDownloadStore = defineStore(
  'portableModelDownload',
  () => {
    const state = ref<DownloadState>({ phase: 'idle' })
    let pollTimer: ReturnType<typeof setTimeout> | undefined

    function stopPolling() {
      if (pollTimer !== undefined) clearTimeout(pollTimer)
      pollTimer = undefined
    }

    function schedulePoll(batchId: string) {
      stopPolling()
      pollTimer = setTimeout(() => void poll(batchId), POLL_INTERVAL_MS)
    }

    async function poll(batchId: string) {
      try {
        const result = await getModelDownloadBatch(batchId)
        if (state.value.phase !== 'running' || state.value.batchId !== batchId)
          return
        if (!result) {
          sessionStorage.removeItem(SESSION_KEY)
          state.value = { phase: 'error', reason: 'failed' }
          return
        }
        const { models } = result

        if (
          models.some(
            (model) => model.status === 'queued' || model.status === 'running'
          )
        ) {
          state.value = { phase: 'running', batchId, models }
          schedulePoll(batchId)
          return
        }

        state.value = { phase: 'running', batchId, models }
        await useMissingModelStore().refreshMissingModels({ reloadDefs: true })
        sessionStorage.removeItem(SESSION_KEY)
        state.value = { phase: 'finished', models }
      } catch {
        if (state.value.phase !== 'running' || state.value.batchId !== batchId)
          return
        sessionStorage.removeItem(SESSION_KEY)
        state.value = { phase: 'error', reason: 'failed' }
      }
    }

    async function start(models: ModelWithUrl[]) {
      if (state.value.phase === 'starting' || state.value.phase === 'running')
        return
      state.value = { phase: 'starting' }

      try {
        const result = await startModelDownloadBatch(models)
        if (result.status !== 'accepted') {
          state.value = { phase: 'error', reason: result.status }
          return
        }
        sessionStorage.setItem(SESSION_KEY, result.batch.batch_id)
        state.value = {
          phase: 'running',
          batchId: result.batch.batch_id,
          models: result.batch.models
        }
        schedulePoll(result.batch.batch_id)
      } catch {
        state.value = { phase: 'error', reason: 'failed' }
      }
    }

    const pendingBatchId = sessionStorage.getItem(SESSION_KEY)
    if (pendingBatchId) {
      state.value = { phase: 'running', batchId: pendingBatchId, models: [] }
      void poll(pendingBatchId)
    }

    onScopeDispose(stopPolling)

    return { state, start }
  }
)
