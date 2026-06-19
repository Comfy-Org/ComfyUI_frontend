import { ZIndex } from '@primeuix/utils/zindex'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import DropdownMenu from './DropdownMenu.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderMenu() {
  return render(DropdownMenu, {
    props: { entries: [{ label: 'Item A' }] },
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
})
