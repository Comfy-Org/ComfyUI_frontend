import { describe, expect, it, vi } from 'vitest'

import { createMaskEditorToolSession } from './maskEditorToolSession'
import type { MaskEditorToolDocument } from './maskEditorToolSession'
import type {
  MaskEditorMask,
  MaskEditorOverlayPoint,
  MaskEditorToolSession
} from '@comfyorg/mask-editor/extensionTypes'

function setup(session: MaskEditorToolSession = {}) {
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
    readImage: () => ({ image, revision }),
    applyMask: (next) => {
      mask = next
      revision++
    }
  }
  const reportFailure = vi.fn()
  const runtime = createMaskEditorToolSession(
    { id: 'impact.sam', label: 'SAM', createSession: () => session },
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

describe('MaskEditor extension session contract', () => {
  it('reads the current image and applies an independent single-channel mask', () => {
    const { runtime, mask } = setup()
    const snapshot = runtime.context.readImage()
    expect(snapshot?.image.width).toBe(3)
    expect(runtime.context.commitMask(result, { expectedRevision: 1 })).toEqual(
      {
        ok: true,
        revision: 2
      }
    )
    expect(mask().data).toEqual(result.data)
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
    const { runtime, document } = setup({ onDocumentChange })
    const signal = runtime.context.signal
    document.applyMask(result)
    runtime.documentChanged()
    expect(signal.aborted).toBe(true)
    expect(runtime.context.signal.aborted).toBe(false)
    expect(onDocumentChange).toHaveBeenCalledWith(2)
  })

  it('cleans up once and prevents a closed session from changing the next editor', () => {
    const dispose = vi.fn()
    const { runtime, mask, overlay } = setup({ dispose })
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
    const { runtime, reportFailure } = setup({
      dispose: () => {
        throw failure
      }
    })
    runtime.dispose()
    expect(reportFailure).toHaveBeenCalledWith(failure)
    expect(runtime.context.signal.aborted).toBe(true)
  })

  it('cleans a partially mounted panel and disables a failing session', () => {
    const failure = new Error('panel failed to mount')
    const dispose = vi.fn()
    const { runtime, reportFailure } = setup({
      mountPanel: (container) => {
        container.textContent = 'partially mounted'
        throw failure
      },
      dispose
    })
    const container = document.createElement('div')
    runtime.mountPanel(container)
    expect(container.childNodes).toHaveLength(0)
    expect(runtime.context.signal.aborted).toBe(true)
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(reportFailure).toHaveBeenCalledWith(failure)
  })
})
