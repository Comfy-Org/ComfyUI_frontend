export interface ComfyDownloadProgress {
  /** Stable per-job identifier assigned by Desktop. Older versions omit it. */
  id?: string
  url: string
  filename: string
  directory?: string
  progress: number
  receivedBytes?: number
  totalBytes?: number
  speedBytesPerSec?: number
  etaSeconds?: number
  status:
    | 'pending'
    | 'downloading'
    | 'paused'
    | 'completed'
    | 'error'
    | 'cancelled'
  error?: string
  isImage?: boolean
}

export interface ComfyTemplateInputReference {
  templateId: string
  assetId: string
}

export interface ComfyTemplateInputAssetDownload {
  downloadId: string
  filename: string
  progress: number
  receivedBytes?: number
  totalBytes?: number
  status: ComfyDownloadProgress['status']
  error?: string
}

export interface ComfyTemplateInputDownloadProgress extends ComfyTemplateInputAssetDownload {
  templateInputs: ComfyTemplateInputReference[]
}

export interface ComfyTemplateInputAsset {
  /** Opaque, template-scoped identifier accepted by `downloadTemplateInputAsset`. */
  assetId: string
  filename: string
  mediaType: 'image' | 'video' | 'audio'
  previewUrl: string
  availability: 'present' | 'missing' | 'unknown'
  activeDownload?: ComfyTemplateInputAssetDownload
}

export type ComfyTemplateInputAssetDownloadResult =
  | { status: 'already-present' }
  | {
      status: 'accepted' | 'joined'
      download: ComfyTemplateInputAssetDownload
    }
  | {
      status: 'not-started'
      reason: 'invalid-request' | 'not-declared' | 'unavailable'
    }

export interface TerminalRestore {
  buffer: string[]
  size: { cols: number; rows: number }
  exited: boolean
}

export interface LogsRestore {
  installationId: string
  buffer: string[]
}

export interface LogsOutputMsg {
  installationId: string
  text: string
}

export type ComfyDesktop2TelemetryValue = string | number | boolean | null
export type ComfyDesktop2TelemetryProperties = Record<
  string,
  ComfyDesktop2TelemetryValue | ComfyDesktop2TelemetryValue[]
>

export type ComfyDesktop2FirebaseAuthState =
  | { status: 'pending' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; userId: string }

export interface ComfyDesktop2TerminalBridge {
  subscribe(installationId?: string): Promise<TerminalRestore>
  unsubscribe(installationId?: string): Promise<void>
  write(data: string, installationId?: string): Promise<void>
  resize(cols: number, rows: number, installationId?: string): Promise<void>
  restart(installationId?: string): Promise<TerminalRestore>
  openPopout(): Promise<void>
  onOutput(callback: (data: string) => void): () => void
  onExited(callback: () => void): () => void
}

export interface ComfyDesktop2LogsBridge {
  subscribe(installationId?: string): Promise<LogsRestore>
  unsubscribe(installationId?: string): Promise<void>
  openPopout(): Promise<void>
  onOutput(callback: (msg: LogsOutputMsg) => void): () => void
}

export interface ComfyDesktop2TelemetryBridge {
  capture(event: string, properties?: ComfyDesktop2TelemetryProperties): void
  reportFirebaseAuthState?(state: ComfyDesktop2FirebaseAuthState): void
}

export interface ComfyDesktop2Bridge {
  /** Reports whether the backend server is cloud/remote, not the user's location. */
  isRemote(): boolean
  /** Opens a model provider access page in the hosted frontend's browser session.
   *  Resolves `true` when the host has taken ownership of the request.
   *  On `false` or rejection the frontend falls back to opening a new tab. */
  openModelAccessPage?: (url: string) => Promise<boolean>
  downloadModel?: (
    url: string,
    filename: string,
    directory: string
  ) => Promise<boolean>
  downloadAsset?: (
    url: string,
    filename: string,
    authToken?: string
  ) => Promise<boolean>
  /** Resolve only assets declared by this curated template. */
  getTemplateInputAssets?: (
    templateId: string
  ) => Promise<ComfyTemplateInputAsset[] | null>
  /** Start or join the managed download for one declared template asset. */
  downloadTemplateInputAsset?: (
    templateId: string,
    assetId: string
  ) => Promise<ComfyTemplateInputAssetDownloadResult>
  /** Managed download events decorated with every owning template asset. */
  onTemplateInputDownloadProgress?: (
    callback: (data: ComfyTemplateInputDownloadProgress) => void
  ) => () => void
  pauseDownload?: (url: string) => Promise<boolean>
  resumeDownload?: (url: string) => Promise<boolean>
  cancelDownload?: (url: string) => Promise<boolean>
  onDownloadProgress?: (
    callback: (data: ComfyDownloadProgress) => void
  ) => () => void
  reportTheme?: (bg: string, text: string) => void
  Terminal?: ComfyDesktop2TerminalBridge
  Logs?: ComfyDesktop2LogsBridge
  Telemetry?: ComfyDesktop2TelemetryBridge
}

/**
 * The `-?` mapper intentionally requires every top-level bridge member.
 * Adding an optional top-level member to `ComfyDesktop2Bridge` is therefore a
 * breaking change for implementations of this type. Optional members of nested
 * bridge types remain optional because the mapper is not recursive.
 */
export type ComfyDesktop2BridgeImplementation = {
  [K in keyof ComfyDesktop2Bridge]-?: NonNullable<ComfyDesktop2Bridge[K]>
}
