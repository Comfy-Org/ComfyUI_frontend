import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import BuilderSaveDialogContent from '@/components/builder/BuilderSaveDialogContent.vue'
import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { onRekaPointerDownOutside } from '@/components/dialog/dialogDismissGuards'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import CancellationStepLayout from '@/platform/billing/subscription/components/CancellationStepLayout.vue'
import SetMemberCreditLimitDialogContent from '@/platform/workspace/components/dialogs/SetMemberCreditLimitDialogContent.vue'
import SubscriptionRequiredDialogContentUnified from '@/platform/billing/components/SubscriptionRequiredDialogContentUnified.vue'
import { useDialogStore } from '@/stores/dialogStore'

vi.mock<unknown>(
  import('@/platform/billing/composables/useSubscriptionCheckout'),
  async () => {
    const { computed, ref } = await import('vue')

    return {
      useSubscriptionCheckout: () => ({
        checkoutStep: ref('pricing'),
        isLoadingPreview: ref(false),
        loadingTier: ref(null),
        isSubscribing: ref(false),
        isResubscribing: ref(false),
        previewData: ref(null),
        reactivationRequired: ref(false),
        selectedTierKey: ref(null),
        selectedTeamStop: ref(null),
        selectedBillingCycle: ref('yearly'),
        activeCheckoutActionUrl: ref(null),
        authenticationState: ref(null),
        isPolling: ref(false),
        isTeamCheckout: computed(() => false),
        previewVariant: computed(() => null),
        handleSubscribeClick: vi.fn(),
        handleSubscribeTeamClick: vi.fn(),
        handleBackToPricing: vi.fn(),
        handleSuccessClose: vi.fn(),
        handleAddCreditCard: vi.fn(),
        handleConfirmTransition: vi.fn(),
        handleTeamSubscribe: vi.fn(),
        handleResubscribe: vi.fn()
      })
    }
  }
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        cancel: 'Cancel',
        close: 'Close',
        maximizeDialog: 'Maximize',
        restoreDialog: 'Restore',
        save: 'Save'
      },
      builderToolbar: {
        app: 'App',
        appDescription: 'Opens as an app by default',
        defaultViewLabel: 'By default, this workflow will open as:',
        filename: 'Filename',
        nodeGraph: 'Node graph',
        nodeGraphDescription: 'Opens as node graph by default',
        saveAs: 'Save as'
      },
      workspacePanel: {
        members: {
          creditLimitDialog: {
            title: 'Set a monthly credit limit for {name}',
            description: 'Description',
            limitOption: 'Limit monthly credit usage to:',
            noLimit: 'No limit',
            warning: 'Already spent {credits}',
            invalidLimit: 'Invalid limit',
            update: 'Update limit'
          }
        }
      }
    }
  },
  missingWarn: false,
  fallbackWarn: false
})

const Body = defineComponent({
  name: 'Body',
  setup: () => () => h('p', { 'data-testid': 'body' }, 'body content')
})

function mountDialog() {
  return render(GlobalDialog, {
    global: { plugins: [i18n] }
  })
}

