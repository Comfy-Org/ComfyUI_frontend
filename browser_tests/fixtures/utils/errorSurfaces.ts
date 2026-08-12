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

// What a non-empty surface actually says, so a red names the error instead
// of reporting a bare element count (the cloud gate's dominant failure class
// was 12x "at startup: errorToasts" with no text - run 31541231667). A read
// that races a boot navigation returns a sentinel rather than throwing, so
// the poll below keeps retrying exactly like toHaveCount(0) did - but a
// CLOSED target is not a race: rethrow immediately so the real reason
// surfaces in milliseconds instead of a full poll window ending in a
// sentinel that claims a surface is present on a page that is gone.
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
    return [`${surface} present but unreadable mid-poll: ${String(error)}`]
  }
}

// The suite's central invariant: a regression run is green only if every
// user-visible error surface is empty. Kept here (single source) so a new
// surface added above is enforced everywhere at once. Polling toEqual([])
// keeps toHaveCount(0)'s tolerance - a transient surface that clears within
// the expect timeout still passes - while a persistent one fails with its
// visible text as the last polled value.
export async function expectNoVisibleErrors(
  page: Page,
  context: string
): Promise<void> {
  for (const [surface, locator] of Object.entries(errorSurfaces(page)))
    await expect
      .poll(() => surfaceTexts(page, surface, locator), {
        message: `${context}: ${surface}`
      })
      .toEqual([])
}
