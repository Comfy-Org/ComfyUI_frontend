import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { bootstrapTracer } from '@/platform/telemetry/perf/bootstrapTracer'
import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'

import { canvasOrReport } from './touchCanvasAccess'

vi.mock(import('@/platform/telemetry/reportError'))

const canvasEl = vi.hoisted(() => document.createElement('canvas'))

vi.mock(import('@/scripts/app'), () => ({
  app: fromPartial<typeof app>({
    canvasElRef: shallowRef(canvasEl),
    get canvasOrUndefined(): LGraphCanvas | undefined {
      return undefined
    }
  })
}))

describe('canvasOrReport', () => {
  it('returns the canvas without reporting when one exists', () => {
    const canvas = fromPartial<LGraphCanvas>({})
    vi.spyOn(app, 'canvasOrUndefined', 'get').mockReturnValue(canvas)

    expect(canvasOrReport('has-canvas', new Event('touchstart'))).toBe(canvas)
    expect(reportError).not.toHaveBeenCalled()
  })

  it('reports why the canvas is missing, once per entry point', () => {
    document.body.append(canvasEl)
    bootstrapTracer.complete('failed')
    const press = new PointerEvent('pointerdown', {
      pointerType: 'touch',
      isPrimary: true
    })

    expect(canvasOrReport('press', press)).toBeUndefined()
    canvasOrReport('press', press)

    expect(reportError).toHaveBeenCalledExactlyOnceWith(
      expect.any(Error),
      expect.objectContaining({
        errorType: 'error_handling_touch_input_missing_canvas',
        context: {
          entryPoint: 'press',
          eventType: 'pointerdown',
          pointerType: 'touch',
          isPrimary: true,
          documentReadyState: document.readyState,
          bootstrapOutcome: 'failed',
          hasWindowApp: false,
          hasCanvasEl: true,
          canvasElConnected: true,
          targetIsCanvasEl: false
        }
      })
    )
  })

  it('reports each entry point separately', () => {
    canvasOrReport('pinch-start', new Event('touchstart'))
    canvasOrReport('pinch-move', new Event('touchmove'))

    expect(reportError).toHaveBeenCalledTimes(2)
  })
})
