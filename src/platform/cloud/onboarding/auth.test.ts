import { beforeEach, describe, expect, test, vi } from 'vitest'

import { SurveyAuthError, getSurveyCompletedStatus } from './auth'

const fetchApi = vi.fn()

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (...args: unknown[]) => fetchApi(...args)
  }
}))

// `@sentry/vue` is still imported by other functions in auth.ts
// (getUserCloudStatus, submitSurvey). Mock it so test runs don't init the
// real SDK.
vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn()
}))

function mockResponse({
  ok,
  status,
  statusText = '',
  body
}: {
  ok: boolean
  status: number
  statusText?: string
  body?: unknown
}): Response {
  return {
    ok,
    status,
    statusText,
    json: async () => body
  } as unknown as Response
}

describe('getSurveyCompletedStatus', () => {
  beforeEach(() => {
    fetchApi.mockReset()
  })

  test('200 with non-empty value → true', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: { value: { q1: 'a' } } })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('200 with empty object value → false', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: { value: {} } })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
  })

  test('200 with null value → false', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: { value: null } })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
  })

  test('404 → true (treated as completed to avoid false-positive bounce)', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 404, statusText: 'Not Found' })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('401 → throws SurveyAuthError with status', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    )
    await expect(getSurveyCompletedStatus()).rejects.toBeInstanceOf(
      SurveyAuthError
    )
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    )
    await expect(getSurveyCompletedStatus()).rejects.toMatchObject({
      status: 401
    })
  })

  test('403 → throws SurveyAuthError with status', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    )
    await expect(getSurveyCompletedStatus()).rejects.toBeInstanceOf(
      SurveyAuthError
    )
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 403, statusText: 'Forbidden' })
    )
    await expect(getSurveyCompletedStatus()).rejects.toMatchObject({
      status: 403
    })
  })

  test('500 → true (transient backend hiccup, do not bounce)', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('503 → true (transient backend hiccup, do not bounce)', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('network/fetch rejection → true (do not bounce)', async () => {
    fetchApi.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('SurveyAuthError thrown by inner branch propagates through outer catch', async () => {
    // Sanity check: the catch block must re-throw SurveyAuthError instead
    // of swallowing it as "ambiguous" — that's the regression the typed
    // error class is meant to prevent.
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, statusText: 'Unauthorized' })
    )
    await expect(getSurveyCompletedStatus()).rejects.toBeInstanceOf(
      SurveyAuthError
    )
  })
})

describe('SurveyAuthError', () => {
  test('is an Error instance', () => {
    const err = new SurveyAuthError(401, 'Unauthorized')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(SurveyAuthError)
  })

  test('carries status and a descriptive message', () => {
    const err = new SurveyAuthError(403, 'Forbidden')
    expect(err.status).toBe(403)
    expect(err.message).toContain('403')
    expect(err.message).toContain('Forbidden')
    expect(err.name).toBe('SurveyAuthError')
  })
})
