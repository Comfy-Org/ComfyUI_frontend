import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

interface VisibleError {
  surface: string
  text: string
}

type VisibleErrorWindow = Window &
  typeof globalThis & {
    __cnVisibleErrors?: VisibleError[]
  }

const trackedPages = new WeakSet<Page>()

const visibleErrorSurfaceSelectors = [
  {
    surface: 'errorOverlay',
    selector: `[data-testid="${TestIds.dialogs.errorOverlay}"]`
  },
  {
    surface: 'errorDialog',
    selector: `[data-testid="${TestIds.dialogs.errorDialog}"]`
  },
  { surface: 'nodeRenderErrors', selector: '.node-error' },
  { surface: 'errorToasts', selector: '.p-toast-message-error' }
]

const visibleErrorSampleIntervalMs = 100

function installVisibleErrorRecorder(config: {
  selectors: typeof visibleErrorSurfaceSelectors
  sampleIntervalMs: number
}): void {
  const { selectors, sampleIntervalMs } = config
  const target = window as VisibleErrorWindow
  if (target.__cnVisibleErrors !== undefined) return
  const seen = new Set<string>()
  const errors: VisibleError[] = []
  const combinedSelector = selectors.map(({ selector }) => selector).join(',')
  target.__cnVisibleErrors = errors
  const sample = () => {
    for (const element of document.querySelectorAll(combinedSelector)) {
      if (
        !(element instanceof HTMLElement) ||
        !element.checkVisibility({
          checkOpacity: true,
          checkVisibilityCSS: true
        })
      )
        continue
      const text = (element.innerText || element.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300)
      for (const { surface, selector } of selectors) {
        if (!element.matches(selector)) continue
        const key = `${surface}\u0000${text}`
        if (seen.has(key)) continue
        seen.add(key)
        errors.push({ surface, text })
      }
    }
  }
  const sampleNext = () => {
    sample()
    window.setTimeout(sampleNext, sampleIntervalMs)
  }
  sample()
  window.setTimeout(sampleNext, sampleIntervalMs)
}

export async function trackVisibleErrors(page: Page): Promise<void> {
  if (trackedPages.has(page)) return
  const config = {
    selectors: visibleErrorSurfaceSelectors,
    sampleIntervalMs: visibleErrorSampleIntervalMs
  }
  await page.addInitScript(installVisibleErrorRecorder, config)
  await page.evaluate(installVisibleErrorRecorder, config)
  trackedPages.add(page)
}

// The app's user-visible error surfaces. A regression run is green only if a
// human looking at the screen would see zero errors - not merely a clean
// console. The harness self-check asserts the overlay IS visible after a
// forced execution error, so these selectors are permanently proven live.
export function errorSurfaces(page: Page): Record<string, Locator> {
  return {
    errorOverlay: page.getByTestId(TestIds.dialogs.errorOverlay),
    errorDialog: page.getByTestId(TestIds.dialogs.errorDialog),
    nodeRenderErrors: page.locator('.node-error'),
    errorToasts: page.locator('.p-toast-message-error')
  }
}

async function surfaceTexts(
  page: Page,
  surface: string,
  locator: Locator
): Promise<string[]> {
  try {
    return (await locator.allInnerTexts()).map((text) =>
      text.replace(/\s+/g, ' ').trim().slice(0, 300)
    )
  } catch (error) {
    if (page.isClosed() || /has been closed/.test(String(error))) throw error
    return [`${surface} present but unreadable: ${String(error)}`]
  }
}

// The suite's central invariant: a regression run is green only if every
// user-visible error surface is empty at the caller's readiness boundary.
export async function expectNoVisibleErrors(
  page: Page,
  context: string
): Promise<void> {
  expect(
    trackedPages.has(page),
    `${context}: visible-error recorder was not installed before navigation`
  ).toBe(true)
  const history = await page.evaluate(
    () => (window as VisibleErrorWindow).__cnVisibleErrors
  )
  expect(
    history,
    `${context}: visible-error recorder sentinel is missing`
  ).toBeDefined()
  expect(history, `${context}: transient visible errors`).toEqual([])
  for (const [surface, locator] of Object.entries(errorSurfaces(page)))
    expect(
      await surfaceTexts(page, surface, locator),
      `${context}: ${surface}`
    ).toEqual([])
}
