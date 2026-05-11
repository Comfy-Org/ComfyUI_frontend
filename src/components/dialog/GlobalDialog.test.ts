import { createTestingPinia } from '@pinia/testing'
import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
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
    setActivePinia(createTestingPinia({ stubActions: false }))
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

    const dialogs = await screen.findAllByRole('dialog')
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

    const dialogs = await screen.findAllByRole('dialog')
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

    await screen.findByRole('dialog')
    const item = store.dialogStack.find((d) => d.key === 'reka-flag-check')
    expect(item?.dialogComponentProps.renderer).toBe('reka')
  })
})

describe('GlobalDialog Reka parity with PrimeVue', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  afterEach(() => {
    cleanup()
  })

  it('omits the close button when closable is false', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-not-closable',
      title: 'No close',
      component: Body,
      dialogComponentProps: { renderer: 'reka', closable: false }
    })

    await screen.findByRole('dialog')
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull()
  })

  it('renders the close button by default', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-closable',
      title: 'Closable',
      component: Body,
      dialogComponentProps: { renderer: 'reka' }
    })

    await screen.findByRole('dialog')
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('omits the title when headless is true', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-headless',
      title: 'Hidden title',
      component: Body,
      dialogComponentProps: { renderer: 'reka', headless: true }
    })

    await screen.findByRole('dialog')
    expect(screen.queryByText('Hidden title')).toBeNull()
  })

  it('renders the title when headless is omitted', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-titled',
      title: 'Visible title',
      component: Body,
      dialogComponentProps: { renderer: 'reka' }
    })

    await screen.findByRole('dialog')
    expect(screen.getByText('Visible title')).toBeInTheDocument()
  })

  it('closes the dialog on Escape by default', async () => {
    mountDialog()
    const store = useDialogStore()
    const user = userEvent.setup()

    store.showDialog({
      key: 'reka-esc-default',
      title: 'Esc closes',
      component: Body,
      dialogComponentProps: { renderer: 'reka' }
    })

    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(store.isDialogOpen('reka-esc-default')).toBe(false)
  })

  it('does not close on Escape when closable is false', async () => {
    mountDialog()
    const store = useDialogStore()
    const user = userEvent.setup()

    store.showDialog({
      key: 'reka-esc-blocked',
      title: 'Esc blocked',
      component: Body,
      dialogComponentProps: { renderer: 'reka', closable: false }
    })

    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(store.isDialogOpen('reka-esc-blocked')).toBe(true)
  })
})
