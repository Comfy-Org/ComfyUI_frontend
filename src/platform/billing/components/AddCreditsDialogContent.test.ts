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

import type { AddCreditsPlanLine } from '@comfyorg/account-core/billing'
import type { HostedTopupCheckout } from '@comfyorg/ingest-types'

import { useTelemetry } from '@comfyorg/telemetry'

import { usdToCredits } from '@/base/credits/comfyCredits'
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
import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import { useBillingSdkStore } from '@/platform/billing/sdk/billingSdkStore'
import {
  setLocalAutoTopUpAtCheckoutEnabled,
  setLocalBillingWebEnabled
} from '@/platform/billing/localBillingWebEnabled'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { mockBillingContext } from '@/platform/billing/__tests__/mockBillingContext'
import {
  clearCheckoutJourney,
  resolveCheckoutJourney
} from '@/platform/billing/utils/checkoutJourney'
import { useAuthStore } from '@/stores/authStore'
import { stubFirebaseAuthHarness } from '@/utils/__tests__/stubAccountIdentityPort'

import type { BillingTab } from '@/platform/billing/billingTab'
import type { BalanceInfo } from '@/platform/billing/composables/types'
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
  openPlatformBilling: vi.fn<() => Promise<void>>(async () => undefined),
  reopenTopUp: vi.fn<() => Promise<unknown>>(async () => undefined),
  cloudTabNavigate: vi.fn<(url: string) => void>(),
  paymentConfigured: true,
  planLine: undefined as AddCreditsPlanLine | undefined,
  openTopupPurchase:
    vi.fn<
      (
        amountCents: number,
        signal: AbortSignal,
        autoTopUp: unknown
      ) => Promise<string | undefined>
    >(),
  billingWebTopupUrl:
    vi.fn<
      (
        amountCents: number,
        autoTopUp: unknown,
        workspaceId: string | undefined,
        purchaseId: string
      ) => string | undefined
    >()
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
        openTopupPurchase: hoisted.openTopupPurchase,
        quoteTopup: async () => ({
          credits: 10_550,
          paymentConfigured: hoisted.paymentConfigured
        })
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
      open: vi.fn(),
      trackDeclined: vi.fn()
    })
  })
)
vi.mock(
  import('@/platform/billing/composables/useTopUpPlanCreditCopy'),
  async () => {
    const { computed } = await import('vue')
    return { useAddCreditsPlanLine: () => computed(() => hoisted.planLine) }
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
vi.mock(import('@/platform/billing/addCredits/billingWebTopup'), () => ({
  billingWebTopupUrl: hoisted.billingWebTopupUrl
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
  openPlatformBillingHandoff: hoisted.openPlatformBilling,
  reserveBillingHandoffTab: () => hoisted.handoffTabs.shift() ?? null
}))

vi.mock(import('firebase/auth'), { spy: true })

function fakeTab() {
  return {
    opener: window as Window | null,
    closed: false,
    focus: vi.fn(),
    close: vi.fn(),
    location: {
      set href(url: string) {
        hoisted.cloudTabNavigate(url)
      }
    }
  }
}

let openedTabs: ReturnType<typeof fakeTab>[] = []

beforeEach(() => {
  openedTabs = []
  vi.spyOn(window, 'open').mockImplementation(() => {
    const tab = fakeTab()
    openedTabs.push(tab)
    return tab as never
  })
})

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

  it('turns the shown Set up link into a button that opens Platform billing through a handoff once local billing uses one', async () => {
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
    await userEvent.click(screen.getByRole('button', { name: 'Set up' }))
    expect(hoisted.openPlatformBilling).toHaveBeenCalledOnce()
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

  it('offers the checkbox when Cloud serves auto top-up at checkout to the local account, carries the ticked settings through the handoff, and after paying sends the owner to Billing instead of claiming it turned on', async () => {
    hoisted.balanceIncreased = undefined
    hoisted.handoffTabs = [handoffTab()]
    setLocalAutoTopUpAtCheckoutEnabled(true)
    onTestFinished(() => setLocalAutoTopUpAtCheckoutEnabled(false))
    const { user } = renderDialog({ atCheckout: false })

    await user.click(
      await screen.findByRole('checkbox', { name: /Turn on auto top-up/ })
    )
    await user.click(continueButton())

    expect(hoisted.issueHandoff).toHaveBeenCalledExactlyOnceWith(
      {
        intent: 'top-up',
        amountCents: 5000,
        autoTopUp: {
          threshold_credits: 1000,
          target_credits: 11_550,
          monthly_budget_cents: null
        }
      },
      expect.any(AbortSignal)
    )
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
    await hoisted.balanceIncreased!()

    expect(
      await screen.findByRole('heading', { name: 'Credits added' })
    ).toBeVisible()
    expect(
      screen.getByText('Open Billing to check that auto top-up is on.')
    ).toBeVisible()
    expect(screen.getByRole('button', { name: /Manage/ })).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Auto top-up is on' })
    ).toBeNull()
    expect(hoisted.setupUrl).not.toHaveBeenCalled()
    expect(hoisted.createHostedCheckout).not.toHaveBeenCalled()
  })

  it('offers no checkbox on local when Cloud does not serve auto top-up at checkout, even with the flag on for Cloud', async () => {
    renderDialog({ atCheckout: true })
    await nextTick()

    expect(billingApi.listSavedPaymentMethods).not.toHaveBeenCalled()
    expect(checkbox()).toBeNull()
  })

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

  it('opens no hosted checkout once local_billing_web turns on under an open dialog, and reopens Add credits for the current flag', async () => {
    setLocalBillingWebEnabled(false)
    const { user } = renderDialog({ atCheckout: false })
    const action = continueButton()

    setLocalBillingWebEnabled(true)
    await user.click(action)

    await waitFor(() => expect(hoisted.reopenTopUp).toHaveBeenCalledOnce())
    expect(hoisted.createHostedCheckout).not.toHaveBeenCalled()
    expect(hoisted.issueHandoff).not.toHaveBeenCalled()
  })

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

describe('AddCreditsDialogContent on Cloud with unified_billing_settings', () => {
  const TOPUP_PAGE = 'https://billing.comfy.org/v1/top-up?amount_cents=5000'

  beforeEach(() => {
    stubFirebaseAuthHarness()
    hoisted.balanceIncreased = undefined
    hoisted.setupUrl.mockResolvedValue(null)
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    hoisted.billingWebTopupUrl.mockReturnValue(TOPUP_PAGE)
    hoisted.paymentConfigured = true
    hoisted.openTopupPurchase.mockReset()
    let purchases = 0
    hoisted.openTopupPurchase.mockImplementation(
      async () => `tpp_${++purchases}`
    )
  })

  afterEach(() => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = false
  })

  it.for<{
    name: string
    on: boolean
    page: string | undefined
    opens: string
    noPurchase?: boolean
    unconfigured?: boolean
  }>([
    {
      name: 'unified_billing_settings on',
      on: true,
      page: TOPUP_PAGE,
      opens: TOPUP_PAGE
    },
    {
      name: 'unified_billing_settings off',
      on: false,
      page: TOPUP_PAGE,
      opens: CHECKOUT_URL
    },
    {
      name: 'unified_billing_settings on but no billing-web entry to build',
      on: true,
      page: undefined,
      opens: CHECKOUT_URL
    },
    {
      name: 'unified_billing_settings on but Cloud opened no purchase',
      on: true,
      page: TOPUP_PAGE,
      opens: CHECKOUT_URL,
      noPurchase: true
    },
    {
      name: 'unified_billing_settings on but the quote names no payment configuration',
      on: true,
      page: TOPUP_PAGE,
      opens: CHECKOUT_URL,
      unconfigured: true
    }
  ])(
    'Continue opens $opens with $name',
    async ({ on, page, opens, noPurchase, unconfigured }) => {
      vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = on
      hoisted.billingWebTopupUrl.mockReturnValue(page)
      hoisted.paymentConfigured = !unconfigured
      if (noPurchase) hoisted.openTopupPurchase.mockResolvedValue(undefined)
      const { user } = renderDialog({ atCheckout: false })

      await user.click(continueButton())

      await waitFor(() =>
        expect(hoisted.cloudTabNavigate).toHaveBeenCalledWith(opens)
      )
      expect(hoisted.createHostedCheckout).toHaveBeenCalledTimes(
        opens === CHECKOUT_URL ? 1 : 0
      )
      if (unconfigured) expect(hoisted.openTopupPurchase).not.toHaveBeenCalled()
    }
  )

  it('carries the ticked auto top-up to billing-web and watches the balance for the payment', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    const { user } = renderDialog({ atCheckout: true })

    await user.click(
      await screen.findByRole('checkbox', { name: /Turn on auto top-up/ })
    )
    await user.click(continueButton())

    await waitFor(() =>
      expect(hoisted.cloudTabNavigate).toHaveBeenCalledWith(TOPUP_PAGE)
    )
    const ticked = {
      threshold_credits: 1000,
      target_credits: 11_550,
      monthly_budget_cents: null
    }
    expect(hoisted.openTopupPurchase).toHaveBeenCalledExactlyOnceWith(
      5000,
      expect.any(AbortSignal),
      ticked
    )
    expect(hoisted.billingWebTopupUrl.mock.calls[0]).toEqual([
      5000,
      ticked,
      undefined,
      'tpp_1'
    ])
    expect(hoisted.createHostedCheckout).not.toHaveBeenCalled()
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
    await hoisted.balanceIncreased!()
    expect(billingApi.getTopupCheckout).not.toHaveBeenCalled()
    expect(
      await screen.findByText('Open Billing to check that auto top-up is on.')
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Auto top-up is on' })
    ).toBeNull()
  })

  it('reads the balance before opening billing-web, so a payment made there counts against the balance from before it', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    const { user } = renderDialog({ atCheckout: false })

    await user.click(continueButton())

    await waitFor(() =>
      expect(hoisted.cloudTabNavigate).toHaveBeenCalledWith(TOPUP_PAGE)
    )
    const [balanceRead] = vi.mocked(useBillingContext().fetchBalance).mock
      .invocationCallOrder
    expect(balanceRead).toBeLessThan(
      hoisted.cloudTabNavigate.mock.invocationCallOrder[0]
    )
  })

  it.for([
    { name: 'billing-web', on: true },
    { name: 'hosted checkout', on: false }
  ])(
    'Reopen on $name opens a new page on a new purchase, which Cloud makes the only payable one',
    async ({ on }) => {
      vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = on
      const { user } = renderDialog({ atCheckout: false })

      await user.click(continueButton())
      await waitFor(() => expect(hoisted.cloudTabNavigate).toHaveBeenCalled())
      await user.click(
        await screen.findByRole('button', { name: 'Reopen checkout' })
      )

      await waitFor(() => expect(openedTabs).toHaveLength(2))
      await waitFor(() =>
        expect(hoisted.cloudTabNavigate).toHaveBeenCalledTimes(2)
      )
      if (on)
        expect(
          hoisted.billingWebTopupUrl.mock.calls.map(([, , , id]) => id)
        ).toEqual(['tpp_1', 'tpp_2'])
      else expect(hoisted.createHostedCheckout).toHaveBeenCalledTimes(2)
    }
  )

  it('recovers a blocked popup on the hosted checkout, so following its link and then Reopen leave no second billing-web page to pay on', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    vi.mocked(window.open).mockReturnValueOnce(null)
    const { user } = renderDialog({ atCheckout: false })

    await user.click(continueButton())
    const link = await screen.findByTestId('add-credits-open-checkout')
    expect(link).toHaveAttribute('href', CHECKOUT_URL)
    await user.click(link)
    await user.click(
      await screen.findByRole('button', { name: 'Reopen checkout' })
    )

    await waitFor(() =>
      expect(hoisted.cloudTabNavigate).toHaveBeenCalledWith(CHECKOUT_URL)
    )
    expect(hoisted.createHostedCheckout).toHaveBeenCalledTimes(2)
    expect(hoisted.cloudTabNavigate).not.toHaveBeenCalledWith(TOPUP_PAGE)
  })

  it('keeps the hosted checkout on Desktop, where the browser tab it opens cannot be found again', async () => {
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = true
    vi.stubGlobal('__comfyDesktop2', {})
    const { user } = renderDialog({ atCheckout: false })

    await user.click(continueButton())

    await waitFor(() =>
      expect(window.open).toHaveBeenCalledWith(CHECKOUT_URL, '_blank')
    )
    expect(hoisted.billingWebTopupUrl).not.toHaveBeenCalled()
  })
})

