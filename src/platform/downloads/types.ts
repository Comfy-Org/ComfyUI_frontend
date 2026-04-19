/**
 * Download service abstraction types.
 *
 * Provides a unified contract for model downloads across all distributions
 * (Desktop/Electron, Browser/Localhost, Cloud). Components depend only on
 * this interface — platform-specific implementations are injected at build
 * time via {@link __DISTRIBUTION__} and tree-shaken from other builds.
 */

export type DownloadStatus =
  | 'pending'
  | 'in_progress'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'error'

export interface DownloadEntry {
  /** Unique key — URL for electron, taskId for cloud */
  readonly id: string
  readonly url: string
  readonly filename: string
  readonly savePath: string
  status: DownloadStatus
  progress: number
  error?: string
}

export interface DownloadStartParams {
  url: string
  savePath: string
  filename: string
  /** Cloud-specific metadata tags (e.g. ['models', 'checkpoints']). */
  tags?: string[]
}

export interface DownloadService {
  /** Resolves once the download is accepted, not when it completes. */
  start(params: DownloadStartParams): Promise<DownloadEntry>

  pause(id: string): Promise<void>
  resume(id: string): Promise<void>
  cancel(id: string): Promise<void>

  getAll(): DownloadEntry[]
  getById(id: string): DownloadEntry | null

  /** Returns an unsubscribe function. */
  onProgress(id: string, cb: (entry: DownloadEntry) => void): () => void

  readonly supportsPauseResume: boolean
}
