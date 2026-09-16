import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import {
  onAuthStateChanged,
  onIdTokenChanged,
  setPersistence
} from 'firebase/auth'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { capturePreservedQuery } from '@/platform/navigation/preservedQueryManager'
import { useAuthStore } from '@/stores/authStore'
import { useDialogStore } from '@/stores/dialogStore'

import InviteWrongAccountDialogContent from './InviteWrongAccountDialogContent.vue'

vi.mock(import('firebase/auth'), { spy: true })

const mockLogout = vi.hoisted(() => vi.fn<() => Promise<void>>())
vi.mock<unknown>(import('@/composables/auth/useAuthActions'), () => ({
  useAuthActions: () => ({ logout: mockLogout })
}))

vi.mock(import('@/platform/navigation/preservedQueryManager'), {
  spy: true
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function renderComponent() {
  return render(InviteWrongAccountDialogContent, {
    props: { inviteToken: 'tok-403' },
    global: { plugins: [i18n] }
  })
}

describe('InviteWrongAccountDialogContent', () => {
  beforeEach(() => {
    vi.mocked(setPersistence).mockResolvedValue(undefined)
    vi.mocked(onAuthStateChanged).mockImplementation(vi.fn())
    vi.mocked(onIdTokenChanged).mockImplementation(vi.fn())
    mockLogout.mockResolvedValue()
  })

  it('re-stashes the invite token before the app-level sign-out on Switch account', async () => {
    renderComponent()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'workspacePanel.inviteLinks.switchAccount'
      })
    )

    expect(vi.mocked(capturePreservedQuery)).toHaveBeenCalledWith(
      'invite',
      { invite: 'tok-403' },
      ['invite']
    )
    expect(mockLogout).toHaveBeenCalled()
    expect(
      vi.mocked(capturePreservedQuery).mock.invocationCallOrder[0]
    ).toBeLessThan(mockLogout.mock.invocationCallOrder[0])
    expect(vi.mocked(useAuthStore().logout)).not.toHaveBeenCalled()
  })

  it('dismisses without signing out on Got it', async () => {
    renderComponent()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'workspacePanel.inviteLinks.invalidDismiss'
      })
    )

    expect(mockLogout).not.toHaveBeenCalled()
    expect(vi.mocked(capturePreservedQuery)).not.toHaveBeenCalled()
    expect(vi.mocked(useDialogStore().closeDialog)).toHaveBeenCalledWith({
      key: 'invite-wrong-account'
    })
  })
})
