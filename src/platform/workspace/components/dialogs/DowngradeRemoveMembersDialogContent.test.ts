/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { render } from '@testing-library/vue'
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

const ButtonStub = {
  name: 'Button',
  template:
    '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>',
  props: ['disabled', 'loading', 'variant', 'size']
}

const InputStub = {
  name: 'Input',
  template:
    '<input :value="modelValue" :disabled="disabled" @input="$emit(\'update:modelValue\', $event.target.value)" />',
  props: ['modelValue', 'disabled', 'placeholder', 'type']
}

function mountComponent(props: Record<string, unknown> = {}) {
  const user = userEvent.setup()
  const onConfirm = vi.fn().mockResolvedValue(undefined)
  const { container } = render(DowngradeRemoveMembersDialogContent, {
    props: {
      planName: 'Founder',
      planSlug: 'founder-monthly',
      onConfirm,
      ...props
    },
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        Input: InputStub
      }
    }
  })
  return { container, user, onConfirm }
}

function getInput(container: Element): HTMLInputElement {
  return container.querySelector('input') as HTMLInputElement
}

function getChangePlanButton(container: Element): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'))
  return buttons.find((b) =>
    b.textContent?.includes('Change plan')
  ) as HTMLButtonElement
}

function getCancelButton(container: Element): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'))
  return buttons.find(
    (b) => b.textContent?.trim() === 'Cancel'
  ) as HTMLButtonElement
}

describe('DowngradeRemoveMembersDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('disables Change plan until the exact phrase is typed', async () => {
    const { container, user } = mountComponent()
    const changePlan = getChangePlanButton(container)
    expect(changePlan.disabled).toBe(true)

    await user.type(getInput(container), 'I understan')
    expect(changePlan.disabled).toBe(true)

    await user.type(getInput(container), 'd')
    expect(changePlan.disabled).toBe(false)
  })

  it('keeps Change plan disabled for a case-mismatched phrase', async () => {
    const { container, user } = mountComponent()
    await user.type(getInput(container), 'i understand')
    expect(getChangePlanButton(container).disabled).toBe(true)
  })

  it('invokes onConfirm with the plan slug and closes when confirmed', async () => {
    const { container, user, onConfirm } = mountComponent()
    await user.type(getInput(container), 'I understand')
    await user.click(getChangePlanButton(container))

    expect(onConfirm).toHaveBeenCalledWith('founder-monthly')
    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'downgrade-remove-members'
    })
  })

  it('closes without calling onConfirm when cancelled', async () => {
    const { container, user, onConfirm } = mountComponent()
    await user.type(getInput(container), 'I understand')
    await user.click(getCancelButton(container))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'downgrade-remove-members'
    })
  })

  it('shows an error toast and stays open when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('boom'))
    const { container, user } = mountComponent({ onConfirm })
    await user.type(getInput(container), 'I understand')
    await user.click(getChangePlanButton(container))

    expect(mockToastAdd).toHaveBeenCalledWith(
      expect.objectContaining({ severity: 'error' })
    )
    expect(mockCloseDialog).not.toHaveBeenCalled()
  })
})
