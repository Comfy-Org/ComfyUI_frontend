import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { FirebaseIdentity } from '@comfyorg/account-core/firebase'
import type { WebSessionCommandResult } from '@comfyorg/account-core/webSession'
import type { WebSessionIdentityState } from '@comfyorg/account-core/webSessionIdentity'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useCloudWebSessionStore } from '@/platform/auth/session/cloudWebSessionStore'
import { useToastStore } from '@/platform/updates/common/toastStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/workflowStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { api } from '@/scripts/api'
import { useDialogService } from '@/services/dialogService'
import { useAuthStore } from '@/stores/authStore'

import UserPanel from './UserPanel.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/services/dialogService'))
vi.mock(import('@/platform/distribution/types'), () => ({
  DISTRIBUTION: 'cloud' as const,
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))
vi.mock(import('@/platform/auth/firebaseIdentity'), () => ({
  firebaseIdentity: fromPartial<FirebaseIdentity>({
    onUserChanged: () => () => {},
    onTokenChanged: () => () => {},
    currentUser: () => null
  })
}))

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

describe('UserPanel sign out of all devices', () => {
  const signOutEverywhere = { name: 'Sign out of all devices' }

  beforeEach(() => {
    vi.spyOn(api, 'reconnectSocket').mockResolvedValue()
    vi.spyOn(useAuthStore(), 'logout').mockResolvedValue()
    vi.stubGlobal('location', { href: '/' })
  })

  function withUnsavedWorkflow() {
    const workflow = fromPartial<ComfyWorkflow>({
      path: 'a.json',
      isModified: true
    })
    Object.assign(useWorkflowStore(), { modifiedWorkflows: [workflow] })
  }

  const signedInSession: WebSessionIdentityState = {
    phase: 'signed_in',
    session: {
      user: {
        id: 'user-a',
        email: 'user-a@example.com',
        emailVerified: true,
        signInProvider: 'google.com'
      },
      csrfToken: 'csrf-user-a',
      expiresAt: Date.now() + 86_400_000,
      absoluteExpiresAt: Date.now() + 604_800_000
    }
  }

  function onWebSession(revokeAll: WebSessionCommandResult) {
    const webSession = useCloudWebSessionStore()
    webSession.state = signedInSession
    return vi
      .spyOn(webSession, 'revokeAllSessions')
      .mockResolvedValue(revokeAll)
  }

  it.for<{ name: string; session: WebSessionIdentityState }>([
    { name: 'the web session is off', session: { phase: 'idle' } },
    {
      name: 'the web session is signed out',
      session: { phase: 'signed_out', outcome: 'signed_out' }
    }
  ])('renders nothing when $name', async ({ session }) => {
    signInAsEmailUser({ hasFirebaseLogin: true })
    useCloudWebSessionStore().state = session
    await renderPanel()

    expect(screen.getByRole('button', { name: 'Log Out' })).toBeVisible()
    expect(screen.queryByRole('button', signOutEverywhere)).toBeNull()
  })

  it('revokes every session once, then signs this tab out', async () => {
    signInAsEmailUser({ hasFirebaseLogin: true })
    const revokeAll = onWebSession({ status: 'ok' })
    await renderPanel()

    await userEvent.click(screen.getByRole('button', signOutEverywhere))

    expect(revokeAll).toHaveBeenCalledOnce()
    expect(useAuthStore().logout).toHaveBeenCalledOnce()
    expect(revokeAll.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(useAuthStore().logout).mock.invocationCallOrder[0]
    )
    expect(useToastStore().messagesToAdd).toContainEqual(
      expect.objectContaining({
        severity: 'success',
        summary: 'Signed out of all devices'
      })
    )
  })

  it.for([
    { tab: 'a Firebase login', hasFirebaseLogin: true },
    { tab: 'a session-only tab', hasFirebaseLogin: false }
  ])(
    'asks about unsaved work, then revokes once, on $tab',
    async ({ hasFirebaseLogin }) => {
      signInAsEmailUser({ hasFirebaseLogin })
      withUnsavedWorkflow()
      vi.mocked(useDialogService().confirm).mockResolvedValue(false)
      const revokeAll = onWebSession({ status: 'ok' })
      await renderPanel()

      await userEvent.click(screen.getByRole('button', signOutEverywhere))

      expect(useDialogService().confirm).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Unsaved Changes' })
      )
      expect(
        vi.mocked(useDialogService().confirm).mock.invocationCallOrder[0]
      ).toBeLessThan(revokeAll.mock.invocationCallOrder[0])
      expect(revokeAll).toHaveBeenCalledOnce()
      expect(useAuthStore().logout).toHaveBeenCalledOnce()
    }
  )

  it('sends no revoke and stays signed in when the unsaved-work prompt is cancelled', async () => {
    signInAsEmailUser({ hasFirebaseLogin: true })
    withUnsavedWorkflow()
    vi.mocked(useDialogService().confirm).mockResolvedValue(null)
    const revokeAll = onWebSession({ status: 'ok' })
    await renderPanel()

    await userEvent.click(screen.getByRole('button', signOutEverywhere))

    expect(revokeAll).not.toHaveBeenCalled()
    expect(useAuthStore().logout).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toEqual([])
  })

  it('keeps the user signed in and shows why when the revoke fails', async () => {
    signInAsEmailUser({ hasFirebaseLogin: true })
    onWebSession({
      status: 'error',
      code: 'SESSION_UNAVAILABLE',
      retryable: true
    })
    await renderPanel()

    await userEvent.click(screen.getByRole('button', signOutEverywhere))

    expect(useAuthStore().logout).not.toHaveBeenCalled()
    expect(useToastStore().messagesToAdd).toEqual([
      expect.objectContaining({
        severity: 'error',
        summary: "Couldn't sign out of all devices",
        detail: enMessages.auth.webSession.token.unavailable
      })
    ])
    expect(screen.getByRole('button', signOutEverywhere)).toBeEnabled()
  })
})
