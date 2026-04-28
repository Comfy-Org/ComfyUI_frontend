/**
 * Submit a payload to HubSpot's Forms Submissions API v3.
 *
 * Uses the unauthenticated endpoint (CORS-enabled). The `/secure/submit/`
 * variant does NOT support CORS and must not be called from the browser.
 *
 * Field names must match the HubSpot form's internal property names
 * (e.g. `firstname`, not `firstName`). Submitting unknown fields fails with
 * `FIELD_NOT_IN_FORM_DEFINITION`.
 *
 * Docs: https://developers.hubspot.com/docs/api-reference/legacy/marketing/forms/v3-legacy/submit-data-unauthenticated
 */

export type HubspotRegion = 'na1' | 'eu1'

interface HubspotFormConfig {
  portalId: string
  formGuid: string
  region?: HubspotRegion
}

interface HubspotField {
  objectTypeId: string
  name: string
  value: string
}

interface HubspotFormContext {
  hutk?: string | null
  pageUri?: string
  pageName?: string
}

interface SubmitHubspotFormOptions {
  config: HubspotFormConfig
  fields: HubspotField[]
  context?: HubspotFormContext
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

interface HubspotFormError {
  message: string
  errorType: string
  in?: string
}

interface HubspotSubmissionResult {
  inlineMessage?: string
  redirectUri?: string
}

const DEFAULT_TIMEOUT_MS = 15_000

export class HubspotSubmissionError extends Error {
  readonly status: number
  readonly errors: HubspotFormError[]

  constructor(
    message: string,
    status: number,
    errors: HubspotFormError[] = []
  ) {
    super(message)
    this.name = 'HubspotSubmissionError'
    this.status = status
    this.errors = errors
  }
}

function getApiHost(region: HubspotRegion): string {
  return region === 'eu1' ? 'api-eu1.hsforms.com' : 'api.hsforms.com'
}

export function buildHubspotEndpoint(config: HubspotFormConfig): string {
  const host = getApiHost(config.region ?? 'na1')
  return `https://${host}/submissions/v3/integration/submit/${config.portalId}/${config.formGuid}`
}

export async function submitHubspotForm({
  config,
  fields,
  context,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS
}: SubmitHubspotFormOptions): Promise<HubspotSubmissionResult> {
  if (!config.portalId || !config.formGuid) {
    throw new Error(
      'HubSpot form submission is not configured (missing portalId or formGuid)'
    )
  }

  const url = buildHubspotEndpoint(config)
  const body = {
    submittedAt: Date.now(),
    fields: fields.filter((f) => f.value !== ''),
    ...(context && { context: stripUndefined(context) })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    })

    let parsed: unknown
    try {
      parsed = await response.json()
    } catch {
      parsed = undefined
    }

    if (!response.ok) {
      const errors = isHubspotErrorBody(parsed) ? parsed.errors : []
      throw new HubspotSubmissionError(
        `HubSpot submission failed with status ${response.status}`,
        response.status,
        errors
      )
    }

    return isHubspotSuccessBody(parsed) ? parsed : {}
  } finally {
    clearTimeout(timeoutId)
  }
}

export function readHubspotTrackingCookie(
  cookieString: string | undefined = typeof document === 'undefined'
    ? undefined
    : document.cookie
): string | null {
  if (!cookieString) return null
  const match = cookieString
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith('hubspotutk='))
  if (!match) return null
  const value = match.slice('hubspotutk='.length).trim()
  return value.length > 0 ? value : null
}

function stripUndefined<T extends object>(input: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) result[key] = value
  }
  return result as T
}

function isHubspotErrorBody(
  value: unknown
): value is { errors: HubspotFormError[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    Array.isArray((value as { errors?: unknown }).errors)
  )
}

function isHubspotSuccessBody(
  value: unknown
): value is HubspotSubmissionResult {
  return typeof value === 'object' && value !== null
}
