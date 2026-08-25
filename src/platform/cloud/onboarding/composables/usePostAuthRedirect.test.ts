import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { usePostAuthRedirect } from '@/platform/cloud/onboarding/composables/usePostAuthRedirect'

const query = vi.hoisted(() => ({ value: {} as Record<string, string> }))
const replace = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRouter: () => ({ replace, push }),
  useRoute: () => ({ query: query.value })
}))

const resumeOAuthIfNeeded = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ kind: 'no-oauth' })
)
vi.mock('@/platform/cloud/oauth/useOAuthPostLoginRedirect', () => ({
  useOAuthPostLoginRedirect: () => ({ resumeOAuthIfNeeded })
}))

const toasts = vi.hoisted(() => ({ add: vi.fn() }))
vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => toasts
}))

const DEFAULT_REDIRECT = { name: 'cloud-user-check' }

function setup() {
  const authError = ref('')
  let onAuthSuccess: (() => Promise<void>) | undefined

  const app = createApp(
    defineComponent({
      setup() {
        ;({ onAuthSuccess } = usePostAuthRedirect({
          authError,
          successSummary: 'Login Completed',
          defaultRedirect: () => DEFAULT_REDIRECT
        }))
        return () => null
      }
    })
  )
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en: {} } }))
  app.mount(document.createElement('div'))

  if (!onAuthSuccess) throw new Error('post-auth redirect not initialized')

  return { authError, onAuthSuccess, unmount: () => app.unmount() }
}

beforeEach(() => {
  query.value = {}
  resumeOAuthIfNeeded.mockResolvedValue({ kind: 'no-oauth' })
})

describe('usePostAuthRedirect', () => {
  it('sends a plain sign-in to the default destination', async () => {
    const { onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(push).toHaveBeenCalledWith(DEFAULT_REDIRECT)
    expect(replace).not.toHaveBeenCalled()
  })

  it('confirms the sign-in with a success toast', async () => {
    const { onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(toasts.add).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'success',
        summary: 'Login Completed'
      })
    )
  })

  it('returns a deep-linked user to where they were headed', async () => {
    query.value = { previousFullPath: encodeURIComponent('/some/path?x=1') }
    const { onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(
      replace,
      'push would leave the login page in the back stack, where Back bounces the signed-in user into the guard again'
    ).toHaveBeenCalledWith('/some/path?x=1')
    expect(push).not.toHaveBeenCalled()
  })

  it('ignores an off-site previousFullPath and uses the default', async () => {
    query.value = { previousFullPath: encodeURIComponent('https://evil.com') }
    const { onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(replace).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith(DEFAULT_REDIRECT)
  })

  it('lets an OAuth resume outrank a deep link', async () => {
    query.value = { previousFullPath: encodeURIComponent('/some/path') }
    resumeOAuthIfNeeded.mockResolvedValue({ kind: 'resumed' })
    const { onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(
      replace,
      'the OAuth handshake owns the navigation, otherwise the client app that started it never gets its consent screen'
    ).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('surfaces an OAuth resume failure and navigates nowhere', async () => {
    query.value = { previousFullPath: encodeURIComponent('/some/path') }
    resumeOAuthIfNeeded.mockResolvedValue({
      kind: 'error',
      message: 'Session expired'
    })
    const { authError, onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(authError.value).toBe('Session expired')
    expect(replace).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('also toasts an OAuth resume failure, for social sign-in', async () => {
    resumeOAuthIfNeeded.mockResolvedValue({
      kind: 'error',
      message: 'Session expired'
    })
    const { onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(
      toasts.add,
      'authError only renders in email-form mode, so a Google/GitHub user would see the failure nowhere at all'
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: 'error',
        summary: 'oauth.consent.sessionErrorToastSummary',
        detail: 'Session expired'
      })
    )
  })

  it('passes the live query to the OAuth resume check', async () => {
    query.value = { oauth_request_id: 'abc' }
    const { onAuthSuccess } = setup()

    await onAuthSuccess()

    expect(resumeOAuthIfNeeded).toHaveBeenCalledWith({
      oauth_request_id: 'abc'
    })
  })
})
