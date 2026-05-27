export type DownloadLifecycleStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface DownloadLifecycleState {
  progress: number
  status: DownloadLifecycleStatus
  error?: string
}
