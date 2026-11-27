import type { MissingModelDownloadState } from '@/platform/workflowErrors/missingModel/missingModelDownloadStore'

export type MissingModelsDialogPhase =
  | 'offer'
  | 'downloading'
  | 'failed'
  | 'ready'

export interface MissingModelDownload {
  state: MissingModelDownloadState
  size: number | undefined
}

function isInFlight(state: MissingModelDownloadState): boolean {
  return (
    state.status === 'requested' ||
    state.status === 'pending' ||
    state.status === 'downloading'
  )
}

export function missingModelsDialogPhase(
  downloads: readonly MissingModelDownload[]
): MissingModelsDialogPhase {
  if (downloads.some(({ state }) => isInFlight(state))) return 'downloading'
  if (
    downloads.length > 0 &&
    downloads.every(({ state }) => state.status === 'done')
  ) {
    return 'ready'
  }
  if (downloads.some(({ state }) => state.status === 'failed')) return 'failed'
  return 'offer'
}

function receivedBytes({ state, size }: MissingModelDownload): number {
  if (state.status === 'done') return size ?? 0
  if (state.status === 'downloading') return state.receivedBytes ?? 0
  return 0
}

export function missingModelsReceivedBytes(
  downloads: readonly MissingModelDownload[]
): { received: number; total: number } | undefined {
  const sizes = downloads.map(({ size }) => size)
  if (!sizes.every((size): size is number => size !== undefined)) {
    return undefined
  }
  const total = sizes.reduce((sum, size) => sum + size, 0)
  if (total <= 0) return undefined
  const received = downloads.reduce(
    (sum, download) => sum + receivedBytes(download),
    0
  )
  return { received: Math.min(received, total), total }
}
