import type { Page } from '@playwright/test'

/**
 * Makes `window.localStorage` and `window.sessionStorage` throw a
 * `SecurityError` on every property read, for this page and every later
 * navigation in it. The thrown message is the one cloud-frontend-prod
 * reports — "Failed to read the 'localStorage' property from 'Window':
 * Access is denied for this document." — which a browser raises on the
 * property read itself, before any `getItem` call, when it denies storage to
 * the document (site data blocked, sandboxed or third-party iframe, some
 * webviews).
 *
 * Install this before the document that must survive the denial loads — an
 * init script runs ahead of page scripts, which is what reproduces the real
 * failure: the denial is already in force when the first module evaluates.
 * Fixture setup that seeds storage (`ComfyPage.setup`) has to run first, so
 * call this and then reload.
 */
export async function denyWebStorage(
  page: Page,
  properties: readonly StorageProperty[] = ['localStorage', 'sessionStorage']
): Promise<void> {
  await page.addInitScript((denied: readonly string[]) => {
    for (const property of denied) {
      Object.defineProperty(window, property, {
        configurable: true,
        get() {
          throw new DOMException(
            `Failed to read the '${property}' property from 'Window': Access is denied for this document.`,
            'SecurityError'
          )
        }
      })
    }
  }, properties)
}

type StorageProperty = 'localStorage' | 'sessionStorage'

/** True when every named storage property read throws, i.e. the denial is in force. */
export async function webStorageIsDenied(
  page: Page,
  properties: readonly StorageProperty[] = ['localStorage', 'sessionStorage']
): Promise<boolean> {
  return page.evaluate(
    (denied: readonly StorageProperty[]) =>
      denied.every((property) => {
        try {
          void window[property]
          return false
        } catch (error) {
          return error instanceof DOMException && error.name === 'SecurityError'
        }
      }),
    properties
  )
}
