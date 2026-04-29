import { cleanup, render, screen } from '@testing-library/vue'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useDialogStore } from '@/stores/dialogStore'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { close: 'Close' } } },
  missingWarn: false,
  fallbackWarn: false
})

const Body = defineComponent({
  name: 'Body',
  setup: () => () => h('p', { 'data-testid': 'body' }, 'body content')
})

function mountDialog() {
  return render(GlobalDialog, {
    global: { plugins: [PrimeVue, i18n] }
  })
}

describe('GlobalDialog renderer branching', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  afterEach(() => {
    cleanup()
  })

  it('renders the PrimeVue branch when renderer is omitted', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'primevue-default',
      title: 'PrimeVue dialog',
      component: Body
    })
    await nextTick()
    await nextTick()

    const dialogs = screen.queryAllByRole('dialog')
    expect(dialogs.some((el) => el.classList.contains('p-dialog'))).toBe(true)
  })

  it('renders the Reka branch when renderer is reka', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-opt-in',
      title: 'Reka dialog',
      component: Body,
      dialogComponentProps: { renderer: 'reka' }
    })
    await nextTick()
    await nextTick()

    const dialogs = screen.queryAllByRole('dialog')
    expect(dialogs.length).toBeGreaterThan(0)
    expect(dialogs.some((el) => el.classList.contains('p-dialog'))).toBe(false)
  })

  it('preserves the renderer flag on the dialog stack item', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-flag-check',
      title: 'Reka',
      component: Body,
      dialogComponentProps: { renderer: 'reka' }
    })
    await nextTick()

    const item = store.dialogStack.find((d) => d.key === 'reka-flag-check')
    expect(item?.dialogComponentProps.renderer).toBe('reka')
  })
})
