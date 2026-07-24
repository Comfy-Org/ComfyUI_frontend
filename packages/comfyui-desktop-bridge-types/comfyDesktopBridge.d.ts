export interface ComfyDownloadProgress {
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
  isRemote(): boolean
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

export type ComfyDesktop2BridgeImplementation = {
  [K in keyof ComfyDesktop2Bridge]-?: NonNullable<ComfyDesktop2Bridge[K]>
}
