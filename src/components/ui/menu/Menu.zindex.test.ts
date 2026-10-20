import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { MenuItem } from '@/components/ui/menu/types'

import Menu from './Menu.vue'

function renderMenu(items: MenuItem[] = [{ label: 'Item A' }]) {
  return render(Menu, {
    props: { items },
    slots: { trigger: '<button>Open</button>' }
  })
}

describe('Menu z-index', () => {
  it('reopens above an overlay opened after the menu closed', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button'))
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())

    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')

    await user.click(screen.getByRole('button'))

    const menu = await screen.findByRole('menu')
    expect(dialog.compareDocumentPosition(menu)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })

  it('leaves the static z-index untouched when no dialog is open', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button'))

    const menu = await screen.findByRole('menu')
    expect(menu.style.zIndex).toBe('')
    expect(menu.className).toContain('z-overlay')
  })

  it('opens a nested menu above an existing dialog', async () => {
    render({
      template:
        '<section class="fixed z-overlay" data-testid="existing-overlay" />'
    })
    const dialog = screen.getByTestId('existing-overlay')
    const command = vi.fn()
    const user = userEvent.setup()
    renderMenu([
      {
        label: 'Change role',
        items: [
          { label: 'Owner', command },
          { label: 'Member', command }
        ]
      }
    ])

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitem', { name: 'Change role' }))

    expect(await screen.findByRole('menuitem', { name: 'Owner' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Member' })).toBeVisible()
    const submenu = screen
      .getAllByRole('menu')
      .find((menu) => within(menu).queryByRole('menuitem', { name: 'Owner' }))
    expect(submenu).toBeDefined()
    expect(dialog.compareDocumentPosition(submenu!)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    )
  })
})
