import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import DowngradeRemoveMembersDialogContent from './DowngradeRemoveMembersDialogContent.vue'

const mockCloseDialog = vi.fn()
const mockToastAdd = vi.fn()

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: {
    en: {
      g: { cancel: 'Cancel', close: 'Close', unknownError: 'Unknown error' },
      subscription: {
        downgrade: {
          title: 'Change to {plan} plan?',
          body: 'All other members of this workspace will be immediately removed.',
          bodyReactivation:
            "Your subscription is cancelled. Changing your plan will resume it, and you'll be charged {amount} today.",
          bodyRemovalAndReactivation:
            "All other members of this workspace will be immediately removed. Your subscription is cancelled, so changing your plan will also resume it, and you'll be charged {amount} today.",
          confirmationPhrase: 'I understand',
          confirmationPrompt: 'Type "{phrase}" to confirm.',
          confirm: 'Change plan',
          failed: 'Failed to change plan'
        }
      }
    }
  }
})

function mountComponent(props: Record<string, unknown> = {}) {
  const user = userEvent.setup()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const { rerender } = render(DowngradeRemoveMembersDialogContent, {
    props: {
      planName: 'Founder',
      planSlug: 'founder-monthly',
      onConfirm,
      ...props
    },
    global: {
      plugins: [i18n]
    }
  })
  return { user, onConfirm, rerender }
}

const getPhraseInput = () => screen.getByRole('textbox')
const getChangePlanButton = () =>
  screen.getByRole('button', { name: 'Change plan' })
const getCancelButton = () => screen.getByRole('button', { name: 'Cancel' })

describe('DowngradeRemoveMembersDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables Change plan until the exact phrase is typed', async () => {
    const { user } = mountComponent()
    expect(getChangePlanButton()).toBeDisabled()

    await user.type(getPhraseInput(), 'I understan')
    expect(getChangePlanButton()).toBeDisabled()

    await user.type(getPhraseInput(), 'd')
    expect(getChangePlanButton()).toBeEnabled()
  })

  it('keeps Change plan disabled for a case-mismatched phrase', async () => {
    const { user } = mountComponent()
    await user.type(getPhraseInput(), 'i understand')
    expect(getChangePlanButton()).toBeDisabled()
  })

  it('invokes onConfirm with the plan slug and closes when confirmed', async () => {
    const { user, onConfirm } = mountComponent()
    await user.type(getPhraseInput(), 'I understand')
    await user.click(getChangePlanButton())

    expect(onConfirm).toHaveBeenCalledWith('founder-monthly', false)
    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'downgrade-remove-members'
    })
  })

  it('shows the removal-only body when reactivation is not required', () => {
    mountComponent({ requiresRemoval: true, requiresReactivation: false })

    expect(
      screen.getByText(
        'All other members of this workspace will be immediately removed.'
      )
    ).toBeInTheDocument()
  })

  it('shows the reactivation charge and forwards confirmReactivation true when only reactivation is required', async () => {
    const { user, onConfirm } = mountComponent({
      requiresRemoval: false,
      requiresReactivation: true,
      chargeCents: 1500
    })

    expect(
      screen.getByText(
        "Your subscription is cancelled. Changing your plan will resume it, and you'll be charged $15.00 today."
      )
    ).toBeInTheDocument()

    await user.type(getPhraseInput(), 'I understand')
    await user.click(getChangePlanButton())

    expect(onConfirm).toHaveBeenCalledWith('founder-monthly', true)
  })

  it('shows the combined removal-and-reactivation body when both are required', () => {
    mountComponent({
      requiresRemoval: true,
      requiresReactivation: true,
      chargeCents: 5454
    })

    expect(
      screen.getByText(
        "All other members of this workspace will be immediately removed. Your subscription is cancelled, so changing your plan will also resume it, and you'll be charged $54.54 today."
      )
    ).toBeInTheDocument()
  })

  it('closes without calling onConfirm when cancelled', async () => {
    const { user, onConfirm } = mountComponent()
    await user.type(getPhraseInput(), 'I understand')
    await user.click(getCancelButton())

    expect(onConfirm).not.toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'downgrade-remove-members'
    })
  })

  it('shows an error toast and stays open when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'))
    const { user } = mountComponent({ onConfirm })
    await user.type(getPhraseInput(), 'I understand')
    await user.click(getChangePlanButton())

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(mockCloseDialog).not.toHaveBeenCalled()
  })

  // Regression guard: a drift refresh (dialogService's onConfirm handler)
  // updates requiresReactivation/chargeCents on this already-mounted dialog
  // in place. The typed "I understand" was an acknowledgment of the PRIOR
  // amount, so it must not silently carry forward and leave the destructive
  // CTA enabled for a charge the user never actually saw. A service-level
  // test that calls onConfirm directly can't see this — it's local state on
  // the mounted component, so it needs a mount + rerender.
  it('clears the typed confirmation and re-disables Change plan when reactivation props drift after the phrase is typed', async () => {
    const { user, rerender } = mountComponent({
      requiresReactivation: true,
      chargeCents: 1500
    })

    await user.type(getPhraseInput(), 'I understand')
    expect(getChangePlanButton()).toBeEnabled()

    await rerender({ requiresReactivation: true, chargeCents: 2000 })

    expect(getPhraseInput()).toHaveValue('')
    expect(getChangePlanButton()).toBeDisabled()
  })
})
