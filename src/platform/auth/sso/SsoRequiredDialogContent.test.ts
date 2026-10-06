import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import type { User } from 'firebase/auth'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import SsoRequiredDialogContent from '@/platform/auth/sso/SsoRequiredDialogContent.vue'
import { useAuthStore } from '@/stores/authStore'

vi.mock(import('firebase/auth'))

async function renderDialog(props: { email?: string; returnTo?: string }) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/workflows', component: { template: '<div />' } },
      {
        path: '/cloud/login',
        name: 'cloud-login',
        component: { template: '<div />' }
      }
    ]
  })
  await router.push('/workflows?id=7')
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
    expect(useAuthStore().logout).not.toHaveBeenCalled()
  })

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
