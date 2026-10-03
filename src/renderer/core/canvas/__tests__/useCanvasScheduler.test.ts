import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { createCanvasScheduler } from '@/renderer/core/canvas/useCanvasScheduler'
import {
  createTestCanvasElement,
  setCanvasVisible
} from '@/utils/__tests__/canvasTestUtils'

vi.mock(import('@/platform/telemetry/reportError'))

describe('createCanvasScheduler', () => {
  let storeCanvas: HTMLCanvasElement

  beforeEach(() => {
    storeCanvas = createTestCanvasElement({ visible: true })
    document.body.append(storeCanvas)
    useCanvasStore().canvas = fromPartial<LGraphCanvas>({ canvas: storeCanvas })
  })

  it('runs an operation immediately when its canvas is visible', () => {
    const run = vi.fn()

    createCanvasScheduler().schedule({ run })

    expect(run).toHaveBeenCalledOnce()
  })

  it('treats a fixed-position canvas as visible without an offset parent', () => {
    const run = vi.fn()
    Object.defineProperty(storeCanvas, 'offsetParent', {
      configurable: true,
      value: null
    })

    createCanvasScheduler().schedule({ run })

    expect(run).toHaveBeenCalledOnce()
  })

  it('checks the operation canvas rather than the store canvas', () => {
    const run = vi.fn()
    setCanvasVisible(storeCanvas, false)
    const element = createTestCanvasElement({ visible: true })
    document.body.append(element)

    createCanvasScheduler().schedule({ element, run })

    expect(run).toHaveBeenCalledOnce()
  })

  it('queues work while the canvas is hidden and runs it in order on flush', () => {
    const scheduler = createCanvasScheduler()
    const calls: string[] = []
    setCanvasVisible(storeCanvas, false)

    scheduler.schedule({ run: () => calls.push('first') })
    scheduler.schedule({ run: () => calls.push('second') })
    scheduler.flush()
    expect(calls).toEqual([])

    setCanvasVisible(storeCanvas, true)
    scheduler.flush()
    expect(calls).toEqual(['first', 'second'])
  })

  it('reports a failing operation and still runs the rest', () => {
    const scheduler = createCanvasScheduler()
    const error = new Error('op failed')
    const after = vi.fn()
    setCanvasVisible(storeCanvas, false)
    scheduler.schedule({
      run: () => {
        throw error
      }
    })
    scheduler.schedule({ run: after })

    setCanvasVisible(storeCanvas, true)
    scheduler.flush()

    expect(after).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'canvas_scheduled_operation_failed'
    })
  })

  it('discards queued work whose canvas was detached', () => {
    const scheduler = createCanvasScheduler()
    const run = vi.fn()
    const element = createTestCanvasElement({ visible: false })
    document.body.append(element)
    scheduler.schedule({ element, run })

    element.remove()
    setCanvasVisible(element, true)
    scheduler.flush()

    expect(run).not.toHaveBeenCalled()
  })

  describe('keyed operations', () => {
    beforeEach(() => {
      setCanvasVisible(storeCanvas, false)
    })

    it.for([
      {
        name: 'a current replacement',
        replacementIsCurrent: true,
        runCounts: { original: 0, replacement: 1 }
      },
      {
        name: 'a stale replacement',
        replacementIsCurrent: false,
        runCounts: { original: 1, replacement: 0 }
      }
    ])(
      'keeps one operation per key when $name is scheduled',
      ({ replacementIsCurrent, runCounts }) => {
        const scheduler = createCanvasScheduler()
        const original = vi.fn()
        const replacement = vi.fn()
        scheduler.schedule({
          key: 'camera',
          isCurrent: () => true,
          run: original
        })
        scheduler.schedule({
          key: 'camera',
          isCurrent: () => replacementIsCurrent,
          run: replacement
        })

        setCanvasVisible(storeCanvas, true)
        scheduler.flush()

        expect({
          original: original.mock.calls.length,
          replacement: replacement.mock.calls.length
        }).toEqual(runCounts)
      }
    )

    it('drops an operation that becomes stale before it runs', () => {
      const scheduler = createCanvasScheduler()
      const run = vi.fn()
      let current = true
      scheduler.schedule({ key: 'camera', isCurrent: () => current, run })

      current = false
      setCanvasVisible(storeCanvas, true)
      scheduler.flush()

      expect(run).not.toHaveBeenCalled()
    })

    it('cancels a queued operation by key', () => {
      const scheduler = createCanvasScheduler()
      const run = vi.fn()
      scheduler.schedule({ key: 'camera', isCurrent: () => true, run })

      scheduler.cancel('camera')
      setCanvasVisible(storeCanvas, true)
      scheduler.flush()

      expect(run).not.toHaveBeenCalled()
    })
  })
})
