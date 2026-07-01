import type { ConsoleMessage, Page } from '@playwright/test'

export function collectConsoleErrors(page: Page): {
  errors: string[]
  stop: () => void
} {
  const errors: string[] = []
  const listener = (message: ConsoleMessage) => {
    if (message.type() === 'error') errors.push(message.text())
  }
  page.on('console', listener)
  return { errors, stop: () => page.off('console', listener) }
}
