import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'

const {
  mockShowSignInDialog,
  mockShowLayoutDialog,
  mockToastAdd,
  mockInitialize,
  mockFirebaseUser,
  mockActiveWorkspace,
  mockWorkspaceError,
  mockCanManageSubscription,
  mockIsSettingUp,
  mockCurrentTeamCreditStop,
  mockHasPaidCheckoutPlan,
  mockSetDialogOpen
} = vi.hoisted(() => ({
  mockShowSignInDialog: vi.fn(),
  mockShowLayoutDialog: vi.fn(),
  mockToastAdd: vi.fn(),
  mockInitialize: vi.fn(),
  mockFirebaseUser: { value: null as { uid: string } | null },
  mockActiveWorkspace: { value: null as { id: string } | null },
  mockWorkspaceError: { value: null as Error | null },
  mockCanManageSubscription: { value: true },
  mockIsSettingUp: { value: false },
  mockCurrentTeamCreditStop: { value: null as { id: string } | null },
  mockHasPaidCheckoutPlan: { value: false },
  mockSetDialogOpen: { impl: (_value: boolean) => {} }
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    currentTeamCreditStop: {
      get value() {
        return mockCurrentTeamCreditStop.value
      }
    },
    hasPaidCheckoutPlan: {
      get value() {
        return mockHasPaidCheckoutPlan.value
      }
    }
  })
}))

vi.mock('@/stores/authStore', () => ({
  useAuthStore: () => ({
    get currentUser() {
      return mockFirebaseUser.value
    }
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showSignInDialog: mockShowSignInDialog,
    showLayoutDialog: mockShowLayoutDialog
  })
}))

vi.mock('@/stores/dialogStore', async () => {
  const { ref } = await import('vue')
  // A real ref: the composable's sync watch on isDialogOpen needs reactivity.
  const open = ref(false)
  mockSetDialogOpen.impl = (value: boolean) => {
    open.value = value
  }
  return {
    useDialogStore: () => ({
      isDialogOpen: (key: string) =>
        key === 'settings-plan-checkout' && open.value,
      closeDialog: () => {
        open.value = false
      }
    })
  }
})

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    initialize: mockInitialize,
    get activeWorkspace() {
      return mockActiveWorkspace.value
    },
    get error() {
      return mockWorkspaceError.value
    }
  })
}))

vi.mock('@/platform/workspace/stores/billingOperationStore', () => ({
  useBillingOperationStore: () => ({
    get isSettingUp() {
      return mockIsSettingUp.value
    }
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: {
      get value() {
        return { canManageSubscription: mockCanManageSubscription.value }
      }
    }
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: mockToastAdd })
}))

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as Record<string, unknown>),
    useI18n: () => ({
      t: (key: string) => key
    })
  }
})

const PERSONAL = {
  slug: 'standard-annual-v2',
  tierKey: 'standard' as const,
  billingCycle: 'yearly' as const
}

const TEAM_STOP = {
  id: 'team_900',
  usd: 900,
  credits: 189_900,
  discountPercentYearly: 10
}

