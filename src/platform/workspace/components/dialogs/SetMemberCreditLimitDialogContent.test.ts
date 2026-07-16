import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import SetMemberCreditLimitDialogContent from './SetMemberCreditLimitDialogContent.vue'

const { mockSetMemberCreditLimit, mockCloseDialog } = vi.hoisted(() => ({
  mockSetMemberCreditLimit: vi.fn(),
  mockCloseDialog: vi.fn()
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    setMemberCreditLimit: mockSetMemberCreditLimit
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({ closeDialog: mockCloseDialog })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: { close: 'Close', cancel: 'Cancel' },
      workspacePanel: {
        members: {
          creditLimitDialog: {
            title: 'Set a monthly credit limit for {name}',
            description: 'Description',
            limitOption: 'Limit monthly credit usage to:',
            noLimit: 'No limit',
            warning: 'Already spent {credits}',
            invalidLimit: 'Invalid limit',
            update: 'Update limit'
          }
        }
      }
    }
  }
})

function renderDialog(currentLimit: number | null = 3000) {
  const user = userEvent.setup()
  const result = render(SetMemberCreditLimitDialogContent, {
    props: {
      memberId: 'mem-1',
      memberName: 'Jane',
      creditsUsed: 645,
      currentLimit
    },
    global: { plugins: [i18n] }
  })
  return { ...result, user }
}

describe('SetMemberCreditLimitDialogContent', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates an existing limit', async () => {
    const { user } = renderDialog()
    const input = screen.getByRole('textbox')
    expect(input).toHaveAccessibleName('Limit monthly credit usage to:')
    await user.clear(input)
    await user.type(input, '2500')
    await user.click(screen.getByRole('button', { name: 'Update limit' }))

    expect(mockSetMemberCreditLimit).toHaveBeenCalledWith('mem-1', 2500)
    expect(mockCloseDialog).toHaveBeenCalledWith({
      key: 'set-member-credit-limit'
    })
  })

  it('removes a limit', async () => {
    const { user } = renderDialog()
    await user.click(screen.getByRole('radio', { name: 'No limit' }))
    await user.click(screen.getByRole('button', { name: 'Update limit' }))
    expect(mockSetMemberCreditLimit).toHaveBeenCalledWith('mem-1', null)
  })

  it('supports keyboard navigation between limit modes', async () => {
    const { user } = renderDialog()
    const limitedRadio = screen.getByRole('radio', {
      name: 'Limit monthly credit usage to:'
    })
    await user.click(limitedRadio)
    await user.keyboard('{ArrowDown}')

    expect(screen.getByRole('radio', { name: 'No limit' })).toBeChecked()
  })

  it('warns when the new limit is at or below current usage', async () => {
    const { user } = renderDialog()
    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '645')
    expect(screen.getByText('Already spent 645')).toBeInTheDocument()
  })

  it('rejects limits beyond the safe whole-number range', async () => {
    const { user } = renderDialog(null)
    const input = screen.getByRole('textbox')
    await user.type(input, '9007199254740992')

    expect(input).toHaveValue('9007199254740992')
    expect(screen.getByRole('button', { name: 'Update limit' })).toBeDisabled()
    expect(screen.getByText('Invalid limit')).toBeInTheDocument()
  })
})
