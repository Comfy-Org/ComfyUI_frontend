import { describe, expect, it, vi } from 'vitest'

import { createMaskEditorToolSession } from './maskEditorToolSession'
import type { MaskEditorToolDocument } from './maskEditorToolSession'
import type {
  MaskEditorMask,
  MaskEditorOverlayPoint,
  MaskEditorPointerEvent,
  MaskEditorTool,
  MaskEditorToolSession
} from '@comfyorg/mask-editor/extensionTypes'

function setup(createSession: MaskEditorTool['createSession'] = () => ({})) {
  let revision = 1
  let mask: MaskEditorMask = {
    width: 3,
    height: 2,
    data: new Uint8Array(6)
  }
  let overlay: readonly MaskEditorOverlayPoint[] = []
  const image: ImageData = {
    width: 3,
    height: 2,
    colorSpace: 'srgb',
    data: new Uint8ClampedArray(24).fill(255)
  }
  const document: MaskEditorToolDocument = {
    getRevision: () => revision,
    getDimensions: () => ({ width: image.width, height: image.height }),
    readImage: () => ({ image, revision }),
    applyMask: (next) => {
      mask = next
      revision++
    }
  }
  const reportFailure = vi.fn()
  const runtime = createMaskEditorToolSession(
    { id: 'impact.sam', label: 'SAM', createSession },
    document,
    (points) => {
      overlay = points
    },
    reportFailure
  )
  return {
    runtime,
    document,
    reportFailure,
    mask: () => mask,
    overlay: () => overlay
  }
}

const result: MaskEditorMask = {
  width: 3,
  height: 2,
  data: new Uint8Array([0, 255, 128, 255, 0, 0])
}

const pointerEvent: MaskEditorPointerEvent = {
  phase: 'down',
  x: 1,
  y: 1,
  inBounds: true,
  pointerId: 1,
  pointerType: 'mouse',
  button: 0,
  buttons: 1,
  pressure: 0.5,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false
}