describe('useSettingsPlansCheckout', () => {
  const scopes: ReturnType<typeof effectScope>[] = []
  async function setup() {
    const { useSettingsPlansCheckout } =
      await import('./useSettingsPlansCheckout')
    const scope = effectScope()
    scopes.push(scope)
    return scope.run(() => useSettingsPlansCheckout())!
  }

  function lastDialogProps() {
    const options = mockShowLayoutDialog.mock.lastCall?.[0] as {
      key: string
      props: { initialCheckout: unknown; onClose: () => void }
    }
    return options
  }

  beforeEach(() => {
    mockFirebaseUser.value = { uid: 'user-1' }
    mockActiveWorkspace.value = { id: 'ws-1' }
    mockWorkspaceError.value = null
    mockCanManageSubscription.value = true
    mockIsSettingUp.value = false
    mockCurrentTeamCreditStop.value = null
    mockHasPaidCheckoutPlan.value = false
    mockShowSignInDialog.mockResolvedValue(true)
    mockInitialize.mockResolvedValue(undefined)
    mockShowLayoutDialog.mockReset()
    mockShowLayoutDialog.mockImplementation(() => mockSetDialogOpen.impl(true))
    mockToastAdd.mockReset()
  })

  afterEach(() => {
    scopes.splice(0).forEach((scope) => scope.stop())
  })

  async function openAndClose(run: () => Promise<void>) {
    const pending = run()
    await vi.waitFor(() => expect(mockShowLayoutDialog).toHaveBeenCalled())
    const { props } = lastDialogProps()
    mockSetDialogOpen.impl(false)
    props.onClose()
    await pending
    return lastDialogProps()
  }

  it('opens the checkout dialog with the exact personal selection', async () => {
    const checkout = await setup()

    const { key, props } = await openAndClose(() =>
      checkout.subscribeToPersonal(PERSONAL)
    )

    expect(key).toBe('settings-plan-checkout')
    expect(props.initialCheckout).toEqual({
      planMode: 'personal',
      planSlug: 'standard-annual-v2',
      tierKey: 'standard',
      billingCycle: 'yearly'
    })
  })

  it('opens the team dialog with the API slug, stop id, discounted price and change flag', async () => {
    const checkout = await setup()
    mockCurrentTeamCreditStop.value = { id: 'team_300' }

    const { props } = await openAndClose(() =>
      checkout.subscribeToTeam({
        slug: 'team-annual-catalog',
        stop: TEAM_STOP,
        billingCycle: 'yearly'
      })
    )

    expect(props.initialCheckout).toEqual({
      planMode: 'team',
      planSlug: 'team-annual-catalog',
      billingCycle: 'yearly',
      stop: { id: 'team_900', usd: 900, credits: 189_900, discountedUsd: 810 },
      isChange: true
    })
  })

  it('halves the yearly discount for a monthly team stop and marks a fresh team subscribe as new', async () => {
    const checkout = await setup()

    const { props } = await openAndClose(() =>
      checkout.subscribeToTeam({
        slug: 'team-monthly-catalog',
        stop: TEAM_STOP,
        billingCycle: 'monthly'
      })
    )

    expect(props.initialCheckout).toMatchObject({
      stop: expect.objectContaining({ discountedUsd: 855 }),
      isChange: false
    })
  })

  // A paid personal subscriber picking a Team stop is a plan change to the
  // backend, so it has to be previewed like any other change.
  it('marks a paid personal subscriber choosing a team stop as a change', async () => {
    const checkout = await setup()
    mockHasPaidCheckoutPlan.value = true

    const { props } = await openAndClose(() =>
      checkout.subscribeToTeam({
        slug: 'team-annual-catalog',
        stop: TEAM_STOP,
        billingCycle: 'yearly'
      })
    )

    expect(props.initialCheckout).toMatchObject({ isChange: true })
  })

  // Off Cloud the account rail reports every user entitled, so an unsubscribed
  // legacy-Stripe workspace must read its "no paid plan" from the checkout rail
  // or its first team subscribe would be previewed as a plan change.
  it('marks an unsubscribed user choosing a team stop as a fresh subscribe', async () => {
    const checkout = await setup()

    const { props } = await openAndClose(() =>
      checkout.subscribeToTeam({
        slug: 'team-annual-catalog',
        stop: TEAM_STOP,
        billingCycle: 'yearly'
      })
    )

    expect(props.initialCheckout).toMatchObject({ isChange: false })
  })

  it('refuses a team subscribe on a stop without a backend id', async () => {
    const checkout = await setup()

    await checkout.subscribeToTeam({
      slug: 'team-monthly-catalog',
      stop: { usd: 700, credits: 147_700, discountPercentYearly: 10 },
      billingCycle: 'monthly'
    })

    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'subscription.teamPlan.name',
      detail: 'subscription.teamPlan.unavailable'
    })
  })

  it('routes an api-key-only user through sign-in before opening', async () => {
    const checkout = await setup()
    mockFirebaseUser.value = null

    await openAndClose(() => checkout.subscribeToPersonal(PERSONAL))

    expect(mockShowSignInDialog).toHaveBeenCalledTimes(1)
    expect(mockShowSignInDialog.mock.invocationCallOrder[0]).toBeLessThan(
      mockShowLayoutDialog.mock.invocationCallOrder[0]
    )
  })

  it('opens nothing when the api-key-only user declines sign-in', async () => {
    const checkout = await setup()
    mockFirebaseUser.value = null
    mockShowSignInDialog.mockResolvedValueOnce(false)

    await checkout.subscribeToPersonal(PERSONAL)

    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('skips the sign-in dialog for a Firebase user', async () => {
    const checkout = await setup()

    await openAndClose(() => checkout.subscribeToPersonal(PERSONAL))

    expect(mockShowSignInDialog).not.toHaveBeenCalled()
  })

  it('waits for the workspace to hydrate before opening', async () => {
    const checkout = await setup()
    let hydrate!: () => void
    mockInitialize.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        hydrate = resolve
      })
    )

    const pending = checkout.subscribeToPersonal(PERSONAL)
    await vi.waitFor(() => expect(mockInitialize).toHaveBeenCalledTimes(1))
    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    expect(checkout.isSubscribing.value).toBe(true)

    hydrate()
    await vi.waitFor(() => expect(mockShowLayoutDialog).toHaveBeenCalled())
    mockSetDialogOpen.impl(false)
    lastDialogProps().props.onClose()
    await pending
  })

  it('shows the workspace error and opens nothing when no workspace hydrates', async () => {
    const checkout = await setup()
    mockInitialize.mockRejectedValueOnce(new Error('list failed'))
    mockActiveWorkspace.value = null
    mockWorkspaceError.value = new Error('list failed')

    await checkout.subscribeToPersonal(PERSONAL)

    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'list failed'
    })
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('falls back to the generic failure copy when hydration leaves no error', async () => {
    const checkout = await setup()
    mockActiveWorkspace.value = null

    await checkout.subscribeToPersonal(PERSONAL)

    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'subscription.subscribeFailed'
    })
  })

  it('shows the owner-only error for a member of the workspace', async () => {
    const checkout = await setup()
    mockCanManageSubscription.value = false

    await checkout.subscribeToPersonal(PERSONAL)

    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
    expect(mockToastAdd).toHaveBeenCalledWith({
      severity: 'error',
      summary: 'g.error',
      detail: 'settingsPlans.ownerOnly'
    })
  })

  it('stays locked while the dialog is open and opens nothing for a second click', async () => {
    const checkout = await setup()

    const first = checkout.subscribeToPersonal(PERSONAL)
    await vi.waitFor(() =>
      expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)
    )
    expect(checkout.isSubscribing.value).toBe(true)

    await checkout.subscribeToPersonal(PERSONAL)
    expect(mockShowLayoutDialog).toHaveBeenCalledTimes(1)

    mockSetDialogOpen.impl(false)
    lastDialogProps().props.onClose()
    await first
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('stays locked while sign-in is pending', async () => {
    const checkout = await setup()
    mockFirebaseUser.value = null
    let decide!: (value: boolean) => void
    mockShowSignInDialog.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        decide = resolve
      })
    )

    const pending = checkout.subscribeToPersonal(PERSONAL)
    await vi.waitFor(() => expect(mockShowSignInDialog).toHaveBeenCalled())
    expect(checkout.isSubscribing.value).toBe(true)

    decide(false)
    await pending
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('stays locked while a subscription op is still pending after the dialog closed', async () => {
    const checkout = await setup()
    mockIsSettingUp.value = true

    expect(checkout.isSubscribing.value).toBe(true)
    await checkout.subscribeToPersonal(PERSONAL)

    expect(mockShowLayoutDialog).not.toHaveBeenCalled()
  })

  it('is unlocked at rest before any checkout begins', async () => {
    const checkout = await setup()

    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('keeps the launcher promise pending until the dialog actually closes', async () => {
    const checkout = await setup()
    let settled = false
    const pending = checkout.subscribeToPersonal(PERSONAL).then(() => {
      settled = true
    })
    await vi.waitFor(() => expect(mockShowLayoutDialog).toHaveBeenCalled())

    await Promise.resolve()
    expect(settled, 'promise pending while the dialog is open').toBe(false)
    expect(
      checkout.isSubscribing.value,
      'section locked while the dialog is open'
    ).toBe(true)

    mockSetDialogOpen.impl(false)
    lastDialogProps().props.onClose()
    await pending
    expect(settled).toBe(true)
    expect(checkout.isSubscribing.value).toBe(false)
  })

  it('resolves each checkout once across repeated open/close cycles', async () => {
    const checkout = await setup()
    let resolutions = 0

    for (let cycle = 0; cycle < 2; cycle++) {
      const pending = checkout.subscribeToPersonal(PERSONAL).then(() => {
        resolutions++
      })
      await vi.waitFor(() =>
        expect(mockShowLayoutDialog).toHaveBeenCalledTimes(cycle + 1)
      )
      mockSetDialogOpen.impl(false)
      lastDialogProps().props.onClose()
      await pending
    }

    expect(
      resolutions,
      'each cycle resolves once; a leaked watcher would over-resolve'
    ).toBe(2)
    expect(
      mockShowLayoutDialog,
      'no re-entrancy leak opening a third dialog'
    ).toHaveBeenCalledTimes(2)
  })
})