describe('GlobalDialog', () => {
  it('omits the close button when closable is false', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-not-closable',
      title: 'No close',
      component: Body,
      dialogComponentProps: { closable: false }
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
      component: Body
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
      dialogComponentProps: { headless: true }
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
      component: Body
    })

    await screen.findByRole('dialog')
    expect(screen.getByText('Visible title')).toBeInTheDocument()
  })

  it.for([
    {
      frame: 'DialogPanel',
      component: SetMemberCreditLimitDialogContent,
      props: {
        memberId: 'member-1',
        memberName: 'Jane',
        creditsUsed: 645,
        currentLimit: 3000
      },
      name: 'Set a monthly credit limit for Jane'
    },
    {
      frame: 'a custom layout',
      component: CancellationStepLayout,
      props: { title: 'Cancel your plan', onClose: () => {} },
      name: 'Cancel your plan'
    }
  ])(
    'names a headless dialog by the DialogTitle in $frame',
    async ({ component, props, name }) => {
      mountDialog()

      useDialogStore().showDialog({
        key: 'headless-named',
        component,
        props,
        dialogComponentProps: { headless: true }
      })

      expect(await screen.findByRole('dialog', { name })).toBeInTheDocument()
    }
  )

  it('names an untitled framed dialog by the DialogTitle in its content', async () => {
    mountDialog()
    const contentTitle = ref('Original title')
    const TitledBody = defineComponent({
      name: 'TitledBody',
      setup: () => () => h(DialogTitle, () => contentTitle.value)
    })

    useDialogStore().showDialog({
      key: 'framed-content-titled',
      component: TitledBody
    })

    const dialog = await screen.findByRole('dialog', {
      name: 'Original title'
    })
    contentTitle.value = 'Translated title'
    await waitFor(() => expect(dialog).toHaveAccessibleName('Translated title'))
  })

  it('opens the save dialog with an accessible name and description', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'builder-save',
      component: BuilderSaveDialogContent,
      props: { defaultFilename: 'workflow.json' },
      dialogComponentProps: { headless: true }
    })

    const dialog = await screen.findByRole('dialog', { name: 'Save as' })
    expect(dialog).toHaveAccessibleDescription('Filename')
    expect(screen.getByLabelText('Filename')).toHaveFocus()
    expect(console.warn).not.toHaveBeenCalled()
  })

  it('closes the dialog on Escape by default', async () => {
    mountDialog()
    const store = useDialogStore()
    const user = userEvent.setup()

    store.showDialog({
      key: 'reka-esc-default',
      title: 'Esc closes',
      component: Body
    })

    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(store.isDialogOpen('reka-esc-default')).toBe(false)
  })

  it('closes the top dialog on Escape when dialogs are stacked', async () => {
    mountDialog()
    const store = useDialogStore()
    const user = userEvent.setup()

    store.showDialog({
      key: 'reka-esc-lower',
      title: 'Lower',
      component: Body,
      priority: 1
    })
    await screen.findByRole('dialog', { name: 'Lower' })
    store.showDialog({
      key: 'reka-esc-active',
      title: 'Active',
      component: Body,
      priority: 2
    })

    await waitFor(() =>
      expect(screen.getAllByRole('dialog', { hidden: true })).toHaveLength(2)
    )
    await user.keyboard('{Escape}')

    expect(store.isDialogOpen('reka-esc-active')).toBe(false)
    expect(store.isDialogOpen('reka-esc-lower')).toBe(true)

    store.showDialog({
      key: 'reka-esc-active',
      title: 'Active',
      component: Body
    })
    await screen.findByRole('dialog', { name: 'Active', hidden: true })
    store.riseDialog({ key: 'reka-esc-lower' })
    await user.keyboard('{Escape}')

    expect(store.isDialogOpen('reka-esc-active')).toBe(false)
    expect(store.isDialogOpen('reka-esc-lower')).toBe(true)
  })

  it('does not close on Escape when closable is false', async () => {
    mountDialog()
    const store = useDialogStore()
    const user = userEvent.setup()

    store.showDialog({
      key: 'reka-esc-blocked',
      title: 'Esc blocked',
      component: Body,
      dialogComponentProps: { closable: false }
    })

    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')

    expect(store.isDialogOpen('reka-esc-blocked')).toBe(true)
  })

  it('toggles maximize through the header control and tells the content', async () => {
    mountDialog()
    const store = useDialogStore()
    const user = userEvent.setup()
    const MaximizeAwareBody = defineComponent({
      props: { maximized: Boolean },
      setup: (props) => () => h('p', props.maximized ? 'maximized' : 'framed')
    })

    store.showDialog({
      key: 'reka-maximize',
      title: 'Maximizable',
      component: MaximizeAwareBody,
      dialogComponentProps: { maximizable: true }
    })

    const dialog = await screen.findByRole('dialog', { name: 'Maximizable' })
    expect(within(dialog).getByText('framed')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Maximize' }))
    expect(within(dialog).getByText('maximized')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Restore' }))
    expect(within(dialog).getByText('framed')).toBeInTheDocument()
  })
})

