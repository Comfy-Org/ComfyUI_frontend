import type { Locator, Page } from '@playwright/test'

// The app's user-visible error surfaces. A regression run is green only if a
// human looking at the screen would see zero errors - not merely a clean
// console. The harness self-check asserts the overlay IS visible after a
// forced execution error, so these selectors are permanently proven live.
export function errorSurfaces(page: Page): Record<string, Locator> {
  return {
    errorOverlay: page.getByTestId('error-overlay'),
    errorDialog: page.getByTestId('error-dialog'),
    nodeRenderErrors: page.locator('.node-error'),
    errorToasts: page.locator('.p-toast-message-error')
  }
}
