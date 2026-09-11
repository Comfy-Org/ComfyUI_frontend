// @vitest-environment happy-dom
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'

import OutputTransport from './OutputTransport.vue'

describe('OutputTransport', () => {
  it('counts the clip out and wraps at its length', async () => {
    vi.useFakeTimers()
    render(OutputTransport, { props: { seconds: 2 } })

    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByTestId('output-time').textContent.trim()).toBe('00:01')

    await vi.advanceTimersByTimeAsync(1000)
    expect(screen.getByTestId('output-time').textContent.trim()).toBe('00:00')
    vi.useRealTimers()
  })

  it('holds the clock where it is while paused', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(OutputTransport, { props: { seconds: 10 } })

    await vi.advanceTimersByTimeAsync(2000)
    await user.click(screen.getByTestId('output-play'))
    await vi.advanceTimersByTimeAsync(3000)

    expect(screen.getByTestId('output-time').textContent.trim()).toBe('00:02')
    vi.useRealTimers()
  })

  it('turns the sound on and off', async () => {
    const user = userEvent.setup()
    render(OutputTransport)

    const sound = screen.getByTestId('output-sound')
    expect(sound.getAttribute('aria-pressed')).toBe('false')

    await user.click(sound)
    expect(sound.getAttribute('aria-pressed')).toBe('true')
  })

  it('offers to expand only where the result can be opened', async () => {
    const user = userEvent.setup()
    const { emitted, rerender } = render(OutputTransport)
    expect(screen.queryByTestId('output-expand')).toBeNull()

    await rerender({ expandable: true })
    await user.click(screen.getByTestId('output-expand'))
    expect(emitted('expand')).toHaveLength(1)
  })
})
