import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import Button from '@/components/ui/button/Button.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import { useDialogStore } from '@/stores/dialogStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: { g: { cancel: 'Cancel', close: 'Close', maximizeDialog: 'Maximize' } }
  },
  missingWarn: false,
  fallbackWarn: false
})

const onItemClick = vi.fn()
const items: MenuItem[] = [{ label: 'Delete', command: onItemClick }]

const DialogBodyWithMenu = defineComponent({
  name: 'DialogBodyWithMenu',
  setup: () => () =>
    h(
      Menu,
      { items },
      {
        trigger: () => h(Button, null, () => 'Open menu')
      }
    )
})

describe('Menu inside a modal Reka dialog', () => {
  beforeEach(() => {
    document.body.style.pointerEvents = ''
    onItemClick.mockClear()
  })

  it('keeps its menu items clickable despite the dialog body-lock', async () => {
    const user = userEvent.setup()
    render(GlobalDialog, {
      global: {
        plugins: [i18n],
        stubs: { transition: false, 'transition-group': false }
      }
    })
    const dialogStore = useDialogStore()

    dialogStore.showDialog({
      key: 'menu-host',
      title: 'Host dialog',
      component: DialogBodyWithMenu,
      dialogComponentProps: {
        headless: true,
        closable: true
      }
    })

    await user.click(await screen.findByRole('button', { name: 'Open menu' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))

    expect(onItemClick).toHaveBeenCalledTimes(1)
  })
})
