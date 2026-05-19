import { createTestingPinia } from '@pinia/testing'
import { cleanup, render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import {
  onRekaFocusOutside,
  onRekaPointerDownOutside
} from '@/components/dialog/rekaPrimeVueBridge'
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

describe('shouldPreventRekaDismiss', () => {
  function makeEvent(target: Element | null) {
    let prevented = false
    return {
      detail: { originalEvent: { target } },
      preventDefault: () => {
        prevented = true
      },
      get defaultPrevented() {
        return prevented
      }
    } as unknown as CustomEvent<{ originalEvent: PointerEvent }> & {
      defaultPrevented: boolean
    }
  }

  it.for([
    'p-select-overlay',
    'p-colorpicker-panel',
    'p-popover',
    'p-autocomplete-overlay',
    'p-overlay-mask',
    'p-dialog'
  ])('prevents dismiss when target is inside %s', (className) => {
    const overlay = document.createElement('div')
    overlay.className = className
    const inner = document.createElement('button')
    overlay.appendChild(inner)
    document.body.appendChild(overlay)

    const event = makeEvent(inner)
    onRekaPointerDownOutside({ dismissableMask: undefined }, event)

    expect(event.defaultPrevented).toBe(true)
    overlay.remove()
  })

  it('allows dismiss when target is outside any PrimeVue overlay', () => {
    const event = makeEvent(document.body)
    onRekaPointerDownOutside({ dismissableMask: undefined }, event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('prevents dismiss when dismissableMask is false even outside an overlay', () => {
    const event = makeEvent(document.body)
    onRekaPointerDownOutside({ dismissableMask: false }, event)
    expect(event.defaultPrevented).toBe(true)
  })

  it.for(['p-dialog', 'p-select-overlay'])(
    'focus-outside on a sibling %s portal does not dismiss the parent',
    (className) => {
      const overlay = document.createElement('div')
      overlay.className = className
      const inner = document.createElement('button')
      overlay.appendChild(inner)
      document.body.appendChild(overlay)

      const event = makeEvent(inner)
      onRekaFocusOutside(event)

      expect(event.defaultPrevented).toBe(true)
      overlay.remove()
    }
  )

  it('focus-outside still dismisses when focus moves to a non-portal element', () => {
    const event = makeEvent(document.body)
    onRekaFocusOutside(event)
    expect(event.defaultPrevented).toBe(false)
  })

  it('focus-outside on a sibling Reka portal does not dismiss the parent', () => {
    const portal = document.createElement('div')
    portal.setAttribute('role', 'dialog')
    document.body.appendChild(portal)

    const event = makeEvent(portal)
    onRekaFocusOutside(event)

    expect(event.defaultPrevented).toBe(true)
    portal.remove()
  })
})
