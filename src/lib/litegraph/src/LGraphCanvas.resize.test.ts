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

  it('follows parent growth after the first resize', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const parent = document.createElement('div')
    const size = { width: 800, height: 600 }
    Object.defineProperties(parent, {
      offsetWidth: { get: () => size.width },
      offsetHeight: { get: () => size.height }
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

    size.width = 1000
    size.height = 700
    canvas.resize()

    expect([element.style.width, element.style.height]).toEqual([
      '1000px',
      '700px'
    ])
    expect([element.width, element.height]).toEqual([2000, 1400])
  })

  it('preserves CSS dimensions supplied by the caller', () => {
    vi.stubGlobal('devicePixelRatio', 2)
    const parent = document.createElement('div')
    Object.defineProperties(parent, {
      offsetWidth: { value: 800 },
      offsetHeight: { value: 600 }
    })
    const element = document.createElement('canvas')
    element.style.width = '75%'
    element.style.height = '50vh'
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

    expect([element.style.width, element.style.height]).toEqual(['75%', '50vh'])
    expect([element.width, element.height]).toEqual([1600, 1200])
  })
})
