type TemplateModelDownloadActivity = 'active' | 'paused'

type TemplateModelDownloadFailureReason = 'error' | 'cancelled'

export type TemplateModelDownloadState =
  | { status: 'idle'; attempt: 0 }
  | { status: 'queued'; attempt: number }
  | { status: 'starting'; attempt: number }
  | {
      status: 'downloading'
      attempt: number
      activity: TemplateModelDownloadActivity
      receivedBytes: number | null
      totalBytes: number | null
      fraction: number | null
    }
  | { status: 'done'; attempt: number }
  | {
      status: 'failed'
      attempt: number
      reason: TemplateModelDownloadFailureReason
      retryable: true
    }

export type TemplateModelDownloadEvent =
  | { type: 'request' }
  | { type: 'started'; attempt: number }
  | {
      type: 'progress'
      attempt: number
      activity: TemplateModelDownloadActivity
      receivedBytes: number | null
      totalBytes: number | null
      fraction: number | null
    }
  | { type: 'completed'; attempt: number }
  | { type: TemplateModelDownloadFailureReason; attempt: number }

export function createTemplateModelDownloadState(): TemplateModelDownloadState {
  return { status: 'idle', attempt: 0 }
}

export function getTemplateModelDownloadIdentity({
  name,
  directory
}: {
  name: string
  directory: string
}): string {
  return JSON.stringify([name, directory])
}

export function reduceTemplateModelDownloadState(
  state: TemplateModelDownloadState,
  event: TemplateModelDownloadEvent
): TemplateModelDownloadState {
  if (event.type === 'request') {
    if (state.status === 'idle') return { status: 'queued', attempt: 1 }
    if (state.status === 'failed') {
      return { status: 'queued', attempt: state.attempt + 1 }
    }
    return state
  }

  if (event.attempt !== state.attempt) return state

  switch (event.type) {
    case 'started':
      return state.status === 'queued'
        ? { status: 'starting', attempt: state.attempt }
        : state
    case 'progress':
      return state.status === 'starting' || state.status === 'downloading'
        ? {
            status: 'downloading',
            attempt: state.attempt,
            activity: event.activity,
            receivedBytes: event.receivedBytes,
            totalBytes: event.totalBytes,
            fraction: event.fraction
          }
        : state
    case 'completed':
      return state.status === 'starting' || state.status === 'downloading'
        ? { status: 'done', attempt: state.attempt }
        : state
    case 'error':
    case 'cancelled':
      return state.status === 'queued' ||
        state.status === 'starting' ||
        state.status === 'downloading'
        ? {
            status: 'failed',
            attempt: state.attempt,
            reason: event.type,
            retryable: true
          }
        : state
    default:
      return event satisfies never
  }
}
