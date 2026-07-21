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
  render(DowngradeRemoveMembersDialogContent, {
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
  return { user, onConfirm }
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

    expect(onConfirm).toHaveBeenCalledWith('founder-monthly')
    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'downgrade-remove-members'
    })
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
})
