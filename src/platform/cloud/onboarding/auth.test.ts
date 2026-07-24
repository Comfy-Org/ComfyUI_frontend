import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { getSurveyCompletedStatus } from './auth'

const fetchApi = vi.fn()

vi.mock('@/scripts/api', () => ({
  api: {
    fetchApi: (...args: unknown[]) => fetchApi(...args)
  }
}))

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn()
}))

function mockResponse({
  ok,
  status,
  body
}: {
  ok: boolean
  status: number
  body?: unknown
}): Response {
  return fromPartial<Response>({
    ok,
    status,
    statusText: '',
    json: async () => body
  })
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

  test('200 with empty value → false (the only "not completed" signal)', async () => {
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

  test('200 with missing value key → false', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: {} })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
  })

  test('404 → false (key never stored = genuinely not completed)', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 404 }))
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
  })

  test('500 → true (do not bounce on transient backend error)', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  // 401/403/5xx stay under the "ambiguous => treat as completed" fail-safe;
  // 404 is the one non-ok we disambiguate, since it's the real not-completed
  // signal. The dedicated auth layer handles re-authentication on the next API
  // call; this function deliberately does not try to recover auth failures
  // itself. Locking with tests so the policy can't drift back to a "throw on
  // auth error" branch.
  test('401 → true (auth layer handles re-auth on next call)', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 401 }))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('403 → true (auth layer handles re-auth on next call)', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 403 }))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('network rejection → true (do not bounce on network error)', async () => {
    fetchApi.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })
})
