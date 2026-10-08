import type { MissingModelDownloadWsMessage } from '@/platform/remote/comfyui/execution/types'

export type ModelDownloadState = {
  batchId: string
  bytesDownloaded: number
  error?: string
} & (
  | { status: 'queued'; taskId?: never }
  | { status: 'running' | 'canceling'; taskId: string }
  | {
      status:
        | 'completed'
        | 'skipped_existing'
        | 'failed'
        | 'blocked'
        | 'canceled'
      taskId?: string
    }
)

type DownloadEvent =
  | { type: 'progress'; data: MissingModelDownloadWsMessage }
  | {
      type: 'result'
      status:
        | 'completed'
        | 'skipped_existing'
        | 'failed'
        | 'blocked'
        | 'canceled'
      error?: string
    }
  | { type: 'cancel' }
  | { type: 'cancelFailed'; error: string }

export function transitionDownload(
  state: ModelDownloadState,
  event: DownloadEvent
): ModelDownloadState {
  if (!['queued', 'running', 'canceling'].includes(state.status)) return state
  if (event.type === 'cancel') {
    return state.status === 'running'
      ? { ...state, status: 'canceling' }
      : state
  }
  if (event.type === 'cancelFailed') {
    return state.status === 'canceling'
      ? { ...state, status: 'running', error: event.error }
      : state
  }
  if (event.type === 'result')
    return { ...state, status: event.status, error: event.error }
  if (state.batchId !== event.data.batch_id) return state
  if (state.taskId && state.taskId !== event.data.task_id) return state
  return {
    batchId: state.batchId,
    taskId: event.data.task_id,
    status:
      state.status === 'canceling' && event.data.status === 'running'
        ? 'canceling'
        : event.data.status,
    bytesDownloaded: Math.max(
      state.bytesDownloaded,
      event.data.bytes_downloaded
    ),
    error: event.data.error
  }
}
