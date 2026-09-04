import type { ConsoleMessage, Page, TestInfo } from '@playwright/test'

const startupErrors = new WeakMap<Page, readonly string[]>()
const startupWarnings = new WeakMap<Page, readonly string[]>()

export function recordStartupConsoleErrors(
  page: Page,
  errors: readonly string[]
): void {
  startupErrors.set(page, [...errors])
}

export function startupConsoleErrors(page: Page): readonly string[] {
  return startupErrors.get(page) ?? []
}

export function recordStartupConsoleWarnings(
  page: Page,
  warnings: readonly string[]
): void {
  startupWarnings.set(page, [...warnings])
}

export function startupConsoleWarnings(page: Page): readonly string[] {
  return startupWarnings.get(page) ?? []
}

export async function attachPageDiagnosticEvidence(
  testInfo: Pick<TestInfo, 'attach'>,
  name: string,
  values: readonly string[]
): Promise<void> {
  await testInfo.attach(name, {
    body: JSON.stringify(values, null, 2),
    contentType: 'application/json'
  })
}

export function collectConsoleErrors(page: Page): {
  errors: string[]
  warnings: string[]
  stop: () => void
  [Symbol.dispose]: () => void
} {
  const errors: string[] = []
  // Extension-origin load failures log as warnings; the ledger still requires
  // observing them, so they are kept in a separate stream.
  const warnings: string[] = []
  const listener = (message: ConsoleMessage) => {
    const type = message.type()
    if (type !== 'error' && type !== 'warning') return
    const url = message.location().url
    const text = url ? `${message.text()} [${url}]` : message.text()
    if (type === 'error') errors.push(text)
    else warnings.push(text)
  }
  // Uncaught page exceptions and unhandled promise rejections never reach
  // console.error; Chromium surfaces both through pageerror. Without this
  // listener a pack script crashing outside a console call passes silently.
  const pageErrorListener = (error: Error) => {
    errors.push(`Uncaught page error: ${error.stack ?? error.message}`)
  }
  page.on('console', listener)
  page.on('pageerror', pageErrorListener)
  const stop = () => {
    page.off('console', listener)
    page.off('pageerror', pageErrorListener)
  }
  return {
    get errors() {
      return errors
    },
    get warnings() {
      return warnings
    },
    stop,
    [Symbol.dispose]: stop
  }
}