describe('AddCreditsDialogContent top-up telemetry', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    hoisted.balanceIncreased = undefined
    hoisted.setupUrl.mockResolvedValue(null)
    vi.mocked(useFeatureFlags().flags).unifiedBillingSettingsEnabled = false
    Object.assign(useAuthStore(), { userId: 'user-1' })
    Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: 'workspace-1' })
    clearCheckoutJourney()
    vi.mocked(useTelemetry()!.trackBillingEvent).mockClear()
    vi.mocked(useTelemetry()!.trackCheckoutJourneyEvent).mockClear()
  })

  function trackedBillingEvents() {
    return vi
      .mocked(useTelemetry()!.trackBillingEvent)
      .mock.calls.map(([event]) => `${event.operation}.${event.stage}`)
  }

  function trackedJourneyPhases() {
    return vi
      .mocked(useTelemetry()!.trackCheckoutJourneyEvent)
      .mock.calls.map(([event]) => event.phase)
  }

  it('reports the top-up started and submitted, and leaves its success to the server-confirmed completion that outlives the dialog', async () => {
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    const { user, unmount } = renderDialog({ atCheckout: false })

    await user.click(continueButton())
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())

    expect(useTelemetry()!.trackBillingEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'topup',
        stage: 'started',
        amount_cents: 5000
      })
    )

    await hoisted.balanceIncreased!()
    unmount()

    expect(trackedBillingEvents()).toEqual(['topup.intent', 'topup.started'])
    expect(trackedJourneyPhases()).toEqual(['entered', 'submitted'])
  })

  it.for<{ shown: AddCreditsPlanLine | undefined; reported: string }>([
    { shown: 'no_plan', reported: 'no_plan' },
    { shown: undefined, reported: 'none' }
  ])(
    'reports plan line $reported on the top-up started',
    async ({ shown, reported }) => {
      hoisted.planLine = shown
      onTestFinished(() => {
        hoisted.planLine = undefined
      })
      hoisted.createHostedCheckout.mockResolvedValue({
        url: CHECKOUT_URL,
        sessionId: 'cs_1'
      })
      const { user } = renderDialog({ atCheckout: false })

      await user.click(continueButton())

      await waitFor(() =>
        expect(useTelemetry()!.trackBillingEvent).toHaveBeenCalledWith(
          expect.objectContaining({ stage: 'started', plan_line: reported })
        )
      )
    }
  )

  it('does not count closing the dialog on the opened checkout as abandoning it', async () => {
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    const { user, unmount } = renderDialog({ atCheckout: false })

    await user.click(continueButton())
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
    unmount()

    expect(trackedJourneyPhases()).toEqual(['entered', 'submitted'])
  })

  it('counts closing the dialog as abandoning when the popup was blocked and the checkout link was never followed', async () => {
    vi.mocked(window.open).mockReturnValue(null)
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    const { user, unmount } = renderDialog({ atCheckout: false })

    await user.click(continueButton())
    await screen.findByTestId('add-credits-open-checkout')
    unmount()

    expect(trackedJourneyPhases()).toEqual([
      'entered',
      'submitted',
      'abandoned'
    ])
  })

  it('does not count closing the dialog as abandoning once the blocked checkout link was followed', async () => {
    vi.mocked(window.open).mockReturnValue(null)
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    const { user, unmount } = renderDialog({ atCheckout: false })

    await user.click(continueButton())
    const link = await screen.findByTestId('add-credits-open-checkout')
    link.addEventListener('click', (event) => event.preventDefault())
    await user.click(link)
    unmount()

    expect(trackedJourneyPhases()).toEqual(['entered', 'submitted'])
  })

  it('keeps an opened checkout handed off when a later reopen from the dialog fails', async () => {
    hoisted.createHostedCheckout.mockResolvedValueOnce({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    const { user, unmount } = renderDialog({ atCheckout: false })

    await user.click(continueButton())
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
    hoisted.createHostedCheckout.mockRejectedValueOnce(new Error('offline'))
    await user.click(screen.getByTestId('add-credits-reopen'))
    await waitFor(() =>
      expect(trackedBillingEvents()).toContain('topup.failed')
    )
    unmount()

    expect(trackedJourneyPhases()).toEqual(['entered', 'submitted'])
  })

  it('leaves a journey another checkout took over untouched', async () => {
    hoisted.createHostedCheckout.mockResolvedValue({
      url: CHECKOUT_URL,
      sessionId: 'cs_1'
    })
    const { user, unmount } = renderDialog({ atCheckout: false })
    clearCheckoutJourney()
    resolveCheckoutJourney({
      actorUid: 'user-1',
      workspaceId: 'workspace-1',
      entryFlow: 'initial_subscription',
      entrySource: 'pricing',
      assignment: { status: 'unavailable' }
    })

    await user.click(continueButton())
    await waitFor(() => expect(hoisted.balanceIncreased).toBeDefined())
    unmount()

    expect(trackedJourneyPhases()).toEqual(['entered'])
  })

  it('reports the top-up failed when its checkout cannot open', async () => {
    hoisted.createHostedCheckout.mockRejectedValue(new Error('offline'))
    const { user } = renderDialog({ atCheckout: false })

    await user.click(continueButton())

    await waitFor(() =>
      expect(trackedBillingEvents()).toEqual([
        'topup.intent',
        'topup.started',
        'topup.failed'
      ])
    )
    expect(hoisted.balanceIncreased).toBeUndefined()
  })
})

