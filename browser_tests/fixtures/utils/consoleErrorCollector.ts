import type { ConsoleMessage, Page } from '@playwright/test'

export function collectConsoleErrors(page: Page): {
  errors: string[]
  stop: () => void
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
    errors.push(`Uncaught page error: ${error.message}`)
  }
  page.on('console', listener)
  page.on('pageerror', pageErrorListener)
  return {
    errors,
    stop: () => {
      page.off('console', listener)
      page.off('pageerror', pageErrorListener)
    }
  }
}
