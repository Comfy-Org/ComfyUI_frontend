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

function requestDownload(
  state: TemplateModelDownloadState
): TemplateModelDownloadState {
  if (state.status === 'idle') return { status: 'queued', attempt: 1 }
  if (state.status === 'failed') {
    return { status: 'queued', attempt: state.attempt + 1 }
  }
  return state
}

function startDownload(
  state: TemplateModelDownloadState
): TemplateModelDownloadState {
  if (state.status !== 'queued') return state
  return { status: 'starting', attempt: state.attempt }
}

function updateDownloadProgress(
  state: TemplateModelDownloadState,
  event: Extract<TemplateModelDownloadEvent, { type: 'progress' }>
): TemplateModelDownloadState {
  if (state.status !== 'starting' && state.status !== 'downloading')
    return state
  return {
    status: 'downloading',
    attempt: state.attempt,
    activity: event.activity,
    receivedBytes: event.receivedBytes,
    totalBytes: event.totalBytes,
    fraction: event.fraction
  }
}

function completeDownload(
  state: TemplateModelDownloadState
): TemplateModelDownloadState {
  if (state.status !== 'starting' && state.status !== 'downloading')
    return state
  return { status: 'done', attempt: state.attempt }
}

function failDownload(
  state: TemplateModelDownloadState,
  reason: TemplateModelDownloadFailureReason
): TemplateModelDownloadState {
  if (!['queued', 'starting', 'downloading'].includes(state.status))
    return state
  return { status: 'failed', attempt: state.attempt, reason }
}

export function reduceTemplateModelDownloadState(
  state: TemplateModelDownloadState,
  event: TemplateModelDownloadEvent
): TemplateModelDownloadState {
  if (event.type === 'request') return requestDownload(state)

  if (event.attempt !== state.attempt) return state

  switch (event.type) {
    case 'started':
      return startDownload(state)
    case 'progress':
      return updateDownloadProgress(state, event)
    case 'completed':
      return completeDownload(state)
    case 'error':
    case 'cancelled':
      return failDownload(state, event.type)
    default:
      return event satisfies never
  }
}
