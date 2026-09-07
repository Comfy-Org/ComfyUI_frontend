// @vitest-environment happy-dom
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import ColorNode from './ColorNode.vue'

describe('ColorNode', () => {
  it('renders hue and saturation sliders with readable value text', () => {
    render(ColorNode, { props: { hue: 120, saturation: 0.5 } })

    const hue = screen.getByRole('slider', { name: 'HUE' })
    expect(hue.getAttribute('aria-valuenow')).toBe('120')
    expect(hue.getAttribute('aria-valuetext')).toBe('120 degrees')

    const saturation = screen.getByRole('slider', { name: 'SATURATION' })
    expect(saturation.getAttribute('aria-valuemax')).toBe('2')
    expect(saturation.getAttribute('aria-valuetext')).toBe('50%')
  })

  it('forwards slider keyboard input to its models', () => {
    const { emitted } = render(ColorNode, {
      props: { hue: 0, saturation: 1 }
    })

    screen
      .getByRole('slider', { name: 'HUE' })
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(emitted('update:hue')?.at(-1)).toEqual([1])

    screen
      .getByRole('slider', { name: 'SATURATION' })
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    const [saturation] = emitted('update:saturation')?.at(-1) as [number]
    expect(saturation).toBeCloseTo(0.95)
  })

  it('settles the shared in-motion window after values stop changing', async () => {
    const { rerender } = render(ColorNode, { props: { hue: 0, saturation: 1 } })

    await rerender({ hue: 90, saturation: 1 })
    await vi.advanceTimersByTimeAsync(200)
    await rerender({ hue: 180, saturation: 1 })
    await vi.advanceTimersByTimeAsync(300)

    const hue = screen.getByRole('slider', { name: 'HUE' })
    expect(hue.getAttribute('aria-valuenow')).toBe('180')
  })
})
