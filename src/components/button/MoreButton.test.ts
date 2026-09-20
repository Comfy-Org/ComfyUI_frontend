import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import PrimeVue from 'primevue/config'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import MoreButton from '@/components/button/MoreButton.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import Button from '@/components/ui/button/Button.vue'
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

const DialogBodyWithMoreButton = defineComponent({
  name: 'DialogBodyWithMoreButton',
  setup: () => () =>
    h(MoreButton, null, {
      default: () =>
        h(
          Button,
          { 'data-testid': 'menu-item', onClick: onItemClick },
          () => 'Delete'
        )
    })
})

describe('MoreButton inside a modal Reka dialog', () => {
  beforeEach(() => {
    document.body.style.pointerEvents = ''
    onItemClick.mockClear()
  })

  it('keeps its menu items clickable despite the dialog body-lock', async () => {
    const user = userEvent.setup()
    render(GlobalDialog, {
      global: {
        plugins: [PrimeVue, i18n],
        stubs: { transition: false, 'transition-group': false }
      }
    })
    const dialogStore = useDialogStore()

    dialogStore.showDialog({
      key: 'more-button-host',
      title: 'Host dialog',
      component: DialogBodyWithMoreButton,
      dialogComponentProps: {
        renderer: 'reka',
        headless: true,
        modal: true,
        closable: true
      }
    })

    const trigger = await screen.findByRole('button')
    await user.click(trigger)

    const menuItem = await screen.findByTestId('menu-item')
    await user.click(menuItem)

    expect(onItemClick).toHaveBeenCalledTimes(1)
  })
})
