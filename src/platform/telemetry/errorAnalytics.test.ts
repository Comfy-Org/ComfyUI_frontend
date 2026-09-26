import { beforeEach, describe, expect, it } from 'vitest'

import {
  MAX_COUNTED_PER_ERROR_TYPE,
  classifyFailureKind,
  clientErrorReportedMetadata,
  httpStatusOf,
  resetReportedErrorCounts
} from '@/platform/telemetry/errorAnalytics'
import { ERROR_FAILURE_KINDS } from '@/platform/telemetry/types'

const COUNTED = 'agent_consent_setting_load_failure'

/**
 * The six failure shapes `agent_consent_setting_load_failure` actually took in
 * production between 2026-09-23 and 2026-09-26, with their counts, read from
 * Sentry (`error.type` + `error.value`, org `comfy-org`, all 23 on
 * `cloud.comfy.org`). Constructed the way the app constructs them, so the
 * classification below is what those 23 reports would have counted as.
 */
class GlobalSettingsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly failureKind?: string
  ) {
    super(message)
    this.name = 'GlobalSettingsApiError'
  }
}

class AgentConsentAuthenticationError extends Error {
  override name = 'AgentConsentAuthenticationError'
}

const PRODUCTION_SHAPES = [
  {
    // The status these seven carried is NOT in Sentry — `captureException`
    // received no `extra`, so the error's own `status` never left the client.
    // The response was readable enough to have a status and unreadable enough
    // to fail `response.json()`, which on this route means a 2xx or the 404 the
    // caller inspects. Which of the two is exactly what `http_status` answers
    // once this ships; both classify the same way, asserted below.
    events: 7,
    error: new GlobalSettingsApiError(
      'Global setting returned invalid JSON',
      404,
      'malformed_response'
    ),
    kind: 'malformed_response',
    status: 404
  },
  {
    events: 0,
    error: new GlobalSettingsApiError(
      'Global setting returned invalid JSON',
      200,
      'malformed_response'
    ),
    kind: 'malformed_response',
    status: 200
  },
  {
    events: 6,
    error: new AgentConsentAuthenticationError(
      'Comfy account authentication is required'
    ),
    kind: 'auth_missing',
    status: undefined
  },
  {
    events: 4,
    error: new GlobalSettingsApiError(
      'Global setting request failed: 401',
      401
    ),
    kind: 'auth_rejected',
    status: 401
  },
  {
    events: 3,
    error: new TypeError('NetworkError when attempting to fetch resource.'),
    kind: 'network_unreachable',
    status: undefined
  },
  {
    events: 2,
    error: new TypeError('Failed to fetch'),
    kind: 'network_unreachable',
    status: undefined
  },
  {
    events: 1,
    error: new GlobalSettingsApiError(
      'Global setting request failed: 500',
      500
    ),
    kind: 'server_error',
    status: 500
  }
] as const

describe('classifyFailureKind', () => {
  it.for(PRODUCTION_SHAPES)(
    'classifies the $events production reports shaped like "$error.message" as $kind',
    ({ error, kind, status }) => {
      expect(classifyFailureKind(error)).toBe(kind)
      expect(httpStatusOf(error)).toBe(status)
    }
  )

  it('leaves every production shape classified', () => {
    const unclassified = PRODUCTION_SHAPES.filter(
      ({ error }) => classifyFailureKind(error) === 'unclassified'
    )
    expect(unclassified).toEqual([])
  })

  it('prefers a declared kind over the status the same error carries', () => {
    // A 404 whose body could not be parsed is a parse failure that happens to
    // be a 404, not a plain rejection — and `http_status` still reports the 404.
    const error = new GlobalSettingsApiError(
      'Global setting returned invalid JSON',
      404,
      'malformed_response'
    )
    expect(classifyFailureKind(error)).toBe('malformed_response')
    expect(classifyFailureKind(new GlobalSettingsApiError('nope', 404))).toBe(
      'request_rejected'
    )
  })

  it('ignores a declared kind that is not in the closed set', () => {
    const error = Object.assign(new Error('boom'), {
      failureKind: 'user@example.com'
    })
    expect(ERROR_FAILURE_KINDS).not.toContain('user@example.com')
    expect(classifyFailureKind(error)).toBe('unclassified')
  })

  it('maps statuses to kinds without consulting the message', () => {
    const at = (status: number) =>
      classifyFailureKind(Object.assign(new Error(''), { status }))
    expect(at(403)).toBe('auth_rejected')
    expect(at(404)).toBe('request_rejected')
    expect(at(408)).toBe('timeout')
    expect(at(504)).toBe('timeout')
    expect(at(503)).toBe('server_error')
    expect(at(204)).toBe('unclassified')
  })

  it('classifies a deadline abort as a timeout', () => {
    const error = new Error('signal timed out')
    error.name = 'TimeoutError'
    expect(classifyFailureKind(error)).toBe('timeout')
  })

  it('falls back to unclassified rather than guessing', () => {
    // A TypeError that is not one of the engines' fetch-failure strings is a
    // programming error, and calling it a network failure would be a guess.
    expect(classifyFailureKind(new TypeError('x is not a function'))).toBe(
      'unclassified'
    )
    expect(classifyFailureKind(new Error('boom'))).toBe('unclassified')
    expect(classifyFailureKind('just a string')).toBe('unclassified')
    expect(classifyFailureKind(null)).toBe('unclassified')
    expect(classifyFailureKind(undefined)).toBe('unclassified')
  })

  it('only ever returns a value from the closed set', () => {
    const inputs: unknown[] = [
      ...PRODUCTION_SHAPES.map(({ error }) => error),
      { status: 'four-oh-four' },
      { status: 99 },
      { statusCode: 500 },
      Object.assign(new Error('x'), { status: 1.5 }),
      42
    ]
    for (const input of inputs) {
      expect(ERROR_FAILURE_KINDS).toContain(classifyFailureKind(input))
    }
  })
})