describe('GlobalDialog Reka overlay scrim', () => {
  it('renders a backdrop scrim for modal Reka dialogs', async () => {
    mountDialog()
    const store = useDialogStore()

    store.showDialog({
      key: 'reka-modal-scrim',
      title: 'Modal',
      component: Body
    })

    await screen.findByRole('dialog')
    expect(screen.queryAllByTestId('dialog-overlay')).toHaveLength(1)
  })

  it('dismisses the dialog on a scrim pointerdown', async () => {
    mountDialog()
    const store = useDialogStore()
    const user = userEvent.setup()

    store.showDialog({
      key: 'reka-scrim-dismiss',
      title: 'Scrim',
      component: Body
    })

    await screen.findByRole('dialog')
    await user.click(screen.getByTestId('dialog-overlay'))

    await waitFor(() =>
      expect(store.isDialogOpen('reka-scrim-dismiss')).toBe(false)
    )
  })

  it('keeps checkout open on the scrim while preserving explicit dismissal', async () => {
    render(GlobalDialog, {
      global: {
        plugins: [i18n],
        stubs: {
          UnifiedPricingTable: true,
          SubscriptionAddPaymentPreviewWorkspace: true,
          SubscriptionTransitionPreviewWorkspace: true,
          SubscriptionSuccessWorkspace: true
        }
      }
    })
    const store = useDialogStore()
    const user = userEvent.setup()
    const key = 'subscription-required'

    function openDialog() {
      store.showDialog({
        key,
        component: SubscriptionRequiredDialogContentUnified,
        props: { onClose: () => store.closeDialog({ key }) },
        dialogComponentProps: {
          headless: true,
          dismissOnPointerDownOutside: false
        }
      })
    }

    openDialog()
    const dialog = await screen.findByRole('dialog')
    await user.click(screen.getByTestId('dialog-overlay'))
    await nextTick()

    expect(dialog).toHaveAttribute('data-state', 'open')
    expect(store.isDialogOpen(key)).toBe(true)

    await user.keyboard('{Escape}')
    await waitFor(() => expect(store.isDialogOpen(key)).toBe(false))

    openDialog()
    await screen.findByRole('dialog')
    await user.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(store.isDialogOpen(key)).toBe(false))
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

  function appendLayer(mark: (layer: HTMLElement) => void) {
    const layer = document.createElement('div')
    mark(layer)
    const inner = document.createElement('button')
    layer.appendChild(inner)
    document.body.appendChild(layer)
    onTestFinished(() => {
      layer.remove()
    })
    return inner
  }

  function pointerDownOn(target: Element | null) {
    const event = makeEvent(target)
    onRekaPointerDownOutside({ dismissOnPointerDownOutside: undefined }, event)
    return event
  }

  it.for([
    {
      name: 'a Reka dismissable layer',
      mark: (layer: HTMLElement) =>
        layer.setAttribute('data-dismissable-layer', '')
    },
    {
      name: 'a Reka popper content wrapper',
      mark: (layer: HTMLElement) =>
        layer.setAttribute('data-reka-popper-content-wrapper', '')
    },
    {
      name: 'a toast',
      mark: (layer: HTMLElement) =>
        layer.setAttribute('data-toast-kind', 'info')
    },
    {
      name: 'the toast dock',
      mark: (layer: HTMLElement) => layer.setAttribute('data-toast-dock', '')
    }
  ])('prevents dismiss when the target is inside $name', ({ mark }) => {
    expect(pointerDownOn(appendLayer(mark)).defaultPrevented).toBe(true)
  })

  it.for(['dialog', 'menu', 'listbox', 'tooltip'])(
    'allows dismiss from app markup with role=%s that no overlay owns',
    (role) => {
      const target = appendLayer((layer) => layer.setAttribute('role', role))
      expect(pointerDownOn(target).defaultPrevented).toBe(false)
    }
  )

  it('allows dismiss from a dialog scrim', () => {
    const target = appendLayer((layer) => {
      layer.dataset.slot = 'dialog-overlay'
    })
    expect(pointerDownOn(target).defaultPrevented).toBe(false)
  })

  it('allows dismiss when target is outside any portaled layer', () => {
    expect(pointerDownOn(document.body).defaultPrevented).toBe(false)
  })

  it('allows dismiss from the empty space beside a toast message', () => {
    const container = document.createElement('ol')
    container.setAttribute('data-testid', 'toast-viewport')
    document.body.appendChild(container)
    onTestFinished(() => container.remove())

    expect(pointerDownOn(container).defaultPrevented).toBe(false)
  })

  it('prevents dismiss when dismissOnPointerDownOutside is false even outside an overlay', () => {
    const event = makeEvent(document.body)
    onRekaPointerDownOutside({ dismissOnPointerDownOutside: false }, event)
    expect(event.defaultPrevented).toBe(true)
  })
})
