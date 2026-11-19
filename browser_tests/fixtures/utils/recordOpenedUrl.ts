import type { Page } from '@playwright/test'

function installOpenRecorder() {
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
}

/** Records each `window.open` destination on `<html data-opened-url>` instead of opening a tab. */
export async function recordOpenedUrl(page: Page): Promise<void> {
  await page.addInitScript(installOpenRecorder)
}

export async function allowPopups(page: Page): Promise<void> {
  await page.evaluate(installOpenRecorder)
}
