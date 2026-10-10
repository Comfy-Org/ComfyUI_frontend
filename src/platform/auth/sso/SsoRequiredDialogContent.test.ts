import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import SsoRequiredDialogContent from '@/platform/auth/sso/SsoRequiredDialogContent.vue'
import { trackSsoRequiredShown } from '@/platform/auth/sso/ssoTelemetry'
import { useTelemetry } from '@/platform/telemetry'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('firebase/auth'))
vi.mock(import('@/platform/telemetry'))

async function renderDialog(
  props: {
    email?: string
    returnTo?: string
    organizationId?: string
  },
  at = '/workflows?id=7'
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/workflows', component: { template: '<div />' } },
      { path: '/oauth/consent', component: { template: '<div />' } },
      {
        path: '/cloud/login',
        name: 'cloud-login',
        component: { template: '<div />' }
      }
    ]
  })
  await router.push(at)
  return render(SsoRequiredDialogContent, {
    props,
    global: {
      plugins: [router, createI18n({ legacy: false, locale: 'en' })]
    }
  })
}

const assigned = (assign: Mock<(url: string | URL) => void>) =>
  new URL(String(assign.mock.calls[0][0]), window.location.origin)

describe('SsoRequiredDialogContent', () => {
  let assign: Mock<(url: string | URL) => void>

  beforeEach(() => {
    vi.spyOn(useAuthStore(), 'logout').mockResolvedValue()
    assign = vi.fn<(url: string | URL) => void>()
    vi.spyOn(window.location, 'assign').mockImplementation(assign)
  })

  it('explains the refusal and starts SSO for the known email', async () => {
    await renderDialog({ email: 'ada@acme.com', returnTo: '/cloud/user-check' })

    expect(screen.getByText('auth.sso.required.title')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'auth.sso.continueWithSso' })
    )

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    const target = assigned(assign)
    expect(target.pathname).toBe('/api/auth/sso/start')
    expect(target.searchParams.get('email')).toBe('ada@acme.com')
    expect(target.searchParams.get('return_to')).toBe('/cloud/user-check')
    expect(target.searchParams.has('organization')).toBe(false)
    expect(useAuthStore().logout).not.toHaveBeenCalled()
  })

  it('reports the click as the shown attempt continuing to SSO', async () => {
    trackSsoRequiredShown('cloud_app', 'session_refused')
    await renderDialog({ email: 'ada@acme.com' })

    await userEvent.click(
      screen.getByRole('button', { name: 'auth.sso.continueWithSso' })
    )

    const [[shown], [continued]] = vi.mocked(useTelemetry()!.trackSsoEvent).mock
      .calls
    expect(continued).toEqual({
      name: 'app:sso_continue_clicked',
      properties: { surface: 'cloud_app', flow_id: shown.properties.flow_id }
    })
  })

  it.for<{ name: string; email?: string }>([
    { name: 'with the email as a hint', email: 'alice@comfy.org' },
    { name: 'when no email is known' }
  ])(
    "starts the named organization's SSO, not the email domain's, $name",
    async ({ email }) => {
      await renderDialog({ email, organizationId: 'org_meta', returnTo: '/x' })

      await userEvent.click(
        screen.getByRole('button', { name: 'auth.sso.continueWithSso' })
      )

      await waitFor(() => expect(assign).toHaveBeenCalledOnce())
      const target = assigned(assign)
      expect(target.pathname).toBe('/api/auth/sso/start')
      expect(target.searchParams.get('organization')).toBe('org_meta')
      expect(target.searchParams.get('email')).toBe(email ?? null)
      expect(target.searchParams.get('return_to')).toBe('/x')
    }
  )

  it('signs a still signed-in account out and returns to the current page', async () => {
    useAuthStore().currentUser = fromPartial<User>({ email: 'ada@acme.com' })
    await renderDialog({})

    await userEvent.click(
      screen.getByRole('button', { name: 'auth.sso.continueWithSso' })
    )

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(useAuthStore().logout).toHaveBeenCalledOnce()
    expect(assigned(assign).searchParams.get('return_to')).toBe(
      '/workflows?id=7'
    )
  })

  it('returns from the consent page to the consent path the server serves', async () => {
    await renderDialog(
      { email: 'ada@acme.com' },
      '/oauth/consent?oauth_request_id=req-1'
    )

    await userEvent.click(
      screen.getByRole('button', { name: 'auth.sso.continueWithSso' })
    )

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(assigned(assign).searchParams.get('return_to')).toBe(
      '/cloud/oauth/consent?oauth_request_id=req-1'
    )
  })

  it('lets the person retry when signing the account out fails', async () => {
    useAuthStore().currentUser = fromPartial<User>({ email: 'ada@acme.com' })
    vi.mocked(useAuthStore().logout)
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce()
    await renderDialog({})
    const continueButton = screen.getByRole('button', {
      name: 'auth.sso.continueWithSso'
    })

    await userEvent.click(continueButton)
    await waitFor(() => expect(continueButton).toBeEnabled())
    expect(assign).not.toHaveBeenCalled()

    await userEvent.click(continueButton)
    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    expect(useAuthStore().logout).toHaveBeenCalledTimes(2)
  })

  it('opens the login page on its SSO entry when no email is known', async () => {
    await renderDialog({})

    await userEvent.click(
      screen.getByRole('button', { name: 'auth.sso.continueWithSso' })
    )

    await waitFor(() => expect(assign).toHaveBeenCalledOnce())
    const target = assigned(assign)
    expect(target.pathname).toBe('/cloud/login')
    expect(target.searchParams.get('sso')).toBe('open')
  })
})