describe('MaskEditor extension session contract', () => {
  it('reads the current image and commits a single-channel mask with a new revision', () => {
    const { runtime, mask } = setup()
    const snapshot = runtime.context.readImage()
    expect(snapshot?.image.width).toBe(3)
    expect(runtime.context.commitMask(result, { expectedRevision: 1 })).toEqual(
      {
        ok: true,
        revision: 2
      }
    )
    expect(mask().data).toEqual(new Uint8Array([0, 255, 128, 255, 0, 0]))
    expect(snapshot?.image.data).toEqual(new Uint8ClampedArray(24).fill(255))
  })

  it('rejects an inference result after a document edit', () => {
    const { runtime, document, mask } = setup()
    document.applyMask(result)
    const before = mask()
    expect(runtime.context.commitMask(result, { expectedRevision: 1 })).toEqual(
      {
        ok: false,
        reason: 'stale'
      }
    )
    expect(mask()).toBe(before)
  })

  it.for([
    { width: 2, height: 3, data: new Uint8Array(6) },
    { width: 3, height: 2, data: new Uint8Array(5) }
  ])('rejects a mismatched mask without changing the document', (invalid) => {
    const { runtime, mask, document } = setup()
    expect(
      runtime.context.commitMask(invalid, { expectedRevision: 1 })
    ).toEqual({
      ok: false,
      reason: 'invalid-mask'
    })
    expect(mask().data).toEqual(new Uint8Array(6))
    expect(document.getRevision()).toBe(1)
  })

  it('cancels old work on document changes and notifies the active tool', () => {
    const onDocumentChange = vi.fn()
    const { runtime, document } = setup(() => ({ onDocumentChange }))
    const signal = runtime.context.signal
    document.applyMask(result)
    runtime.documentChanged()
    expect(signal.aborted).toBe(true)
    expect(runtime.context.signal.aborted).toBe(false)
    expect(onDocumentChange).toHaveBeenCalledWith(2)
  })

  it('cleans up once and prevents a closed session from changing the next editor', () => {
    const dispose = vi.fn()
    const { runtime, mask, overlay } = setup(() => ({ dispose }))
    const points = [{ id: 'positive', x: 1, y: 1, radius: 4, color: 'blue' }]
    expect(runtime.context.setOverlay(points)).toBe(true)
    expect(overlay()).toEqual(points)
    runtime.dispose()
    runtime.dispose()
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(runtime.context.signal.aborted).toBe(true)
    expect(runtime.context.readImage()).toBeUndefined()
    expect(runtime.context.setOverlay(points)).toBe(false)
    expect(overlay()).toEqual([])
    expect(runtime.context.commitMask(result, { expectedRevision: 1 })).toEqual(
      {
        ok: false,
        reason: 'inactive'
      }
    )
    expect(mask().data).toEqual(new Uint8Array(6))
  })

  it('contains extension cleanup failures', () => {
    const failure = new Error('extension cleanup failed')
    const { runtime, reportFailure } = setup(() => ({
      dispose: () => {
        throw failure
      }
    }))
    runtime.dispose()
    expect(reportFailure).toHaveBeenCalledWith(failure)
    expect(runtime.context.signal.aborted).toBe(true)
  })

  it('cleans a partially mounted panel and disables a failing session', () => {
    const failure = new Error('panel failed to mount')
    const dispose = vi.fn()
    const { runtime, reportFailure } = setup(() => ({
      mountPanel: (container) => {
        container.textContent = 'partially mounted'
        throw failure
      },
      dispose
    }))
    const container = document.createElement('div')
    runtime.mountPanel(container)
    expect(container.childNodes).toHaveLength(0)
    expect(runtime.context.signal.aborted).toBe(true)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(reportFailure).toHaveBeenCalledWith(failure)
  })

  it.for([
    { name: 'DOM element', returned: () => document.createElement('button') },
    { name: 'async mount', returned: () => Promise.resolve() },
    {
      name: 'rejected async mount',
      returned: () => Promise.reject(new Error('Async mount failed'))
    }
  ])(
    'rejects an invalid panel cleanup at mount time: $name',
    async ({ returned }) => {
      const mountPanel =
        vi.fn<NonNullable<MaskEditorToolSession['mountPanel']>>()
      Reflect.apply(mountPanel.mockImplementation, mountPanel, [
        (container: HTMLElement) => {
          container.textContent = 'partially mounted'
          return returned()
        }
      ])
      const { runtime, reportFailure } = setup(() => ({ mountPanel }))
      const container = document.createElement('div')

      runtime.mountPanel(container)

      expect(runtime.context.signal.aborted).toBe(true)
      expect(container.childNodes).toHaveLength(0)
      expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
      await Promise.resolve()
      runtime.dispose()
      expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
    }
  )

  it.for([undefined, null])(
    'refuses a missing JavaScript mask: %s',
    (invalid) => {
      const { runtime, mask, document } = setup()
      expect(
        Reflect.apply(runtime.context.commitMask, runtime.context, [
          invalid,
          { expectedRevision: 1 }
        ])
      ).toEqual({ ok: false, reason: 'invalid-mask' })
      expect(mask().data).toEqual(new Uint8Array(6))
      expect(document.getRevision()).toBe(1)
    }
  )

  it.for([
    undefined,
    null,
    {},
    { expectedRevision: '1' },
    { expectedRevision: NaN }
  ])('refuses invalid JavaScript commit options: %j', (invalid) => {
    const { runtime, mask, document } = setup()
    expect(
      Reflect.apply(runtime.context.commitMask, runtime.context, [
        result,
        invalid
      ])
    ).toEqual({ ok: false, reason: 'invalid-options' })
    expect(mask().data).toEqual(new Uint8Array(6))
    expect(document.getRevision()).toBe(1)
  })

  it.for([
    { name: 'missing array', invalid: undefined },
    { name: 'non-array', invalid: {} },
    { name: 'null point', invalid: [null] },
    { name: 'sparse array', invalid: Object.assign([], { length: 1 }) },
    {
      name: 'duplicate identity',
      invalid: [
        { id: 'positive', x: 1, y: 1, radius: 4, color: 'blue' },
        { id: 'positive', x: 2, y: 0, radius: 4, color: 'red' }
      ]
    },
    {
      name: 'non-string identity',
      invalid: [{ id: 7, x: 1, y: 1, radius: 4, color: 'blue' }]
    },
    {
      name: 'non-string color',
      invalid: [{ id: 'positive', x: 1, y: 1, radius: 4, color: {} }]
    }
  ])(
    'preserves the overlay on invalid JavaScript points: $name',
    ({ invalid }) => {
      const { runtime, overlay } = setup()
      const points = [{ id: 'positive', x: 1, y: 1, radius: 4, color: 'blue' }]
      runtime.context.setOverlay(points)
      expect(
        Reflect.apply(runtime.context.setOverlay, runtime.context, [invalid])
      ).toBe(false)
      expect(overlay()).toEqual(points)
    }
  )

  it('reports and closes a JavaScript tool that returns no session', () => {
    const { runtime, reportFailure } = setup(
      vi.fn<MaskEditorTool['createSession']>()
    )
    expect(runtime.context.signal.aborted).toBe(true)
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
  })

  it.for([
    { name: 'primitive', returned: () => 7 },
    { name: 'async factory', returned: () => Promise.resolve({}) },
    {
      name: 'rejected async factory',
      returned: () => Promise.reject(new Error('Async creation failed'))
    }
  ])('rejects an invalid JavaScript session: $name', async ({ returned }) => {
    const createSession = vi.fn<MaskEditorTool['createSession']>()
    Reflect.apply(createSession.mockReturnValue, createSession, [returned()])
    const { runtime, reportFailure } = setup(createSession)
    await Promise.resolve()
    expect(runtime.context.signal.aborted).toBe(true)
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(expect.any(Error))
  })

  it('snapshots getter-backed overlay points without retaining caller state', () => {
    class Point implements MaskEditorOverlayPoint {
      readonly id = 'positive'
      readonly color = 'blue'
      readonly y = 2
      readonly radius = 4
      position = 1

      get x() {
        return this.position
      }
    }

    const { runtime, overlay } = setup()
    const point = new Point()
    expect(
      runtime.context.setOverlay([
        point,
        { id: 'negative', color: 'red', x: 2, y: 1, radius: 3 }
      ])
    ).toBe(true)
    point.position = 9
    expect(overlay()).toEqual([
      { id: 'positive', color: 'blue', x: 1, y: 2, radius: 4 },
      { id: 'negative', color: 'red', x: 2, y: 1, radius: 3 }
    ])
  })

  it('reports a thrown session creation failure only once', () => {
    const failure = new Error('session creation failed')
    const { runtime, reportFailure } = setup(() => {
      throw failure
    })
    expect(runtime.context.signal.aborted).toBe(true)
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('refuses an unavailable document without closing the session', () => {
    const { runtime, document, mask, reportFailure } = setup()
    vi.spyOn(document, 'getDimensions').mockReturnValue(undefined)
    expect(runtime.context.commitMask(result, { expectedRevision: 1 })).toEqual(
      { ok: false, reason: 'unavailable' }
    )
    expect(mask().data).toEqual(new Uint8Array(6))
    expect(runtime.context.signal.aborted).toBe(false)
    expect(reportFailure).not.toHaveBeenCalled()
  })

  it('reports a failed mask application once and closes the session', () => {
    const failure = new Error('Canvas write failed')
    const { runtime, document, reportFailure } = setup()
    vi.spyOn(document, 'applyMask').mockImplementation(() => {
      throw failure
    })
    expect(runtime.context.commitMask(result, { expectedRevision: 1 })).toEqual(
      { ok: false, reason: 'failed' }
    )
    expect(runtime.context.signal.aborted).toBe(true)
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('reports an active pointer rejection once and disposes the session', async () => {
    const failure = new Error('Point processing failed')
    const dispose = vi.fn()
    const { runtime, reportFailure } = setup(() => ({
      onPointer: async () => {
        throw failure
      },
      dispose
    }))
    await runtime.pointer(pointerEvent)
    expect(runtime.context.signal.aborted).toBe(true)
    expect(dispose).toHaveBeenCalledExactlyOnceWith()
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('closes the session when an asynchronous document callback fails', async () => {
    const failure = new Error('Document refresh failed')
    const reject = vi.fn<(error: unknown) => void>()
    const pending = new Promise<void>((_, rejectPromise) => {
      reject.mockImplementation(rejectPromise)
    })
    const dispose = vi.fn()
    const { runtime, document, reportFailure, overlay } = setup(() => ({
      onDocumentChange: () => pending,
      dispose
    }))
    document.applyMask(result)
    runtime.documentChanged()
    runtime.context.setOverlay([
      { id: 'pending', x: 1, y: 1, radius: 4, color: 'blue' }
    ])
    reject(failure)
    await pending.catch(() => undefined)
    expect(runtime.context.signal.aborted).toBe(true)
    expect(overlay()).toEqual([])
    expect(dispose).toHaveBeenCalledExactlyOnceWith()
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('ignores a rejected document refresh superseded by a later edit', async () => {
    const reject = vi.fn<(error: unknown) => void>()
    const pending = new Promise<void>((_, rejectPromise) => {
      reject.mockImplementation(rejectPromise)
    })
    const onDocumentChange = vi.fn().mockReturnValueOnce(pending)
    const { runtime, document, reportFailure } = setup(() => ({
      onDocumentChange
    }))
    document.applyMask(result)
    runtime.documentChanged()
    const oldSignal = runtime.context.signal
    document.applyMask(result)
    runtime.documentChanged()
    reject(new Error('Obsolete document refresh failed'))
    await pending.catch(() => undefined)
    expect(oldSignal.aborted).toBe(true)
    expect(runtime.context.signal.aborted).toBe(false)
    expect(reportFailure).not.toHaveBeenCalled()
    expect(runtime.context.commitMask(result, { expectedRevision: 3 })).toEqual(
      { ok: true, revision: 4 }
    )
  })

  it('reports asynchronous disposal failures without delaying session closure', async () => {
    const failure = new Error('Asynchronous disposal failed')
    const reject = vi.fn<(error: unknown) => void>()
    const pending = new Promise<void>((_, rejectPromise) => {
      reject.mockImplementation(rejectPromise)
    })
    const dispose = vi.fn(() => pending)
    const { runtime, reportFailure } = setup(() => ({ dispose }))
    runtime.dispose()
    runtime.dispose()
    expect(runtime.context.signal.aborted).toBe(true)
    expect(runtime.context.readImage()).toBeUndefined()
    expect(dispose).toHaveBeenCalledExactlyOnceWith()
    reject(failure)
    await pending.catch(() => undefined)
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('removes the panel immediately and contains asynchronous unmount failures', async () => {
    const failure = new Error('Panel cleanup failed')
    const reject = vi.fn<(error: unknown) => void>()
    const pending = new Promise<void>((_, rejectPromise) => {
      reject.mockImplementation(rejectPromise)
    })
    const cleanup = vi.fn(() => pending)
    const dispose = vi.fn()
    const { runtime, reportFailure } = setup(() => ({
      mountPanel(container) {
        container.textContent = 'Tool controls'
        return cleanup
      },
      dispose
    }))
    const container = document.createElement('div')
    const unmount = runtime.mountPanel(container)
    runtime.dispose()
    unmount?.()
    expect(container.childNodes).toHaveLength(0)
    expect(cleanup).toHaveBeenCalledExactlyOnceWith()
    expect(dispose).toHaveBeenCalledExactlyOnceWith()
    reject(failure)
    await pending.catch(() => undefined)
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('reports the original failure once when disposal also fails', async () => {
    const failure = new Error('Point callback failed')
    const dispose = vi.fn(() => {
      throw new Error('Disposal failed too')
    })
    const { runtime, reportFailure } = setup(() => ({
      onPointer: () => {
        throw failure
      },
      dispose
    }))
    await runtime.pointer(pointerEvent)
    expect(dispose).toHaveBeenCalledExactlyOnceWith()
    expect(reportFailure).toHaveBeenCalledExactlyOnceWith(failure)
  })

  it('keeps the current document session when an obsolete pointer callback rejects', async () => {
    const failure = new Error('Obsolete point processing failed')
    const reject = vi.fn<() => void>()
    const pending = new Promise<void>((_, rejectPromise) => {
      reject.mockImplementation(() => rejectPromise(failure))
    })
    const dispose = vi.fn()
    const { runtime, reportFailure } = setup(() => ({
      onPointer: () => pending,
      dispose
    }))
    const oldSignal = runtime.context.signal
    const callback = runtime.pointer(pointerEvent)
    runtime.documentChanged()
    reject()
    await callback
    expect(oldSignal.aborted).toBe(true)
    expect(runtime.context.signal.aborted).toBe(false)
    expect(dispose).not.toHaveBeenCalled()
    expect(reportFailure).not.toHaveBeenCalled()
    expect(runtime.context.commitMask(result, { expectedRevision: 1 })).toEqual(
      { ok: true, revision: 2 }
    )
  })
})
