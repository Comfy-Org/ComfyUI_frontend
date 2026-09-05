import type { ConsoleMessage, Page, TestInfo } from '@playwright/test'

const startupErrors = new WeakMap<Page, readonly string[]>()

export function recordStartupConsoleErrors(
  page: Page,
  errors: readonly string[]
): void {
  startupErrors.set(page, [...errors])
}

export function startupConsoleErrors(page: Page): readonly string[] {
  return startupErrors.get(page) ?? []
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
  stop: () => void
  [Symbol.dispose]: () => void
} {
  const errors: string[] = []
  const listener = (message: ConsoleMessage) => {
    if (message.type() !== 'error') return
    const url = message.location().url
    errors.push(url ? `${message.text()} [${url}]` : message.text())
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
    stop,
    [Symbol.dispose]: stop
  }
}
