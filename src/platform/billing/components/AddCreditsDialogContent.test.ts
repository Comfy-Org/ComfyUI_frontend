import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi
} from 'vitest'
import { computed, nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { readAutoTopUpActivation } from '@/platform/billing/addCredits/autoTopUpActivation'
import { billingApi } from '@/platform/billing/api/billingApi'
import {
  autoTopUpCard,
  loadedAutoTopUp
} from '@/platform/billing/composables/__mocks__/useBillingAutoTopUpCard'
import {
  autoTopUpEnabledFact,
  canManageAutoTopUpFact
} from '@/platform/billing/composables/__mocks__/useBillingCapabilities'
import { useBillingAutoTopUpCard } from '@/platform/billing/composables/useBillingAutoTopUpCard'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'
import { setLocalBillingWebEnabled } from '@/platform/billing/localBillingWebEnabled'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { mockBillingContext } from '@/platform/billing/__tests__/mockBillingContext'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import type { BillingTab } from '@/platform/billing/billingTab'
import type { watchForTopupBalanceUpdate } from '@/platform/billing/composables/topupBalanceRefresh'
import type { issueLocalBillingHandoff } from '@/platform/billing/localBillingHandoff'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useDialogStore } from '@/stores/dialogStore'

import AddCreditsDialogContent from './AddCreditsDialogContent.vue'

type BalanceIncreased = Parameters<
  typeof watchForTopupBalanceUpdate
>[0]['onBalanceIncreased']

const RETURN_URL = 'https://billing.comfy.org/return/topup'
const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/cs_1'

const hoisted = vi.hoisted(() => ({
  createHostedCheckout: vi.fn(),
  setupUrl: vi.fn<() => Promise<string | null>>(),
  balanceIncreased: undefined as BalanceIncreased,
  issueHandoff: vi.fn<typeof issueLocalBillingHandoff>(),
  handoffTabs: [] as (BillingTab | null)[],
  reopenTopUp: vi.fn<() => Promise<unknown>>(async () => undefined)
}))

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/billing/api/billingApi'))
vi.mock(import('@/platform/billing/addCredits/autoTopUpActivation'), {
  spy: true
})
vi.mock(import('@/platform/billing/composables/useBillingContext'))
vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/billing/composables/useBillingAutoTopUpCard'))
vi.mock(import('@/platform/workspace/utils/platformLink'), () => ({
  platformLink: (path) => `https://platform.test${path}`
}))
vi.mock(
  import('@/platform/billing/composables/useTopupOperation'),
  async () => {
    const { computed } = await import('vue')
    return {
      useTopupOperation: () => ({
        billingClient: 'sdk',
        isAddingCredits: computed(() => false),
        topupOperation: computed(() => undefined),
        topup: vi.fn(),
        createHostedCheckout: hoisted.createHostedCheckout,
        dismissOperation: vi.fn(),
        adoptPendingOperation: vi.fn(),
        quoteTopup: async () => 10_550
      })
    }
  }
)
vi.mock(
  import('@/platform/billing/composables/useProcessingTopupPayment'),
  async () => {
    const { computed } = await import('vue')
    return {
      useProcessingTopupPayment: () => ({ payment: computed(() => null) })
    }
  }
)
vi.mock(
  import('@/platform/billing/composables/useAutoTopUpSetupOffer'),
  () => ({
    useAutoTopUpSetupOffer: () => ({
      setupUrl: hoisted.setupUrl,
      track: vi.fn(),
      trackDeclined: vi.fn()
    })
  })
)
vi.mock(
  import('@/platform/billing/composables/useTopUpPlanCreditCopy'),
  async () => {
    const { computed } = await import('vue')
    return { useAddCreditsPlanLine: () => computed(() => undefined) }
  }
)
vi.mock(import('@/platform/billing/composables/usePendingTopup'), () => ({
  usePendingTopup: () => ({
    startPendingTopup: vi.fn(),
    consumeCompletedTopup: vi.fn(),
    pendingTopupNeedsRefresh: vi.fn(),
    clearPendingTopup: vi.fn()
  })
}))
vi.mock(import('@/platform/billing/composables/topupBalanceRefresh'), () => ({
  watchForTopupBalanceUpdate: ({ onBalanceIncreased }) => {
    hoisted.balanceIncreased = onBalanceIncreased
    return () => {}
  }
}))
vi.mock(import('@/platform/billing/topupCheckoutReturnUrl'), () => ({
  topupCheckoutReturnUrl: () => RETURN_URL
}))
vi.mock(import('@/platform/billing/billingTab'), () => ({
  reserveBillingTab: () => ({ navigate: vi.fn(), close: vi.fn() })
}))
vi.mock(
  import('@/platform/billing/subscription/composables/billingDialogsAccess'),
  () => ({
    provideBillingDialogs: vi.fn(),
    useBillingDialogsAccess: () => ({
      showTopUpCreditsDialog: hoisted.reopenTopUp,
      showSubscriptionRequiredDialog: vi.fn(),
      showDowngradeToPersonalDialog: vi.fn()
    })
  })
)
vi.mock(import('@/platform/billing/localBillingHandoff'), () => ({
  issueLocalBillingHandoff: hoisted.issueHandoff,
  reserveBillingHandoffTab: () => hoisted.handoffTabs.shift() ?? null
}))

