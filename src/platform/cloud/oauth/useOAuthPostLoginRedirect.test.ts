import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useOAuthPostLoginRedirect } from '@/platform/cloud/oauth/useOAuthPostLoginRedirect'

const VALID_REQUEST_ID = '550e8400-e29b-41d4-a716-446655440000'

const routerPush = vi.fn().mockResolvedValue(undefined)
const createSessionOrThrow = vi.fn().mockResolvedValue(undefined)

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: routerPush })
}))

vi.mock('@/platform/auth/session/useSessionCookie', () => ({
  useSessionCookie: () => ({ createSessionOrThrow })
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      key === 'oauth.consent.sessionError'
        ? 'Failed to establish session. Please try again.'
        : key
  })
}))

describe('useOAuthPostLoginRedirect', () => {
  beforeEach(() => {
    sessionStorage.clear()
    routerPush.mockClear()
    createSessionOrThrow.mockReset().mockResolvedValue(undefined)
  })

  it('returns no-oauth when neither query nor sessionStorage holds a request id', async () => {
    const { resumeOAuthIfNeeded } = useOAuthPostLoginRedirect()

    const result = await resumeOAuthIfNeeded({})

    expect(result).toEqual({ kind: 'no-oauth' })
    expect(createSessionOrThrow).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('establishes session and navigates to consent when oauth_request_id is in the query', async () => {
    const { resumeOAuthIfNeeded } = useOAuthPostLoginRedirect()

    const result = await resumeOAuthIfNeeded({
      oauth_request_id: VALID_REQUEST_ID
    })

    expect(createSessionOrThrow).toHaveBeenCalledOnce()
    expect(routerPush).toHaveBeenCalledWith({
      name: 'cloud-oauth-consent',
      query: { oauth_request_id: VALID_REQUEST_ID }
    })
    expect(result).toEqual({ kind: 'resumed' })
  })

  it('resumes using a stashed sessionStorage id when the query is empty (multi-step flows)', async () => {
    sessionStorage.setItem('Comfy.OAuthRequestId', VALID_REQUEST_ID)
    const { resumeOAuthIfNeeded } = useOAuthPostLoginRedirect()

    const result = await resumeOAuthIfNeeded({})

    expect(result).toEqual({ kind: 'resumed' })
    expect(routerPush).toHaveBeenCalledWith({
      name: 'cloud-oauth-consent',
      query: { oauth_request_id: VALID_REQUEST_ID }
    })
  })

  it('returns an error with the thrown message when session creation fails', async () => {
    createSessionOrThrow.mockRejectedValue(new Error('Unauthorized'))
    const { resumeOAuthIfNeeded } = useOAuthPostLoginRedirect()

    const result = await resumeOAuthIfNeeded({
      oauth_request_id: VALID_REQUEST_ID
    })

    expect(result).toEqual({ kind: 'error', message: 'Unauthorized' })
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('falls back to a generic message when session creation rejects with a non-Error value', async () => {
    createSessionOrThrow.mockRejectedValue('boom')
    const { resumeOAuthIfNeeded } = useOAuthPostLoginRedirect()

    const result = await resumeOAuthIfNeeded({
      oauth_request_id: VALID_REQUEST_ID
    })

    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.message).toMatch(/try again/i)
    }
    expect(routerPush).not.toHaveBeenCalled()
  })
})
