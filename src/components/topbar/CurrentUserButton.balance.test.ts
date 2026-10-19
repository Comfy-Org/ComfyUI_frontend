import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import CurrentUserButton from './CurrentUserButton.vue'

vi.mock(import('firebase/auth'))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true
}))

vi.mock(import('@/composables/auth/useCurrentUser'))

vi.mock(import('@/composables/billing/useBillingContext'))

describe('CurrentUserButton balance refresh', () => {
  it('fetches the balance each time the popover is reopened', async () => {
    useCurrentUser().isLoggedIn = computed(() => true)
    useCurrentUser().userPhotoUrl = computed(() => null)
    useTeamWorkspaceStore().initState = 'ready'
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })
    const billingContext = useBillingContext()
    vi.mocked(useBillingContext).mockReturnValue(billingContext)
    const user = userEvent.setup()
    render(CurrentUserButton, {
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            messages: { en: enMessages }
          })
        ]
      }
    })

    const currentUserButton = screen.getByRole('button', {
      name: 'Current user'
    })
    await user.click(currentUserButton)
    await vi.dynamicImportSettled()
    await user.keyboard('{Escape}')
    await waitFor(() =>
      expect(screen.queryByTestId('logout-menu-item')).not.toBeInTheDocument()
    )
    vi.mocked(billingContext.fetchBalance).mockClear()

    await user.click(currentUserButton)

    expect(await screen.findByTestId('logout-menu-item')).toBeInTheDocument()
    expect(billingContext.fetchBalance).toHaveBeenCalledOnce()
  })
})
