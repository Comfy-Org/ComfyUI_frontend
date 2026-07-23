import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { MenuItem } from 'primevue/menuitem'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import DropdownMenu from './DropdownMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderMenu(entries: MenuItem[] = [{ label: 'Item A' }]) {
  return render(DropdownMenu, {
    props: { entries },
    global: { plugins: [i18n], directives: { tooltip: {} } }
  })
}

let openModal: HTMLElement | undefined

afterEach(() => {
  if (openModal) {
    ZIndex.clear(openModal)
    openModal = undefined
  }
})

describe('DropdownMenu z-index', () => {
  it('opens above a dialog registered with the modal z-index counter', async () => {
    openModal = document.createElement('div')
    ZIndex.set('modal', openModal, 1700)
    const dialogZ = Number(openModal.style.zIndex)

    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button'))

    const menu = await screen.findByRole('menu')
    expect(Number(menu.style.zIndex)).toBeGreaterThan(dialogZ)
  })

  it('leaves the static z-index untouched when no dialog is open', async () => {
    const user = userEvent.setup()
    renderMenu()
    await user.click(screen.getByRole('button'))

    const menu = await screen.findByRole('menu')
    expect(menu.style.zIndex).toBe('')
    expect(menu.className).toContain('z-1700')
  })

  it('opens a nested menu above a registered dialog', async () => {
    openModal = document.createElement('div')
    ZIndex.set('modal', openModal, 1700)
    const dialogZ = Number(openModal.style.zIndex)
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
    expect(Number(submenu?.style.zIndex)).toBeGreaterThan(dialogZ)
  })
})
