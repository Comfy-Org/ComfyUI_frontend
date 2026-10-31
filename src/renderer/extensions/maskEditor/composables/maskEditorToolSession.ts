import type {
  MaskEditorImageSnapshot,
  MaskEditorMask,
  MaskEditorOverlayPoint,
  MaskEditorPointerEvent,
  MaskEditorTool,
  MaskEditorToolContext,
  MaskEditorToolSession
} from '@comfyorg/mask-editor/extensionTypes'

export interface MaskEditorToolDocument {
  readImage(): MaskEditorImageSnapshot | undefined
  getDimensions(): Pick<MaskEditorMask, 'width' | 'height'> | undefined
  getRevision(): number
  applyMask(mask: MaskEditorMask): void
}

export function createMaskEditorToolSession(
  tool: MaskEditorTool,
  document: MaskEditorToolDocument,
  setOverlay: (points: readonly MaskEditorOverlayPoint[]) => void,
  reportFailure: (error: unknown) => void
) {
  let controller = new AbortController()
  let committing = false
  let session: MaskEditorToolSession = {}
  const panelCleanups = new Set<() => void>()
  const isDisposed = () => controller.signal.aborted

  function call<T>(callback: () => T): T | undefined {
    try {
      return callback()
    } catch (error) {
      dispose()
      reportFailure(error)
      return undefined
    }
  }

  const context: MaskEditorToolContext = {
    get signal() {
      return controller.signal
    },
    readImage: () =>
      isDisposed() ? undefined : call(() => document.readImage()),
    setOverlay: (points) => {
      if (
        isDisposed() ||
        !points.every(
          (point) =>
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            Number.isFinite(point.radius) &&
            point.radius > 0
        )
      )
        return false
      setOverlay(points.map((point) => ({ ...point })))
      return true
    },
    commitMask: (mask, { expectedRevision }) => {
      if (isDisposed()) return { ok: false, reason: 'inactive' }
      if (expectedRevision !== document.getRevision()) {
        return { ok: false, reason: 'stale' }
      }
      const dimensions = call(() => document.getDimensions())
      if (!dimensions) return { ok: false, reason: 'unavailable' }
      if (
        mask.width !== dimensions.width ||
        mask.height !== dimensions.height ||
        !(mask.data instanceof Uint8Array) ||
        mask.data.length !== mask.width * mask.height
      )
        return { ok: false, reason: 'invalid-mask' }
      committing = true
      const applied = call(() => {
        document.applyMask({ ...mask, data: mask.data.slice() })
        return true
      })
      committing = false
      return applied
        ? { ok: true, revision: document.getRevision() }
        : { ok: false, reason: 'failed' }
    }
  }

  function dispose() {
    if (isDisposed()) return
    controller.abort()
    setOverlay([])
    for (const cleanup of panelCleanups) cleanup()
    call(() => session.dispose?.())
  }

  const created = call(() => tool.createSession(context))
  if (created) {
    session = created
    if (isDisposed()) call(() => session.dispose?.())
  } else dispose()

  return {
    context,
    pointer: async (event: MaskEditorPointerEvent) => {
      if (isDisposed()) return
      const signal = controller.signal
      try {
        await session.onPointer?.(event)
      } catch (error) {
        if (signal.aborted) return
        dispose()
        reportFailure(error)
      }
    },
    mountPanel: (container: HTMLElement): (() => void) | undefined => {
      if (isDisposed()) return undefined
      const unmount = call(() => session.mountPanel?.(container))
      const cleanup = () => {
        if (!panelCleanups.delete(cleanup)) return
        if (unmount) call(unmount)
        container.replaceChildren()
      }
      panelCleanups.add(cleanup)
      if (isDisposed()) cleanup()
      return cleanup
    },
    documentChanged: () => {
      if (isDisposed() || committing) return
      const previous = controller
      controller = new AbortController()
      previous.abort()
      setOverlay([])
      call(() => session.onDocumentChange?.(document.getRevision()))
    },
    dispose
  }
}
