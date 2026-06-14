import { describe, expect, it, vi } from 'vitest'

import '@/lib/litegraph/src/litegraph'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'

import type { DrawWidgetOptions } from './BaseWidget'
import { getWidgetBehavior, vueOnlyWidgetBehavior } from './widgetBehavior'

function createStubContext() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    font: '',
    textAlign: '',
    textBaseline: ''
  } as unknown as CanvasRenderingContext2D & {
    fillText: ReturnType<typeof vi.fn>
  }
}

describe('widget behavior registry', () => {
  it('registers Vue-only types and ignores native ones', () => {
    expect(getWidgetBehavior('boundingbox')).toBe(vueOnlyWidgetBehavior)
    expect(getWidgetBehavior('textarea')).toBe(vueOnlyWidgetBehavior)
    expect(getWidgetBehavior('number')).toBeUndefined()
    expect(getWidgetBehavior('combo')).toBeUndefined()
  })

  it('draws the Vue-only placeholder label for the widget type', () => {
    const ctx = createStubContext()
    const widget = { type: 'boundingbox', y: 10 } as unknown as IBaseWidget
    const options: DrawWidgetOptions = { width: 200 }

    vueOnlyWidgetBehavior.drawWidget(widget, ctx, options)

    expect(ctx.fillText).toHaveBeenCalledTimes(1)
    expect(vi.mocked(ctx.fillText).mock.calls[0][0]).toContain('BoundingBox')
  })
})
