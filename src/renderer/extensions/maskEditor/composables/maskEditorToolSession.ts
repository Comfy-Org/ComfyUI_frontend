import { once } from 'es-toolkit'

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

function isValidMask(
  mask: MaskEditorMask,
  dimensions: Pick<MaskEditorMask, 'width' | 'height'>
) {
  return (
    mask.width === dimensions.width &&
    mask.height === dimensions.height &&
    mask.data instanceof Uint8Array &&
    mask.data.length === mask.width * mask.height
  )
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
  const fail = once((error: unknown) => {
    dispose()
    reportFailure(error)
  })

  function call<T>(callback: () => T): T | undefined {
    try {
      return callback()
    } catch (error) {
      fail(error)
      return undefined
    }
  }

  async function callAsync(
    callback: () => void | Promise<void>,
    signal?: AbortSignal
  ) {
    try {
      await callback()
    } catch (error) {
      if (!signal?.aborted) fail(error)
    }
  }

  const context: MaskEditorToolContext = {
    get signal() {
      return controller.signal
    },
    readImage: () =>
      isDisposed() ? undefined : call(() => document.readImage()),
    setOverlay: (points) => {
      if (isDisposed() || !Array.isArray(points)) return false
      const overlay = Array.from(
        points,
        (point: MaskEditorOverlayPoint | null | undefined) =>
          point && {
            id: point.id,
            x: point.x,
            y: point.y,
            radius: point.radius,
            color: point.color
          }
      )
      if (
        !overlay.every(
          (point): point is MaskEditorOverlayPoint =>
            point != null &&
            typeof point.id === 'string' &&
            typeof point.color === 'string' &&
            Number.isFinite(point.x) &&
            Number.isFinite(point.y) &&
            Number.isFinite(point.radius) &&
            point.radius > 0
        )
      )
        return false
      setOverlay(overlay)
      return true
    },
    commitMask: (
      mask: MaskEditorMask | null | undefined,
      options: { expectedRevision: number } | null | undefined
    ) => {
      if (isDisposed()) return { ok: false, reason: 'inactive' }
      if (!options || !Number.isSafeInteger(options.expectedRevision))
        return { ok: false, reason: 'invalid-options' }
      if (!mask) return { ok: false, reason: 'invalid-mask' }
      if (options.expectedRevision !== document.getRevision()) {
        return { ok: false, reason: 'stale' }
      }
      const dimensions = call(() => document.getDimensions())
      if (!dimensions) return { ok: false, reason: 'unavailable' }
      if (!isValidMask(mask, dimensions))
        return { ok: false, reason: 'invalid-mask' }
      committing = true
      const applied = call(() => {
        document.applyMask(mask)
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
    void callAsync(() => session.dispose?.())
  }

  const created = call(() => {
    const candidate: unknown = tool.createSession(context)
    if (candidate === null || typeof candidate !== 'object') return undefined
    if ('then' in candidate && typeof candidate.then === 'function') {
      void Promise.resolve(candidate).catch(() => undefined)
      return undefined
    }
    return candidate
  })
  if (created) {
    session = created
    if (isDisposed()) void callAsync(() => session.dispose?.())
  } else if (!isDisposed()) {
    fail(new Error('MaskEditor tool must return a synchronous session'))
  }

  return {
    context,
    pointer: async (event: MaskEditorPointerEvent) => {
      if (isDisposed()) return
      await callAsync(() => session.onPointer?.(event), controller.signal)
    },
    mountPanel: (container: HTMLElement): (() => void) | undefined => {
      if (isDisposed()) return undefined
      const unmount = call(() => session.mountPanel?.(container))
      const cleanup = () => {
        if (!panelCleanups.delete(cleanup)) return
        if (unmount) void callAsync(unmount)
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
      void callAsync(
        () => session.onDocumentChange?.(document.getRevision()),
        controller.signal
      )
    },
    dispose
  }
}
