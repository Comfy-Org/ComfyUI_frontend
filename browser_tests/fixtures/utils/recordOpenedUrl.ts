import type { Page } from '@playwright/test'

/**
 * Records each `window.open` destination on `<html data-opened-url>` instead
 * of opening a tab. The handle it returns records a later `location.href`
 * write the same way, so a tab reserved blank and navigated once its URL
 * arrives is recorded too, rather than steering this page off the app.
 */
export async function recordOpenedUrl(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const record = (url: string) => {
      document.documentElement.dataset.openedUrl = url
    }
    const standInTab = new Proxy(window, {
      get: (target, property) =>
        property === 'location'
          ? {
              get href() {
                return document.documentElement.dataset.openedUrl ?? ''
              },
              set href(destination: string) {
                record(destination)
              }
            }
          : Reflect.get(target, property),
      set: () => true
    })
    window.open = (url) => {
      if (url) record(String(url))
      return standInTab
    }
  })
}