vi.mock(import('firebase/auth'), { spy: true })

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function servedCheckout(
  fields: Partial<HostedTopupCheckout>
): HostedTopupCheckout {
  return {
    session_id: 'cs_1',
    amount_cents: 5000,
    payment_amount_cents: 5000,
    state: 'fulfilled',
    ...fields
  }
}

function renderDialog({
  atCheckout,
  inGlobalDialog = false
}: {
  atCheckout: boolean
  inGlobalDialog?: boolean
}) {
  vi.mocked(useFeatureFlags().flags).billingAutoTopUpAtCheckoutEnabled =
    atCheckout
  const capabilities = useBillingCapabilities()
  capabilities.autoTopUpEnabled = autoTopUpEnabledFact(true)
  capabilities.canManageAutoTopUp = canManageAutoTopUpFact(true)
  capabilities.autoTopUpSetup = computed(() => ({ state: 'ready' }))
  vi.mocked(useBillingAutoTopUpCard).mockReturnValue(
    autoTopUpCard(loadedAutoTopUp('off'))
  )
  vi.mocked(useBillingSdkStore().readPaymentMethods).mockResolvedValue({
    status: 'ok',
    value: []
  })
  mockBillingContext()
  if (inGlobalDialog) showTopUpDialog()
  const { unmount } = render(
    inGlobalDialog ? GlobalDialog : AddCreditsDialogContent,
    { global: { plugins: [i18n] } }
  )
  return { user: userEvent.setup(), unmount }
}

function showTopUpDialog() {
  useDialogStore().showDialog({
    key: 'top-up-credits',
    component: AddCreditsDialogContent,
    dialogComponentProps: { headless: true }
  })
}

const ACTIVATED_CHECKOUT: Partial<HostedTopupCheckout> = {
  auto_top_up_activation: 'on',
  auto_top_up: {
    threshold_credits: 1000,
    target_credits: 11_550,
    monthly_budget_cents: 6_000_000,
    monthly_budget_is_default: true
  }
}

function switchWorkspaceInThisTab() {
  const workspaces = useTeamWorkspaceStore()
  const identity = workspaces.identityGeneration
  const transition = workspaces.workspaceTransitionGeneration
  const listClosed = new Error('workspace list closed by the test')
  let closeList!: (error: Error) => void
  vi.spyOn(workspaceApi, 'list').mockReturnValue(
    new Promise((_, reject) => {
      closeList = reject
    })
  )
  const switching = workspaces
    .switchWorkspace('ws-other')
    .catch((error: unknown) => error)
  expect.soft(workspaces.identityGeneration).toBe(identity)
  expect.soft(workspaces.workspaceTransitionGeneration).toBe(transition + 1)
  async function releaseSwitch() {
    closeList(listClosed)
    expect(await switching).toBe(listClosed)
  }
  return releaseSwitch
}

function checkbox() {
  return screen.queryByRole('checkbox', { name: /Turn on auto top-up/ })
}

function continueButton() {
  return screen.getByRole('button', { name: 'Continue' })
}

async function payWithAutoTopUp(served: Partial<HostedTopupCheckout>) {
  const rendered = renderDialog({ atCheckout: true })
  vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
    servedCheckout(served)
  )
  await rendered.user.click(
    await screen.findByRole('checkbox', { name: /Turn on auto top-up/ })
  )
  await rendered.user.click(continueButton())
  await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
  return rendered
}

