import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useDialogService } from '@/services/dialogService'

import UserPanel from './UserPanel.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/services/dialogService'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const Empty = defineComponent({ render: () => null })

async function renderPanel() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: Empty },
      { path: '/cloud/login', name: 'cloud-login', component: Empty }
    ]
  })
  await router.push('/?tab=assets')
  render(UserPanel, {
    global: { plugins: [i18n, router], directives: { tooltip: {} } }
  })
}

function signInAsEmailUser({
  hasFirebaseLogin
}: {
  hasFirebaseLogin: boolean
}) {
  Object.assign(useCurrentUser(), {
    isLoggedIn: computed(() => true),
    isEmailProvider: computed(() => true),
    needsFirebaseSignIn: computed(() => !hasFirebaseLogin)
  })
}

describe('UserPanel update password', () => {
  beforeEach(() => {
    vi.stubGlobal('location', { assign: vi.fn() })
  })

  it('opens the update password dialog for a Firebase login', async () => {
    signInAsEmailUser({ hasFirebaseLogin: true })
    await renderPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update Password' })
    )

    expect(useDialogService().showUpdatePasswordDialog).toHaveBeenCalledOnce()
    expect(useDialogService().confirm).not.toHaveBeenCalled()
    expect(location.assign).not.toHaveBeenCalled()
  })

  it('asks a session-only tab to sign in again instead of opening the dialog', async () => {
    signInAsEmailUser({ hasFirebaseLogin: false })
    vi.mocked(useDialogService().confirm).mockResolvedValue(true)
    await renderPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update Password' })
    )

    expect(useDialogService().confirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Re-authentication Required',
        message: enMessages.auth.reauthRequired.message
      })
    )
    expect(useDialogService().showUpdatePasswordDialog).not.toHaveBeenCalled()
    expect(location.assign).toHaveBeenCalledWith(
      '/cloud/login?switchAccount=true&previousFullPath=%252F%253Ftab%253Dassets'
    )
  })

  it('stays put when a session-only tab declines to sign in again', async () => {
    signInAsEmailUser({ hasFirebaseLogin: false })
    vi.mocked(useDialogService().confirm).mockResolvedValue(false)
    await renderPanel()

    await userEvent.click(
      screen.getByRole('button', { name: 'Update Password' })
    )

    expect(useDialogService().showUpdatePasswordDialog).not.toHaveBeenCalled()
    expect(location.assign).not.toHaveBeenCalled()
  })
})
