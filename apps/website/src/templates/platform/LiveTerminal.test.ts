import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import { prefersReducedMotion } from '@/composables/useReducedMotion'
import LiveTerminal from './LiveTerminal.vue'

vi.mock(import('@/composables/useReducedMotion'), () => ({
  prefersReducedMotion: vi.fn()
}))

// The terminal only animates while on screen; happy-dom has no
// IntersectionObserver, so report every observed element as visible.
type ObserverEntry = { isIntersecting: boolean; time: number }

class VisibleIntersectionObserver {
  constructor(callback: (entries: ObserverEntry[]) => void) {
    this.callback = callback
  }
  callback: (entries: ObserverEntry[]) => void
  observe() {
    this.callback([{ isIntersecting: true, time: 0 }])
  }
  unobserve() {}
  disconnect() {}
  takeRecords() {}
}

const LINES = ['$ comfy up', '✔ Done']

function transcript(): string {
  return screen.getByRole('img', { name: 'Demo' }).textContent.replace('▋', '')
}

async function advance(ms: number): Promise<void> {
  await vi.advanceTimersByTimeAsync(ms)
  await nextTick()
}

describe('LiveTerminal', () => {
  beforeEach(() => {
    vi.mocked(prefersReducedMotion).mockReturnValue(false)
    vi.stubGlobal('IntersectionObserver', VisibleIntersectionObserver)
    vi.useFakeTimers({ shouldAdvanceTime: false })
  })

  it('types commands out and lands output lines whole', async () => {
    render(LiveTerminal, { props: { lines: LINES, label: 'Demo' } })
    await nextTick()
    expect(transcript()).toBe('')

    // First keystroke after the command pause, then one every TYPE_MS.
    await advance(500)
    expect(transcript()).toBe('$')
    await advance(35 * 9)
    expect(transcript()).toBe('$ comfy up')

    // The ✔ line lands whole after the output pause.
    await advance(700)
    expect(transcript()).toBe('$ comfy up✔ Done')
  })

  it('replays from the top after the hold', async () => {
    render(LiveTerminal, { props: { lines: LINES, label: 'Demo' } })
    await nextTick()

    await advance(500 + 35 * 9 + 700)
    expect(transcript()).toBe('$ comfy up✔ Done')

    await advance(5000)
    expect(transcript()).toBe('')
    await advance(500)
    expect(transcript()).toBe('$')
  })

  it('shows the full transcript statically under reduced motion', async () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    render(LiveTerminal, { props: { lines: LINES, label: 'Demo' } })
    await nextTick()

    expect(transcript()).toBe('$ comfy up✔ Done')
    await advance(10000)
    expect(transcript()).toBe('$ comfy up✔ Done')
  })

  it('keeps a blank line as a spacer between lines', async () => {
    vi.mocked(prefersReducedMotion).mockReturnValue(true)
    render(LiveTerminal, {
      props: { lines: ['$ comfy up', '', 'Ready in 2.1s'], label: 'Demo' }
    })
    await nextTick()

    expect(transcript()).toBe('$ comfy up Ready in 2.1s')
  })

  it('shows the full transcript statically when typewriter is disabled', async () => {
    render(LiveTerminal, {
      props: { lines: LINES, label: 'Demo', typewriter: false }
    })
    await nextTick()

    expect(transcript()).toBe('$ comfy up✔ Done')
    await advance(10000)
    expect(transcript()).toBe('$ comfy up✔ Done')
  })

  it('colors the prompt, leaves command text plain, and colors a success line green', async () => {
    render(LiveTerminal, {
      props: {
        lines: ['$ comfy build init', '✓ Scanned this install'],
        label: 'Demo',
        typewriter: false
      }
    })
    await nextTick()

    const prompt = screen.getByText('$')
    expect(prompt.getAttribute('style')).toContain(
      '--color-primary-comfy-yellow'
    )

    const command = screen.getByText('comfy build init')
    expect(command.getAttribute('style')).toBeNull()

    const successLine = screen.getByText('✓ Scanned this install')
    expect(successLine.getAttribute('style')).toContain('#A7C080')
  })
})
