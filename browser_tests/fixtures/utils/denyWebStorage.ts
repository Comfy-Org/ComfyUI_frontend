import type { Page } from '@playwright/test'

/** Makes the named storage property reads throw `SecurityError` from the next navigation on. */
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
