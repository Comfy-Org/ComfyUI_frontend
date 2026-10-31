import type { ConsoleMessage, Page, TestInfo } from '@playwright/test'

import { REPORTED_ERROR_PREFIX } from '@comfyorg/shared-frontend-utils/telemetry'

import { CUSTOM_NODE_LOAD_ERROR_TYPE } from '@/platform/telemetry/customNodeLoadTelemetry'

const EXTENSION_LOAD_REPORT = `${REPORTED_ERROR_PREFIX}${CUSTOM_NODE_LOAD_ERROR_TYPE}`

const FAILED_EXTENSION_LINE_RE = /^Failed extension: (.+)$/gm

export function perExtensionLoadReports(report: string): string[] {
  const failures = [...report.matchAll(FAILED_EXTENSION_LINE_RE)].map(
    ([, failure]) => `${EXTENSION_LOAD_REPORT} ${failure}`
  )
  return failures.length > 0 ? failures : [report]
}

function collectedErrors(message: ConsoleMessage): string[] {
  const text = message.text()
  if (message.type() === 'warning' && text.startsWith(EXTENSION_LOAD_REPORT))
    return perExtensionLoadReports(text)
  if (message.type() !== 'error') return []
  const url = message.location().url
  return [url ? `${text} [${url}]` : text]
}

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
    errors.push(...collectedErrors(message))
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
