// @vitest-environment happy-dom
/* eslint-disable testing-library/no-node-access */
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  setAllIntersecting,
  stubIntersectionObserver
} from '../../test/fakeIntersectionObserver'
import CodeTabs from './CodeTabs.vue'
import type { CodeTab } from './CodeTabs.vue'

const motion = vi.hoisted(() => ({ reduced: false }))

vi.mock('../../composables/useReducedMotion', () => ({
  prefersReducedMotion: () => motion.reduced
}))

const CYCLE_INTERVAL_MS = 3000

const tabs: Record<string, CodeTab> = {
  python: {
    name: 'Python',
    segments: [
      'run("',
      { values: ['first-model', 'second-model'], highlight: true },
      '")'
    ]
  },
  curl: {
    name: 'cURL',
    segments: ['curl https://api.comfy.org\n--data @body.json']
  }
}

function codeText() {
  return screen.getByRole('tabpanel').textContent
}

function setDocumentVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('CodeTabs', () => {
  beforeEach(() => {
    motion.reduced = false
    setDocumentVisibility('visible')
    stubIntersectionObserver()
  })

  it('renders the first tab with the first value of each cycling segment', () => {
    render(CodeTabs, { props: { tabs, label: 'Models API' } })

    expect(screen.getByRole('tablist', { name: 'Models API' })).toBeTruthy()
    expect(codeText()).toBe('run("first-model")')
  })

  it('cycles values on the interval once visible', async () => {
    render(CodeTabs, { props: { tabs, label: 'Models API' } })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(CYCLE_INTERVAL_MS)
    expect(codeText()).toBe('run("second-model")')

    // Wraps back around rather than running off the end of the value list.
    await vi.advanceTimersByTimeAsync(CYCLE_INTERVAL_MS)
    expect(codeText()).toBe('run("first-model")')
  })

  it('does not cycle while off screen', async () => {
    render(CodeTabs, { props: { tabs, label: 'Models API' } })

    await setAllIntersecting(false)
    await vi.advanceTimersByTimeAsync(CYCLE_INTERVAL_MS * 3)

    expect(codeText()).toBe('run("first-model")')
  })

  it('pauses when the document is hidden and resumes when it returns', async () => {
    render(CodeTabs, { props: { tabs, label: 'Models API' } })
    await setAllIntersecting(true)

    setDocumentVisibility('hidden')
    await vi.advanceTimersByTimeAsync(CYCLE_INTERVAL_MS * 3)
    expect(codeText()).toBe('run("first-model")')

    setDocumentVisibility('visible')
    await vi.advanceTimersByTimeAsync(CYCLE_INTERVAL_MS)
    expect(codeText()).toBe('run("second-model")')
  })

  it('never cycles when the user prefers reduced motion', async () => {
    motion.reduced = true
    render(CodeTabs, { props: { tabs, label: 'Models API' } })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(CYCLE_INTERVAL_MS * 3)

    expect(codeText()).toBe('run("first-model")')
  })

  it('leaves a static tab alone and never starts an interval for it', async () => {
    const staticOnly = { curl: tabs.curl }
    render(CodeTabs, { props: { tabs: staticOnly, label: 'Models API' } })

    await setAllIntersecting(true)
    await vi.advanceTimersByTimeAsync(CYCLE_INTERVAL_MS * 3)

    expect(codeText()).toBe('curl https://api.comfy.org\n--data @body.json')
  })

  it('sizes the panel to the tallest sample so cycling never reflows it', () => {
    render(CodeTabs, { props: { tabs, label: 'Models API' } })

    // The cURL sample is the tallest at two lines: 2 * 1.5rem + 3rem.
    expect(
      screen.getByRole('tabpanel').querySelector('pre')?.style.height
    ).toBe('6rem')
  })
})
