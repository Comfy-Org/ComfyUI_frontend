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
  return {
    ok,
    status,
    statusText: '',
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

  test('404 → true (do not bounce on missing key)', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 404 }))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('500 → true (do not bounce on transient backend error)', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('network rejection → true (do not bounce on network error)', async () => {
    fetchApi.mockRejectedValueOnce(new TypeError('Network request failed'))
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })
})
