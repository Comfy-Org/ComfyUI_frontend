import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
})

function mountRedirect() {
  let api: ReturnType<typeof useOAuthPostLoginRedirect> | undefined

  const Child = defineComponent({
    setup() {
      api = useOAuthPostLoginRedirect()
      return () => null
    }
  })

  const host = document.createElement('div')
  const app = createApp(defineComponent({ setup: () => () => h(Child) }))
  app.use(i18n)
  app.mount(host)

  if (!api) throw new Error('useOAuthPostLoginRedirect was not initialized')
  return { api, unmount: () => app.unmount() }
}

describe('useOAuthPostLoginRedirect', () => {
  beforeEach(() => {
    sessionStorage.clear()
    routerPush.mockClear()
    createSessionOrThrow.mockReset().mockResolvedValue(undefined)
  })

  it('returns no-oauth when neither query nor sessionStorage holds a request id', async () => {
    const { api } = mountRedirect()

    const result = await api.resumeOAuthIfNeeded({})

    expect(result).toEqual({ kind: 'no-oauth' })
    expect(createSessionOrThrow).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('establishes session and navigates to consent when oauth_request_id is in the query', async () => {
    const { api } = mountRedirect()

    const result = await api.resumeOAuthIfNeeded({
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
    const { api } = mountRedirect()

    const result = await api.resumeOAuthIfNeeded({})

    expect(result).toEqual({ kind: 'resumed' })
    expect(routerPush).toHaveBeenCalledWith({
      name: 'cloud-oauth-consent',
      query: { oauth_request_id: VALID_REQUEST_ID }
    })
  })

  it('returns an error with the thrown message when session creation fails', async () => {
    createSessionOrThrow.mockRejectedValue(new Error('Unauthorized'))
    const { api } = mountRedirect()

    const result = await api.resumeOAuthIfNeeded({
      oauth_request_id: VALID_REQUEST_ID
    })

    expect(result).toEqual({ kind: 'error', message: 'Unauthorized' })
    expect(routerPush).not.toHaveBeenCalled()
  })

  it('falls back to the i18n key when session creation rejects with a non-Error value', async () => {
    createSessionOrThrow.mockRejectedValue('boom')
    const { api } = mountRedirect()

    const result = await api.resumeOAuthIfNeeded({
      oauth_request_id: VALID_REQUEST_ID
    })

    // Empty messages → useI18n returns the key itself, which is what we
    // assert on (per docs/testing/vitest-patterns.md).
    expect(result).toEqual({
      kind: 'error',
      message: 'oauth.consent.sessionError'
    })
    expect(routerPush).not.toHaveBeenCalled()
  })
})