describe('httpStatusOf', () => {
  it('accepts an integer status in the range the protocol defines', () => {
    expect(httpStatusOf({ status: 500 })).toBe(500)
    expect(httpStatusOf({ statusCode: 429 })).toBe(429)
  })

  it('refuses anything that is not such an integer', () => {
    expect(httpStatusOf({ status: '401' })).toBeUndefined()
    expect(httpStatusOf({ status: 1.5 })).toBeUndefined()
    expect(httpStatusOf({ status: 99 })).toBeUndefined()
    expect(httpStatusOf({ status: 600 })).toBeUndefined()
    expect(httpStatusOf(new Error('boom'))).toBeUndefined()
    expect(httpStatusOf(null)).toBeUndefined()
  })
})

describe('clientErrorReportedMetadata', () => {
  beforeEach(resetReportedErrorCounts)

  it('counts an allowlisted slug', () => {
    expect(
      clientErrorReportedMetadata(
        new GlobalSettingsApiError('Global setting request failed: 401', 401),
        COUNTED
      )
    ).toEqual({
      error_type: COUNTED,
      failure_kind: 'auth_rejected',
      level: 'error',
      http_status: 401
    })
  })

  it('sends nothing for a slug that is not allowlisted', () => {
    // 378,042 of these fired in three days, from 13 people.
    expect(
      clientErrorReportedMetadata(
        new Error('Graph serialization state mismatch'),
        'graph_serialization_state_mismatch'
      )
    ).toBeUndefined()
    expect(
      clientErrorReportedMetadata(new Error('boom'), 'vite_preload_error')
    ).toBeUndefined()
  })

  it('carries no message, stack, cause, tag or context, whatever the error holds', () => {
    const error = Object.assign(
      new Error('save failed for cbyrne@comfy.org in workspace "Acme Prod"', {
        cause: new Error('https://cloud.comfy.org/api/global-settings/agent')
      }),
      { status: 500, prompt: 'a photo of my passport' }
    )

    const metadata = clientErrorReportedMetadata(
      error,
      'agent_consent_setting_write_failure',
      'warning'
    )

    expect(metadata).toEqual({
      error_type: 'agent_consent_setting_write_failure',
      failure_kind: 'server_error',
      level: 'warning',
      http_status: 500
    })
    const serialised = JSON.stringify(metadata)
    for (const secret of [
      'cbyrne@comfy.org',
      'Acme Prod',
      'cloud.comfy.org',
      'passport',
      'save failed'
    ]) {
      expect(serialised).not.toContain(secret)
    }
    expect(serialised).not.toContain(String(error.stack).split('\n')[1] ?? '@')
  })

  it('omits http_status entirely when the error carried none', () => {
    const metadata = clientErrorReportedMetadata(
      new AgentConsentAuthenticationError(
        'Comfy account authentication is required'
      ),
      COUNTED
    )
    expect(metadata).not.toHaveProperty('http_status')
    expect(metadata?.failure_kind).toBe('auth_missing')
  })

  it('stops counting one slug past the per-page-load cap, and no other', () => {
    for (let i = 0; i < MAX_COUNTED_PER_ERROR_TYPE; i++) {
      expect(
        clientErrorReportedMetadata(new Error('boom'), COUNTED)
      ).toBeDefined()
    }
    expect(
      clientErrorReportedMetadata(new Error('boom'), COUNTED)
    ).toBeUndefined()
    expect(
      clientErrorReportedMetadata(
        new Error('boom'),
        'agent_consent_auto_offer_failure'
      )
    ).toBeDefined()
  })

  it('counts the three-day production window well inside the cap', () => {
    // 23 reports from at least 9 people, and the busiest person produced 5
    // across three days and many page loads. The cap is not binding on it.
    const busiestPersonReports = 5
    expect(busiestPersonReports).toBeLessThan(MAX_COUNTED_PER_ERROR_TYPE)
  })
})
