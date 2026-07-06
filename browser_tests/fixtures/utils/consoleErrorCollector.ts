import type { ConsoleMessage, Page } from '@playwright/test'

export function collectConsoleErrors(page: Page): {
  errors: string[]
  stop: () => void
} {
  const errors: string[] = []
  const listener = (message: ConsoleMessage) => {
    if (message.type() !== 'error') return
    // Resource errors ("Failed to load resource: 404") are useless without
    // the URL, which lives in the message location, not the text.
    const url = message.location().url
    errors.push(url ? `${message.text()} [${url}]` : message.text())
  }
  page.on('console', listener)
  return { errors, stop: () => page.off('console', listener) }
}
