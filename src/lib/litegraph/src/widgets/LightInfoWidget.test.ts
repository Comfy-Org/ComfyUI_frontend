import { fromPartial } from '@total-typescript/shoehorn'
import { assert, describe, expect, it, vi } from 'vitest'

import { LGraphNode } from '@/lib/litegraph/src/litegraph'

import { LightInfoWidget } from './LightInfoWidget'

describe('LightInfoWidget', () => {
  it('backs the lightinfo widget type with a Vue-only canvas placeholder', () => {
    const node = new LGraphNode('CreateLightInfo')
    const widget = node.addWidget('lightinfo', 'editor_state', [], null)
    assert.instanceOf(widget, LightInfoWidget)
    const fillText = vi.fn()

    widget.drawWidget(
      fromPartial<CanvasRenderingContext2D>({
        save: vi.fn(),
        restore: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        fillText
      }),
      { width: 200 }
    )

    expect(fillText).toHaveBeenCalledWith(
      expect.stringContaining('Light Info'),
      100,
      expect.any(Number)
    )
  })
})