describe('AddCreditsDialogContent auto top-up with the purchase', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    hoisted.balanceIncreased = undefined
    hoisted.setupUrl.mockResolvedValue(null)
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
  })

  it('offers no checkbox and sends no settings with billing_auto_top_up_at_checkout_enabled off', async () => {
    const { user } = renderDialog({ atCheckout: false })
    expect(checkbox()).toBeNull()

    await user.click(continueButton())
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
    await hoisted.balanceIncreased!()

    expect(hoisted.createHostedCheckout).toHaveBeenCalledWith(
      5000,
      RETURN_URL,
      expect.any(AbortSignal),
      undefined
    )
    expect(billingApi.getTopupCheckout).not.toHaveBeenCalled()
  })

  it('sends the checked settings and shows auto top-up on from the served checkout', async () => {
    await payWithAutoTopUp(ACTIVATED_CHECKOUT)
    await hoisted.balanceIncreased!()

    expect(hoisted.createHostedCheckout).toHaveBeenCalledWith(
      5000,
      RETURN_URL,
      expect.any(AbortSignal),
      {
        threshold_credits: 1000,
        target_credits: 11_550,
        monthly_budget_cents: null
      }
    )
    expect(billingApi.getTopupCheckout).toHaveBeenCalledWith(
      'cs_1',
      expect.any(AbortSignal)
    )
    expect(
      await screen.findByTestId('add-credits-auto-top-up-on')
    ).toBeVisible()
  })

  it('shows the served activation failure', async () => {
    await payWithAutoTopUp({ auto_top_up_activation: 'failed' })
    await hoisted.balanceIncreased!()

    expect(
      await screen.findByTestId('add-credits-auto-top-up-failed')
    ).toBeVisible()
    expect(screen.queryByTestId('add-credits-auto-top-up-on')).toBeNull()
  })

  it('drops the shown Set up link once local billing opens through a handoff', async () => {
    onTestFinished(() => setLocalBillingWebEnabled(false))
    hoisted.setupUrl.mockResolvedValue(
      'https://platform.test/profile/billing?auto_top_up=setup'
    )
    await payWithAutoTopUp({ auto_top_up_activation: 'failed' })
    await hoisted.balanceIncreased!()
    const failed = await screen.findByTestId('add-credits-auto-top-up-failed')
    expect(screen.getByRole('link', { name: 'Set up' })).toBeVisible()

    setLocalBillingWebEnabled(true)
    await nextTick()

    expect(failed).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Set up' })).toBeNull()
  })

  it('stops reading a pending activation once the dialog unmounts', async () => {
    const { unmount } = await payWithAutoTopUp({
      auto_top_up_activation: 'pending'
    })
    vi.useFakeTimers()
    const landing = hoisted.balanceIncreased!()
    await vi.advanceTimersByTimeAsync(0)
    expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(1)

    unmount()
    await vi.runAllTimersAsync()
    await landing

    expect(billingApi.getTopupCheckout).toHaveBeenCalledTimes(1)
  })

  it('mints no second checkout once the payment landed and its activation is still being read', async () => {
    const { user } = await payWithAutoTopUp({})
    let serve!: (checkout: HostedTopupCheckout) => void
    vi.mocked(billingApi.getTopupCheckout).mockReturnValue(
      new Promise((resolve) => {
        serve = resolve
      })
    )
    const landing = hoisted.balanceIncreased!()
    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledOnce()
    )

    await user.click(screen.getByTestId('add-credits-reopen'))

    expect(hoisted.createHostedCheckout).toHaveBeenCalledOnce()
    expect(screen.getByTestId('add-credits-reopen')).toBeDisabled()
    serve(servedCheckout({ auto_top_up_activation: 'not_attempted' }))
    await landing
  })

  it('drops a pending activation read once this tab switches workspace', async () => {
    await payWithAutoTopUp({})
    let serve!: (checkout: HostedTopupCheckout) => void
    vi.mocked(billingApi.getTopupCheckout).mockReturnValue(
      new Promise((resolve) => {
        serve = resolve
      })
    )
    const landing = hoisted.balanceIncreased!()
    await waitFor(() =>
      expect(billingApi.getTopupCheckout).toHaveBeenCalledOnce()
    )

    const releaseSwitch = switchWorkspaceInThisTab()
    try {
      serve(servedCheckout(ACTIVATED_CHECKOUT))
      await landing

      expect(screen.queryByTestId('add-credits-auto-top-up-on')).toBeNull()
      expect(billingApi.getTopupCheckout).toHaveBeenCalledOnce()
    } finally {
      await releaseSwitch()
    }
  })

  it('drops a failed activation once this tab switches workspace while its setup link is read', async () => {
    let serveLink!: (url: string | null) => void
    hoisted.setupUrl.mockReturnValue(
      new Promise((resolve) => {
        serveLink = resolve
      })
    )
    await payWithAutoTopUp({ auto_top_up_activation: 'failed' })
    await hoisted.balanceIncreased!()
    await waitFor(() => expect(hoisted.setupUrl).toHaveBeenCalledOnce())

    const releaseSwitch = switchWorkspaceInThisTab()
    try {
      serveLink('https://platform.test/profile/billing?auto_top_up=setup')
      await vi.advanceTimersByTimeAsync(0)
      await nextTick()

      expect(screen.queryByTestId('add-credits-auto-top-up-failed')).toBeNull()
    } finally {
      await releaseSwitch()
    }
  })

  it('publishes no activation when the identity resets after the read settles', async () => {
    await payWithAutoTopUp({})
    vi.mocked(readAutoTopUpActivation).mockImplementationOnce(async () => {
      useTeamWorkspaceStore().resetForIdentityChange()
      return {
        status: 'on',
        settings: {
          threshold_credits: 1000,
          target_credits: 11_550,
          monthly_budget_cents: null
        }
      }
    })

    await hoisted.balanceIncreased!()
    await nextTick()

    expect(screen.queryByTestId('add-credits-auto-top-up-on')).toBeNull()
  })

  it('drops a checkout minted for the workspace this tab left', async () => {
    const { user } = renderDialog({ atCheckout: true })
    vi.mocked(billingApi.getTopupCheckout).mockResolvedValue(
      servedCheckout(ACTIVATED_CHECKOUT)
    )
    let mint!: (session: { url: string; sessionId: string }) => void
    hoisted.createHostedCheckout.mockReturnValue(
      new Promise((resolve) => {
        mint = resolve
      })
    )
    await user.click(
      await screen.findByRole('checkbox', { name: /Turn on auto top-up/ })
    )
    await user.click(continueButton())
    await waitFor(() =>
      expect(hoisted.createHostedCheckout).toHaveBeenCalledOnce()
    )

    const releaseSwitch = switchWorkspaceInThisTab()
    try {
      mint({ url: CHECKOUT_URL, sessionId: 'cs_1' })

      expect(await screen.findByText("Couldn't open checkout")).toBeVisible()
      expect(hoisted.balanceIncreased).toBeUndefined()
    } finally {
      await releaseSwitch()
    }
  })
})

