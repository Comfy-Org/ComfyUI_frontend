import type { Page } from '@playwright/test'

import { networkIsolationFixture as base } from '@e2e/fixtures/networkIsolationFixture'

interface ProbeState {
  entersAtPage: string[]
  runRequests: number
}

declare global {
  interface Window {
    pageShortcutProbe?: ProbeState
  }
}

/** Records Enter chords that reach window-level keydown listeners, and run requests. */
export class PageShortcutProbe {
  constructor(private readonly page: Page) {}

  /** Call once the app has loaded: the run-request count reads `window.app`. */
  async install(): Promise<void> {
    await this.page.evaluate(() => {
      const state: ProbeState = { entersAtPage: [], runRequests: 0 }
      window.pageShortcutProbe = state
      window.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter') return
        const chord = [
          event.ctrlKey && 'Control',
          event.shiftKey && 'Shift',
          'Enter'
        ]
          .filter(Boolean)
          .join('+')
        const onCanvas =
          event.target instanceof Element && event.target.id === 'graph-canvas'
        state.entersAtPage.push(
          `${chord} ${onCanvas ? 'on canvas' : 'elsewhere'}`
        )
      })
      window.app!.api.addEventListener('promptQueueing', () => {
        state.runRequests += 1
      })
    })
  }

  /** Enter chords that reached the page shortcuts since the last `clear()`. */
  entersAtPage(): Promise<string[]> {
    return this.page.evaluate(() => window.pageShortcutProbe!.entersAtPage)
  }

  runRequests(): Promise<number> {
    return this.page.evaluate(() => window.pageShortcutProbe!.runRequests)
  }

  async clear(): Promise<void> {
    await this.page.evaluate(() => {
      window.pageShortcutProbe!.entersAtPage = []
    })
  }
}

export const agentPageShortcutProbeFixture = base.extend<{
  pageShortcuts: PageShortcutProbe
}>({
  pageShortcuts: async ({ page }, use) => {
    await use(new PageShortcutProbe(page))
  }
})
