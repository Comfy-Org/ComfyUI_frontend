import { render } from '@testing-library/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
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

const Body = defineComponent({
  name: 'Body',
  setup: () => () => h('p', 'body content')
})

const menuOpen = ref(false)

const BodyWithMenu = defineComponent({
  name: 'BodyWithMenu',
  setup: () => () =>
    h(
      DropdownMenuRoot,
      {
        open: menuOpen.value,
        'onUpdate:open': (open: boolean) => (menuOpen.value = open)
      },
      () => [
        h(DropdownMenuTrigger, null, () => 'open menu'),
        h(DropdownMenuPortal, null, () =>
          h(DropdownMenuContent, null, () =>
            h(DropdownMenuItem, null, () => 'item')
          )
        )
      ]
    )
})

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

function mountDialogHost() {
  render(GlobalDialog, { global: { plugins: [i18n] } })
  return useDialogStore()
}

function openModal(
  store: ReturnType<typeof useDialogStore>,
  key: string,
  component = Body
) {
  store.showDialog({
    key,
    title: key,
    component,
    dialogComponentProps: { renderer: 'reka', modal: true }
  })
}

describe('body pointer-events after modal dialogs close', () => {
  beforeEach(() => {
    document.body.style.pointerEvents = ''
    menuOpen.value = false
  })

  it('restores interactivity when the lower of two stacked dialogs closes first', async () => {
    const store = mountDialogHost()

    openModal(store, 'lower')
    await settle()
    openModal(store, 'upper')
    await settle()
    expect(document.body.style.pointerEvents).toBe('none')

    store.closeDialog({ key: 'lower' })
    await settle()
    store.closeDialog({ key: 'upper' })
    await settle()

    expect(store.dialogStack).toHaveLength(0)
    expect(document.body.style.pointerEvents).toBe('')
  })

  it('restores interactivity when a dialog closes while its menu is open', async () => {
    const store = mountDialogHost()

    openModal(store, 'dialog-with-menu', BodyWithMenu)
    await settle()
    menuOpen.value = true
    await settle()
    await settle()
    expect(document.body.style.pointerEvents).toBe('none')

    store.closeDialog({ key: 'dialog-with-menu' })
    await settle()
    await settle()

    expect(store.dialogStack).toHaveLength(0)
    expect(document.body.style.pointerEvents).toBe('')
  })
})