describe('AddCreditsDialogContent on local web with local_billing_web on', () => {
  const ENTRY_URL = 'https://billing.comfy.org/handoff?intent=top-up#token=t'

  function handoffTab(): BillingTab {
    return { navigate: vi.fn(), close: vi.fn() }
  }

  beforeEach(() => {
    stubFirebaseAuthHarness()
    setLocalBillingWebEnabled(true)
    hoisted.issueHandoff.mockResolvedValue({ status: 'ok', url: ENTRY_URL })
  })

  afterEach(() => {
    setLocalBillingWebEnabled(false)
    hoisted.handoffTabs = []
  })

  it.for<{
    name: string
    choose: (user: UserEvent) => Promise<void>
    amountCents: number
  }>([
    {
      name: 'a preset',
      choose: (user) => user.click(screen.getByRole('radio', { name: '$25' })),
      amountCents: 2500
    },
    {
      name: 'a typed amount',
      choose: (user) =>
        user.type(screen.getByLabelText('Or enter an amount'), '120'),
      amountCents: 12_000
    }
  ])(
    'Continue opens billing-web through a handoff for $name',
    async ({ choose, amountCents }) => {
      const tab = handoffTab()
      hoisted.handoffTabs = [tab]
      const { user } = renderDialog({ atCheckout: true })

      await choose(user)
      await user.click(continueButton())

      expect(
        await screen.findByRole('heading', {
          name: 'Checkout opened in a new tab'
        })
      ).toBeVisible()
      expect(hoisted.issueHandoff).toHaveBeenCalledExactlyOnceWith(
        { intent: 'top-up', amountCents },
        expect.any(AbortSignal)
      )
      expect(tab.navigate).toHaveBeenCalledExactlyOnceWith(ENTRY_URL)
      expect(hoisted.createHostedCheckout).not.toHaveBeenCalled()
      expect(checkbox()).toBeNull()
    }
  )

  it('issues a fresh handoff from the blocked step instead of showing a link', async () => {
    const tab = handoffTab()
    hoisted.handoffTabs = [null, tab]
    const { user } = renderDialog({ atCheckout: false })

    await user.click(continueButton())
    const open = await screen.findByTestId('add-credits-open-checkout')

    expect(hoisted.issueHandoff).not.toHaveBeenCalled()
    expect(open).not.toHaveAttribute('href')

    await user.click(open)

    await waitFor(() =>
      expect(tab.navigate).toHaveBeenCalledExactlyOnceWith(ENTRY_URL)
    )
    expect(hoisted.issueHandoff).toHaveBeenCalledExactlyOnceWith(
      { intent: 'top-up', amountCents: 5000 },
      expect.any(AbortSignal)
    )
  })

  it('shows the refusal in the dialog and closes the tab', async () => {
    const tab = handoffTab()
    hoisted.handoffTabs = [tab]
    hoisted.issueHandoff.mockResolvedValue({
      status: 'error',
      message: 'Only the workspace owner can add credits.'
    })
    const { user } = renderDialog({ atCheckout: false })

    await user.click(continueButton())

    const notice = await screen.findByTestId('add-credits-notice')
    expect(notice).toHaveTextContent("Couldn't open checkout")
    expect(notice).toHaveTextContent(
      'Only the workspace owner can add credits.'
    )
    expect(tab.close).toHaveBeenCalledOnce()
    expect(tab.navigate).not.toHaveBeenCalled()
  })

  it.for<{
    name: string
    tabs: (tab: BillingTab) => (BillingTab | null)[]
    reach: (user: UserEvent) => Promise<HTMLElement>
  }>([
    {
      name: 'Continue',
      tabs: (tab) => [tab],
      reach: async () => continueButton()
    },
    {
      name: 'the blocked step',
      tabs: (tab) => [null, tab],
      reach: async (user) => {
        await user.click(continueButton())
        return screen.findByTestId('add-credits-open-checkout')
      }
    }
  ])(
    'issues nothing from $name once local_billing_web turns off, and reopens Add credits for the current flag',
    async ({ tabs, reach }) => {
      const tab = handoffTab()
      hoisted.handoffTabs = tabs(tab)
      const { user } = renderDialog({ atCheckout: false })
      const action = await reach(user)

      setLocalBillingWebEnabled(false)
      await user.click(action)

      await waitFor(() => expect(hoisted.reopenTopUp).toHaveBeenCalledOnce())
      expect(hoisted.reopenTopUp).toHaveBeenCalledWith({
        isInsufficientCredits: false,
        source: undefined
      })
      expect(hoisted.issueHandoff).not.toHaveBeenCalled()
      expect(tab.close).toHaveBeenCalledOnce()
      expect(tab.navigate).not.toHaveBeenCalled()
    }
  )

  it('reopens a fresh Add credits dialog that runs the flag-off checkout', async () => {
    hoisted.handoffTabs = [handoffTab()]
    hoisted.reopenTopUp.mockImplementation(async () => showTopUpDialog())
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    const { user } = renderDialog({ atCheckout: false, inGlobalDialog: true })
    const firstContinue = await screen.findByRole('button', {
      name: 'Continue'
    })

    setLocalBillingWebEnabled(false)
    await user.click(firstContinue)
    await waitFor(() => expect(hoisted.reopenTopUp).toHaveBeenCalledOnce())
    await user.click(await screen.findByRole('button', { name: 'Continue' }))

    await waitFor(() =>
      expect(hoisted.createHostedCheckout).toHaveBeenCalledOnce()
    )
    expect(hoisted.reopenTopUp).toHaveBeenCalledOnce()
    expect(hoisted.issueHandoff).not.toHaveBeenCalled()
  })

  it('closes the reserved tab and stops issuing when the dialog closes mid-issue', async () => {
    const tab = handoffTab()
    hoisted.handoffTabs = [tab]
    hoisted.issueHandoff.mockImplementation(
      (_request, signal) =>
        new Promise((resolve) =>
          signal.addEventListener('abort', () =>
            resolve({ status: 'error', message: undefined })
          )
        )
    )
    const { user, unmount } = renderDialog({ atCheckout: false })
    await user.click(continueButton())
    const [, signal] = hoisted.issueHandoff.mock.calls[0]

    unmount()

    expect(signal.aborted).toBe(true)
    await waitFor(() => expect(tab.close).toHaveBeenCalledOnce())
    expect(tab.navigate).not.toHaveBeenCalled()
  })
})
