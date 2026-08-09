import type { ConsoleMessage, Page, TestInfo } from '@playwright/test'

type PageDiagnosticSanitizer = (
  value: string,
  channel: 'console.error' | 'pageerror' | 'diagnostic'
) => string

const pageDiagnosticSanitizers = new WeakMap<Page, PageDiagnosticSanitizer>()
const pageDiagnosticAttachmentSinks = new WeakMap<
  Page,
  (name: string, values: readonly string[]) => Promise<void>
>()

export function setPageDiagnosticSanitizer(
  page: Page,
  sanitizer: PageDiagnosticSanitizer
): void {
  pageDiagnosticSanitizers.set(page, sanitizer)
}

export function setPageDiagnosticAttachmentSink(
  page: Page,
  sink: (name: string, values: readonly string[]) => Promise<void>
): void {
  pageDiagnosticAttachmentSinks.set(page, sink)
}

export async function attachPageDiagnosticEvidence(
  page: Page,
  testInfo: Pick<TestInfo, 'attach'>,
  name: string,
  values: readonly string[]
): Promise<void> {
  const sink = pageDiagnosticAttachmentSinks.get(page)
  if (sink) return sink(name, [...values])
  await testInfo.attach(name, {
    body: JSON.stringify(
      values.map((value) => sanitizePageDiagnostic(page, value, 'diagnostic')),
      null,
      2
    ),
    contentType: 'application/json'
  })
}

function sanitizePageDiagnostic(
  page: Page,
  value: string,
  channel: 'console.error' | 'pageerror' | 'diagnostic'
): string {
  return pageDiagnosticSanitizers.get(page)?.(value, channel) ?? value
}

export function collectConsoleErrors(page: Page): {
  errors: string[]
  stop: () => void
} {
  const errors: {
    value: string
    channel: 'console.error' | 'pageerror'
  }[] = []
  const listener = (message: ConsoleMessage) => {
    if (message.type() !== 'error') return
    const url = message.location().url
    errors.push({
      value: url ? `${message.text()} [${url}]` : message.text(),
      channel: 'console.error'
    })
  }
  // Uncaught page exceptions and unhandled promise rejections never reach
  // console.error; Chromium surfaces both through pageerror. Without this
  // listener a pack script crashing outside a console call passes silently.
  const pageErrorListener = (error: Error) => {
    errors.push({
      value: `Uncaught page error: ${error.stack ?? error.message}`,
      channel: 'pageerror'
    })
  }
  page.on('console', listener)
  page.on('pageerror', pageErrorListener)
  return {
    get errors() {
      return errors.map(({ value }) => value)
    },
    stop: () => {
      page.off('console', listener)
      page.off('pageerror', pageErrorListener)
    }
  }
}
