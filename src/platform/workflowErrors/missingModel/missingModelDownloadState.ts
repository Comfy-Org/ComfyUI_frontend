export type MissingModelDownloadState =
  | { status: 'idle' }
  | { status: 'requested' }
  | { status: 'pending' }
  | {
      status: 'downloading'
      paused: boolean
      receivedBytes: number | null
      totalBytes: number | null
      fraction: number | null
    }
  | { status: 'done' }
  | { status: 'failed' }

export type ActiveMissingModelDownloadState = Extract<
  MissingModelDownloadState,
  { status: 'requested' | 'pending' | 'downloading' }
>

/** Whether the download is requested, starting or transferring, including paused. */
export function isActiveDownload(
  state: MissingModelDownloadState
): state is ActiveMissingModelDownloadState {
  return (
    state.status === 'requested' ||
    state.status === 'pending' ||
    state.status === 'downloading'
  )
}
