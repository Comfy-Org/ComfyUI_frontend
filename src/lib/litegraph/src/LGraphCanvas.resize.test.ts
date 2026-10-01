import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphCanvas } from '@/lib/litegraph/src/litegraph'

describe('LGraphCanvas.resize', () => {
  it('keeps a parent-sized canvas at its logical CSS dimensions', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const parent = document.createElement('div')
    Object.defineProperties(parent, {
      offsetWidth: { value: 800 },
      offsetHeight: { value: 600 }
    })
    const element = document.createElement('canvas')
    element.getContext = vi.fn().mockReturnValue({
      scale: vi.fn(),
      setTransform: vi.fn()
    })
    parent.append(element)
    const canvas = new LGraphCanvas(element, new LGraph(), {
      skip_render: true,
      skip_events: true
    })

    canvas.resize()

    expect(element.style.width).toBe('800px')
    expect(element.style.height).toBe('600px')
    expect(element.width).toBe(1600)
    expect(element.height).toBe(1200)
  })
})
