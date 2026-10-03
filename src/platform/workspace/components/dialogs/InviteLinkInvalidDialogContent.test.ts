import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useDialogStore } from '@/stores/dialogStore'

import InviteLinkInvalidDialogContent from './InviteLinkInvalidDialogContent.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function renderComponent() {
  return render(InviteLinkInvalidDialogContent, {
    global: { plugins: [i18n] }
  })
}

describe('InviteLinkInvalidDialogContent', () => {
  it('closes the dialog from the dismiss button', async () => {
    renderComponent()

    await userEvent.click(
      screen.getByRole('button', {
        name: 'workspacePanel.inviteLinks.invalidDismiss'
      })
    )

    expect(vi.mocked(useDialogStore().closeDialog)).toHaveBeenCalledWith({
      key: 'invite-link-invalid'
    })
  })

  it('closes the dialog from the header close button', async () => {
    renderComponent()

    await userEvent.click(screen.getByRole('button', { name: 'g.close' }))

    expect(vi.mocked(useDialogStore().closeDialog)).toHaveBeenCalledWith({
      key: 'invite-link-invalid'
    })
  })
})
