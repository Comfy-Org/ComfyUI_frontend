import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, test, vi } from 'vitest'

import {
  consumeSurveyReplayRequest,
  isSurveyReplayRequested,
  requestOnboardingReplay
} from '@/platform/onboarding/onboardingReplay'
import { api } from '@/scripts/api'

import { getSurveyCompletedStatus, submitSurvey } from './auth'

vi.mock(import('@/scripts/api'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

const fetchApi = vi.mocked(api.fetchApi)

vi.mock(import('@sentry/vue'), () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  // reportError() probes this; without it the probe throws, reportError
  // swallows it, and the report silently never happens.
  isEnabled: vi.fn(() => false)
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
  test('200 with non-empty value → true', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: { value: { q1: 'a' } } })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('200 with empty value → false (the only "not completed" signal)', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: { value: {} } })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
  })

  test('200 with null value → false', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: { value: null } })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
  })

  test('200 with missing value key → true (malformed response fails safe)', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: {} })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('404 → false (key never stored = genuinely not completed)', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      mockResponse({ ok: false, status: 404 })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
  })

  test('500 → true (do not bounce on transient backend error)', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500 })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  // 401/403/5xx stay under the "ambiguous => treat as completed" fail-safe;
  // 404 is the one non-ok we disambiguate, since it's the real not-completed
  // signal. The dedicated auth layer handles re-authentication on the next API
  // call; this function deliberately does not try to recover auth failures
  // itself. Locking with tests so the policy can't drift back to a "throw on
  // auth error" branch.
  test('401 → true (auth layer handles re-auth on next call)', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401 })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('403 → true (auth layer handles re-auth on next call)', async () => {
    vi.mocked(api.fetchApi).mockResolvedValueOnce(
      mockResponse({ ok: false, status: 403 })
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('network rejection → true (do not bounce on network error)', async () => {
    vi.mocked(api.fetchApi).mockRejectedValueOnce(
      new TypeError('Network request failed')
    )
    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })
})

describe('onboarding replay', () => {
  test('a requested replay re-opens the gate without reading the stored answers', async () => {
    requestOnboardingReplay()

    await expect(getSurveyCompletedStatus()).resolves.toBe(false)
    expect(fetchApi).not.toHaveBeenCalled()
  })

  test('a completed account is gated again as soon as the replay is spent', async () => {
    requestOnboardingReplay()
    await expect(getSurveyCompletedStatus()).resolves.toBe(false)

    consumeSurveyReplayRequest()
    fetchApi.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: { value: { q1: 'a' } } })
    )

    await expect(getSurveyCompletedStatus()).resolves.toBe(true)
  })

  test('preserves stored answers and spends their replay', async () => {
    fetchApi.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: { value: { q1: 'original' } }
      })
    )
    requestOnboardingReplay()

    await expect(submitSurvey({ q1: 'replayed' })).resolves.toEqual({
      status: 'preserved'
    })

    expect(
      fetchApi.mock.calls.every(
        ([, init]) => (init?.method ?? 'GET') === 'GET'
      ),
      'a replay may only read the survey key, never write it'
    ).toBe(true)
    expect(isSurveyReplayRequested()).toBe(false)
  })

  test.for([401, 403, 500] as const)(
    'keeps the replay and writes nothing when the stored answers read %s',
    async (status) => {
      fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status }))
      requestOnboardingReplay()

      await expect(submitSurvey({ q1: 'a' })).resolves.toMatchObject({
        status: 'failed',
        cause: expect.stringContaining('Could not read the stored survey')
      })

      expect(
        isSurveyReplayRequested(),
        'an unserved replay must survive so the survey can be retried'
      ).toBe(true)
      expect(
        fetchApi.mock.calls.every(
          ([, init]) => (init?.method ?? 'GET') === 'GET'
        ),
        'refusing to guess means refusing to write'
      ).toBe(true)
    }
  )

  test('keeps the replay and writes nothing when the stored answers cannot be read', async () => {
    fetchApi.mockRejectedValueOnce(new TypeError('Network request failed'))
    requestOnboardingReplay()

    await expect(submitSurvey({ q1: 'a' })).resolves.toMatchObject({
      status: 'failed'
    })

    expect(isSurveyReplayRequested()).toBe(true)
    expect(fetchApi).toHaveBeenCalledOnce()
  })

  test.for([{}, 1, [], { value: [] }, { value: 'invalid' }])(
    'keeps the replay and writes nothing for malformed settings data %#',
    async (body) => {
      fetchApi.mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body })
      )
      requestOnboardingReplay()

      await expect(submitSurvey({ q1: 'a' })).resolves.toMatchObject({
        status: 'failed'
      })

      expect(isSurveyReplayRequested()).toBe(true)
      expect(fetchApi).toHaveBeenCalledOnce()
    }
  )

  test('keeps the replay when settings JSON cannot be parsed', async () => {
    const response = mockResponse({ ok: true, status: 200 })
    vi.spyOn(response, 'json').mockRejectedValue(
      new SyntaxError('Invalid JSON')
    )
    fetchApi.mockResolvedValueOnce(response)
    requestOnboardingReplay()

    await expect(submitSurvey({ q1: 'a' })).resolves.toMatchObject({
      status: 'failed'
    })

    expect(isSurveyReplayRequested()).toBe(true)
    expect(fetchApi).toHaveBeenCalledOnce()
  })

  test('keeps the replay when the first-time write it fell through to fails', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 404 }))
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }))
    requestOnboardingReplay()

    await expect(submitSurvey({ q1: 'a' })).resolves.toMatchObject({
      status: 'failed'
    })

    expect(isSurveyReplayRequested()).toBe(true)
  })

  test('a replay with nothing stored keeps the pass, which is the account real first one', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 404 }))
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: true, status: 200 }))
    requestOnboardingReplay()

    await expect(submitSurvey({ q1: 'a' })).resolves.toEqual({
      status: 'stored'
    })

    expect(fetchApi).toHaveBeenCalledWith(
      '/settings',
      expect.objectContaining({
        body: JSON.stringify({ onboarding_survey: { q1: 'a' } })
      })
    )
    expect(isSurveyReplayRequested()).toBe(false)
  })

  test('submitting without a replay stores the answers as usual', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: true, status: 200 }))

    await expect(submitSurvey({ q1: 'a' })).resolves.toEqual({
      status: 'stored'
    })

    expect(fetchApi).toHaveBeenCalledWith(
      '/settings',
      expect.objectContaining({
        body: JSON.stringify({ onboarding_survey: { q1: 'a' } })
      })
    )
  })

  test('a failed first-time submission reports failure to the caller', async () => {
    fetchApi.mockResolvedValueOnce(mockResponse({ ok: false, status: 500 }))

    await expect(submitSurvey({ q1: 'a' })).resolves.toMatchObject({
      status: 'failed'
    })
  })
})
