export interface MaskEditorMask {
  readonly width: number
  readonly height: number
  readonly data: Uint8Array
}

export interface MaskEditorImageSnapshot {
  readonly image: ImageData
  readonly revision: number
}

export interface MaskEditorOverlayPoint {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly radius: number
  readonly color: string
}

export interface MaskEditorPointerEvent {
  readonly phase: 'down' | 'move' | 'up' | 'cancel'
  readonly x: number
  readonly y: number
  readonly inBounds: boolean
  readonly pointerId: number
  readonly pointerType: string
  readonly button: number
  readonly buttons: number
  readonly pressure: number
  readonly altKey: boolean
  readonly ctrlKey: boolean
  readonly metaKey: boolean
  readonly shiftKey: boolean
}

export type MaskEditorCommitResult =
  | { ok: true; revision: number }
  | {
      ok: false
      reason:
        | 'inactive'
        | 'unavailable'
        | 'stale'
        | 'invalid-mask'
        | 'invalid-options'
        | 'failed'
    }

export interface MaskEditorToolContext {
  readonly signal: AbortSignal
  readImage(): MaskEditorImageSnapshot | undefined
  setOverlay(points: readonly MaskEditorOverlayPoint[]): boolean
  commitMask(
    mask: MaskEditorMask,
    options: { expectedRevision: number }
  ): MaskEditorCommitResult
}

export interface MaskEditorToolSession {
  onPointer?(event: MaskEditorPointerEvent): void | Promise<void>
  mountPanel?(container: HTMLElement): void | (() => void | Promise<void>)
  onDocumentChange?(revision: number): void | Promise<void>
  dispose?(): void | Promise<void>
}

export interface MaskEditorTool {
  readonly id: string
  readonly label: string
  readonly icon?: string
  createSession(context: MaskEditorToolContext): MaskEditorToolSession
}

export type MaskEditorToolRegistration =
  | { ok: true; unregister(): void }
  | { ok: false; reason: 'invalid-tool' | 'duplicate-id' }

export interface MaskEditorExtensionAPI {
  registerTool(tool: MaskEditorTool): MaskEditorToolRegistration
}
