import { defineStore } from 'pinia'
import { shallowRef } from 'vue'

import { zModelDownloadData } from '@comfyorg/ingest-types/zod'
import type { JobId } from '@/platform/remote/comfyui/execution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { api } from '@/scripts/api'

/** The model file a queued job is downloading before it runs. */
export interface JobModelDownload {
  name: string
  index: number
  count: number
  bytesDownloaded: number
  bytesTotal: number | null
  progress: number | null
}

const zModelDownloadMessage = zModelDownloadData.pick({
  status: true,
  name: true,
  index: true,
  count: true,
  bytes_downloaded: true,
  bytes_total: true,
  progress: true,
  prompt_id: true
})

/**
 * Model downloads of queued Cloud jobs, by job id, from `model_download`
 * events; a job's entry ends when its file stops downloading, or the job
 * starts running or ends.
 */
export const useJobModelDownloadStore = defineStore('jobModelDownload', () => {
  const downloads = shallowRef<ReadonlyMap<JobId, JobModelDownload>>(new Map())
  let reportedMalformed = false

  function update(jobId: JobId, download: JobModelDownload | undefined) {
    if (!download && !downloads.value.has(jobId)) return
    const next = new Map(downloads.value)
    if (download) next.set(jobId, download)
    else next.delete(jobId)
    downloads.value = next
  }

  function handleModelDownload(event: CustomEvent<unknown>) {
    const parsed = zModelDownloadMessage.safeParse(event.detail)
    if (!parsed.success) {
      if (!reportedMalformed) {
        reportedMalformed = true
        reportError(parsed.error, {
          surface: 'platform',
          errorType: 'error_parsing_model_download_message',
          level: 'warning'
        })
      }
      return
    }
    const message = parsed.data
    update(
      message.prompt_id,
      message.status === 'downloading'
        ? {
            name: message.name,
            index: message.index,
            count: message.count,
            bytesDownloaded: message.bytes_downloaded,
            bytesTotal: message.bytes_total,
            progress: message.progress
          }
        : undefined
    )
  }

  function handleJobMoved(event: CustomEvent<{ prompt_id: JobId }>) {
    update(event.detail.prompt_id, undefined)
  }

  api.addEventListener('model_download', handleModelDownload)
  api.addEventListener('execution_start', handleJobMoved)
  api.addEventListener('progress', handleJobMoved)
  api.addEventListener('progress_state', handleJobMoved)
  api.addEventListener('execution_success', handleJobMoved)
  api.addEventListener('execution_error', handleJobMoved)
  api.addEventListener('execution_interrupted', handleJobMoved)

  function downloadFor(jobId: JobId): JobModelDownload | undefined {
    return downloads.value.get(jobId)
  }

  function reconcileActiveJobs(activeJobIds: ReadonlySet<JobId>) {
    const ended = [...downloads.value.keys()].filter(
      (jobId) => !activeJobIds.has(jobId)
    )
    if (!ended.length) return
    const next = new Map(downloads.value)
    for (const jobId of ended) next.delete(jobId)
    downloads.value = next
  }

  return { downloadFor, reconcileActiveJobs }
})
