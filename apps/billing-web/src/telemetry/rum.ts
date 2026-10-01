export interface BillingWebRumOptions {
  readonly hostname: string | undefined
  readonly version: string
}

/** The fields of a RUM event this origin rewrites before it leaves the page. */
export interface ScrubbableRumEvent {
  type: string
  view: { url: string; referrer?: string }
  resource?: { url: string }
  error?: {
    message: string
    stack?: string
    source?: string
    resource?: { url: string }
  }
  action?: { target?: { name: string } }
}

export interface ReportBillingWebErrorOptions {
  readonly errorType: string
  readonly context?: Readonly<Record<string, string | number | boolean>>
}

export function initBillingWebRum(_options: BillingWebRumOptions): void {}

export function billingWebRumBeforeSend(_event: ScrubbableRumEvent): boolean {
  return true
}

export function reportBillingWebError(
  _cause: unknown,
  _options: ReportBillingWebErrorOptions
): void {}