describe('AddCreditsDialogContent above the served maximum', () => {
  beforeEach(() => {
    stubFirebaseAuthHarness()
    hoisted.setupUrl.mockResolvedValue(null)
  })

  it.for([
    { maxTopupCents: 2000, opening: '20' },
    { maxTopupCents: 500, opening: '5' }
  ])(
    'opens at the served $opening maximum and disables the presets above it',
    ({ maxTopupCents, opening }) => {
      const balance: BalanceInfo = {
        amountMicros: 10_000,
        currency: 'usd',
        effectiveBalanceMicros: 10_000,
        effectiveBalanceAuthoritative: true,
        suggestedTopupAmountCents: null,
        maxTopupCents,
        maxTopupCredits: usdToCredits(maxTopupCents / 100)
      }
      Object.assign(mockBillingContext(), { balance: computed(() => balance) })
      renderDialog({ atCheckout: false })

      expect(screen.getByLabelText('Or enter an amount')).toHaveValue(opening)
      expect(screen.getByRole('radio', { name: '$25' })).toBeDisabled()
      expect(screen.getByRole('radio', { name: '$50' })).toBeDisabled()
      expect(screen.getByRole('radio', { name: '$100' })).toBeDisabled()
    }
  )

  it.for([
    {
      name: 'the server',
      error: new WorkspaceApiError(
        "Amount is above this workspace's top-up limit.",
        400,
        'INVALID_AMOUNT',
        'api_rejected',
        undefined,
        undefined,
        { reason: 'above_max' }
      )
    },
    {
      name: 'the served-max check',
      error: new WorkspaceApiError(
        'Unknown error',
        undefined,
        'INVALID_AMOUNT',
        'validation',
        undefined,
        undefined,
        { reason: 'above_max' }
      )
    }
  ])(
    'explains a checkout $name refuses above the workspace top-up limit',
    async ({ error }) => {
      hoisted.createHostedCheckout.mockRejectedValue(error)
      const { user } = renderDialog({ atCheckout: false })

      await user.click(continueButton())

      const notice = await screen.findByTestId('add-credits-notice')
      expect(notice).toHaveTextContent(
        "This amount is above your workspace's top-up limit."
      )
      expect(notice).toHaveTextContent(
        'Nothing has been charged. Choose a smaller amount, or contact support to raise your limit.'
      )
    }
  )
})
