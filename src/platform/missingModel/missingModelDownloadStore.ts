import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'
import { uniqBy } from 'es-toolkit'

import { t } from '@/i18n'
import { api } from '@/scripts/api'
import { createUuidv4 } from '@/utils/uuid'
import {
  cancelMissingModelDownload,
  downloadMissingModels
} from '@/platform/remote/comfyui/modelDownload'
import { zMissingModelDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'
import type {
  MissingModelDownloadResponse,
  MissingModelDownloadWsMessage
} from '@/platform/remote/comfyui/execution/types'
import type { ModelWithUrl } from '@/platform/missingModel/missingModelDownload'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { transitionDownload } from '@/platform/missingModel/missingModelDownloadState'
import type { ModelDownloadState } from '@/platform/missingModel/missingModelDownloadState'

function modelKey(model: Pick<ModelWithUrl, 'name' | 'directory'>): string {
  return JSON.stringify([model.directory, model.name])
}

export const useMissingModelDownloadStore = defineStore(
  'missingModelDownload',
  () => {
    const downloads = ref<Partial<Record<string, ModelDownloadState>>>({})
    const activeBatch = ref<{ id: string; clientId: string } | null>(null)
    const isDownloading = computed(() => activeBatch.value !== null)

    function stateFor(model: Pick<ModelWithUrl, 'name' | 'directory'>) {
      return downloads.value[modelKey(model)]
    }

    function handleProgress(event: CustomEvent<MissingModelDownloadWsMessage>) {
      const parsed = zMissingModelDownloadWsMessage.safeParse(event.detail)
      if (!parsed.success || parsed.data.batch_id !== activeBatch.value?.id)
        return
      const key = modelKey(parsed.data)
      const state = downloads.value[key]
      if (state)
        downloads.value[key] = transitionDownload(state, {
          type: 'progress',
          data: parsed.data
        })
    }

    api.addEventListener('missing_model_download', handleProgress)
    onScopeDispose(() =>
      api.removeEventListener('missing_model_download', handleProgress)
    )

    function failPending(models: ModelWithUrl[], error: string) {
      for (const model of models) {
        const key = modelKey(model)
        const state = downloads.value[key]
        if (state)
          downloads.value[key] = transitionDownload(state, {
            type: 'result',
            status: 'failed',
            error
          })
      }
    }

    function applyResults(
      results: MissingModelDownloadResponse['results'],
      batchId: string
    ) {
      for (const item of results) {
        const key = modelKey(item)
        const state = downloads.value[key]
        if (!state || state.batchId !== batchId) continue
        downloads.value[key] = transitionDownload(state, {
          type: 'result',
          status: item.status === 'downloaded' ? 'completed' : item.status,
          error: item.error
        })
      }
    }

    async function start(models: ModelWithUrl[]): Promise<void> {
      if (activeBatch.value || !models.length) return
      const batch = { id: createUuidv4(), clientId: api.clientId ?? '' }
      const pending = uniqBy(models, modelKey)
      activeBatch.value = batch
      for (const model of pending) {
        downloads.value[modelKey(model)] = {
          batchId: batch.id,
          status: 'queued',
          bytesDownloaded: 0
        }
      }
      try {
        const result = await downloadMissingModels(
          pending,
          batch.clientId,
          batch.id
        )
        if (result.ok) {
          applyResults(result.value.results, batch.id)
          failPending(
            pending,
            t('rightSidePanel.missingModels.downloadRequestFailed')
          )
        } else {
          failPending(pending, result.error.message)
        }
      } catch (error: unknown) {
        failPending(
          pending,
          error instanceof Error
            ? error.message
            : t('rightSidePanel.missingModels.downloadRequestFailed')
        )
      } finally {
        activeBatch.value = null
        if (
          pending.some((model) =>
            ['completed', 'skipped_existing'].includes(
              stateFor(model)?.status ?? ''
            )
          )
        ) {
          await useMissingModelStore().refreshMissingModels({
            reloadDefs: true
          })
        }
      }
    }

    async function cancel(
      model: Pick<ModelWithUrl, 'name' | 'directory'>
    ): Promise<void> {
      const key = modelKey(model)
      const state = downloads.value[key]
      const batch = activeBatch.value
      if (state?.status !== 'running' || !batch) return
      downloads.value[key] = transitionDownload(state, { type: 'cancel' })
      try {
        const result = await cancelMissingModelDownload(
          state.taskId,
          batch.clientId,
          batch.id
        )
        const current = downloads.value[key]
        if (!result.ok && current.batchId === batch.id) {
          downloads.value[key] = transitionDownload(current, {
            type: 'cancelFailed',
            error: result.error.message
          })
        }
      } catch (error: unknown) {
        const current = downloads.value[key]
        if (current.batchId !== batch.id) return
        downloads.value[key] = transitionDownload(current, {
          type: 'cancelFailed',
          error:
            error instanceof Error
              ? error.message
              : t('rightSidePanel.missingModels.cancelDownloadFailed')
        })
      }
    }

    return { isDownloading, stateFor, start, cancel }
  }
)
