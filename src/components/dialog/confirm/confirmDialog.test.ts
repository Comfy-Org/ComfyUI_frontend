import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { showConfirmDialog } from '@/components/dialog/confirm/confirmDialog'
import { useDialogStore } from '@/stores/dialogStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { cancel: 'Cancel', close: 'Close' } } },
  missingWarn: false,
  fallbackWarn: false
})

function renderConfirm(onConfirm: () => unknown = vi.fn()) {
  render(
    {
      components: { GlobalDialog },
      template: '<button>Open</button><GlobalDialog />'
    },
    { global: { plugins: [i18n] } }
  )
  const opener = screen.getByRole('button', { name: 'Open' })
  opener.focus()

  const dialogStore = useDialogStore()
  const dialog = showConfirmDialog({
    key: 'confirm-test',
    headerProps: { title: 'Delete secret' },
    props: { promptText: 'This cannot be undone.' },
    footerProps: {
      confirmText: 'Delete',
      onCancel: () => dialogStore.closeDialog(dialog),
      onConfirm
    }
  })
  return { opener, dialogStore }
}

describe('showConfirmDialog', () => {
  it('opens a labelled dialog with focus on cancel and traps Tab inside it', async () => {
    const user = userEvent.setup()
    renderConfirm()

    const dialog = await screen.findByRole('dialog', { name: 'Delete secret' })
    const close = within(dialog).getByRole('button', { name: 'Close' })
    const cancel = within(dialog).getByRole('button', { name: 'Cancel' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })
    await waitFor(() => expect(cancel).toHaveFocus())

    await user.tab()
    expect(confirm).toHaveFocus()
    await user.tab()
    expect(close).toHaveFocus()
    await user.tab({ shift: true })
    expect(confirm).toHaveFocus()
  })

  it.for([
    {
      dismissal: 'Escape',
      dismiss: (user: ReturnType<typeof userEvent.setup>) =>
        user.keyboard('{Escape}')
    },
    {
      dismissal: 'an overlay click',
      dismiss: (user: ReturnType<typeof userEvent.setup>) =>
        user.click(screen.getByTestId('dialog-overlay'))
    }
  ])(
    'closes on $dismissal without confirming and returns focus to the opener',
    async ({ dismiss }) => {
      const user = userEvent.setup()
      const onConfirm = vi.fn()
      const { opener, dialogStore } = renderConfirm(onConfirm)
      await screen.findByRole('dialog', { name: 'Delete secret' })

      await dismiss(user)

      await waitFor(() =>
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      )
      expect(dialogStore.isDialogOpen('confirm-test')).toBe(false)
      expect(onConfirm).not.toHaveBeenCalled()
      await waitFor(() => expect(opener).toHaveFocus())
    }
  )

  it('confirms exactly once when the confirm button is activated repeatedly', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(() => new Promise<void>(() => {}))
    renderConfirm(onConfirm)
    const dialog = await screen.findByRole('dialog', { name: 'Delete secret' })
    const confirm = within(dialog).getByRole('button', { name: 'Delete' })

    await user.dblClick(confirm)
    confirm.focus()
    await user.keyboard('{Enter}')

    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
