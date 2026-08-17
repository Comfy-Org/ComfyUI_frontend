import type { Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { TestIds } from '@e2e/fixtures/selectors'

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
  for (const [surface, locator] of Object.entries(errorSurfaces(page)))
    expect(
      await surfaceTexts(page, surface, locator),
      `${context}: ${surface}`
    ).toEqual([])
}
