import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createMemoryHistory, createRouter, useRouter } from 'vue-router'
import { useSubscriptionDialog } from '@/platform/cloud/subscription/composables/useSubscriptionDialog'

import { useUrlActionLoaders } from './useUrlActionLoaders'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mocks = vi.hoisted(() => ({
  reportError: vi.fn(),
  loadAssets: vi.fn(async () => undefined),
  useAssets: vi.fn(),
  loadInvite: vi.fn(async () => undefined),
  loadCreateWorkspace: vi.fn(async () => undefined),
  loadPricingTable: vi.fn(async () => undefined),
  loadTopUp: vi.fn(async () => undefined),
  loadSettings: vi.fn(),
  loadPaymentReturn: vi.fn(async () => undefined),
  useInvite: vi.fn(),
  useCreateWorkspace: vi.fn(),
  usePricingTable: vi.fn(),
  useTopUp: vi.fn(),
  useSettings: vi.fn(),
  usePaymentReturn: vi.fn()
}))
mocks.useInvite.mockImplementation(() => ({
  loadInviteFromUrl: mocks.loadInvite
}))
mocks.useCreateWorkspace.mockImplementation(() => ({
  loadCreateWorkspaceFromUrl: mocks.loadCreateWorkspace
}))
mocks.usePricingTable.mockImplementation(() => ({
  loadPricingTableFromUrl: mocks.loadPricingTable
}))
mocks.useTopUp.mockImplementation(() => ({
  loadTopUpFromUrl: mocks.loadTopUp
}))
mocks.useSettings.mockImplementation(() => ({
  loadSettingsFromUrl: mocks.loadSettings
}))
mocks.usePaymentReturn.mockImplementation(() => ({
  loadPaymentReturnFromUrl: mocks.loadPaymentReturn
}))
mocks.useAssets.mockImplementation(() => ({
  loadAssetsFromUrl: mocks.loadAssets
}))

// A real router rather than a stub: the assertion is the URL a reader is left
// looking at, and only the real thing resolves and merges a query the way the
// app does.
vi.mock(import('vue-router'), { spy: true })

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
})
vi.mock(import('@/platform/assets/composables/useAssetsUrlLoader'), () => ({
  useAssetsUrlLoader: mocks.useAssets
}))

vi.mock(import('@/platform/workspace/composables/useInviteUrlLoader'), () => ({
  useInviteUrlLoader: mocks.useInvite
}))
vi.mock(
  import('@/platform/workspace/composables/useCreateWorkspaceUrlLoader'),
  () => ({
    useCreateWorkspaceUrlLoader: mocks.useCreateWorkspace
  })
)
vi.mock(
  import('@/platform/cloud/subscription/composables/usePricingTableUrlLoader'),
  () => ({ usePricingTableUrlLoader: mocks.usePricingTable })
)
vi.mock(
  import('@/platform/cloud/subscription/composables/useTopUpUrlLoader'),
  () => ({
    useTopUpUrlLoader: mocks.useTopUp
  })
)
vi.mock(import('@/platform/settings/composables/useSettingsUrlLoader'), () => ({
  useSettingsUrlLoader: mocks.useSettings
}))
vi.mock(
  import('@/platform/cloud/subscription/composables/usePaymentReturnUrlLoader'),
  () => ({ usePaymentReturnUrlLoader: mocks.usePaymentReturn })
)
vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@/platform/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))

describe('useUrlActionLoaders', () => {
  beforeEach(() => {
    mockIsCloud.value = true
    mocks.useInvite.mockImplementation(() => ({
      loadInviteFromUrl: mocks.loadInvite
    }))
    mocks.useCreateWorkspace.mockImplementation(() => ({
      loadCreateWorkspaceFromUrl: mocks.loadCreateWorkspace
    }))
    mocks.usePricingTable.mockImplementation(() => ({
      loadPricingTableFromUrl: mocks.loadPricingTable
    }))
    mocks.useTopUp.mockImplementation(() => ({
      loadTopUpFromUrl: mocks.loadTopUp
    }))
    mocks.useSettings.mockImplementation(() => ({
      loadSettingsFromUrl: mocks.loadSettings
    }))
    mocks.usePaymentReturn.mockImplementation(() => ({
      loadPaymentReturnFromUrl: mocks.loadPaymentReturn
    }))
    mocks.useAssets.mockImplementation(() => ({
      loadAssetsFromUrl: mocks.loadAssets
    }))
    vi.mocked(useRouter).mockReturnValue(router)
  })

  // Most loaders fire their cleanup replace without waiting for it, so with two
  // deep links in one URL the later navigation cancels the earlier one and its
  // param survives. The sweep at the end is what the reader actually sees.
  it('clears a param an earlier loader raced away, leaving the rest alone', async () => {
    await router.replace({
      path: '/',
      query: { topup: '1', assets: '1', workflow: 'keep-me' }
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workflow: 'keep-me' })
  })

  // The payment-return loader clears Stripe's params with history.replaceState,
  // which the router never sees, so the sweep is built from a query that still
  // holds them — the client secret included.
  it('does not hand back the Stripe params the router still thinks are there', async () => {
    await router.replace({
      path: '/',
      query: {
        assets: '1',
        payment_intent: 'pi_123',
        payment_intent_client_secret: 'pi_123_secret_456',
        redirect_status: 'succeeded'
      }
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({})
  })

  it('keeps a query that carries no deep-link param', async () => {
    await router.replace({ path: '/', query: { workflow: 'keep-me' } })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(router.currentRoute.value.query).toEqual({ workflow: 'keep-me' })
  })

  it('does not instantiate or run any loader off cloud', async () => {
    mockIsCloud.value = false

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.useInvite).not.toHaveBeenCalled()
    expect(mocks.useCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.usePricingTable).not.toHaveBeenCalled()
    expect(mocks.useTopUp).not.toHaveBeenCalled()
    expect(mocks.useSettings).not.toHaveBeenCalled()
    expect(mocks.usePaymentReturn).not.toHaveBeenCalled()
    expect(useSubscriptionDialog).not.toHaveBeenCalled()
    expect(mocks.useAssets).not.toHaveBeenCalled()
    expect(mocks.loadInvite).not.toHaveBeenCalled()
    expect(mocks.loadCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadPricingTable).not.toHaveBeenCalled()
    expect(mocks.loadTopUp).not.toHaveBeenCalled()
    expect(mocks.loadSettings).not.toHaveBeenCalled()
    expect(mocks.loadAssets).not.toHaveBeenCalled()
    expect(mocks.loadPaymentReturn).not.toHaveBeenCalled()
    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).not.toHaveBeenCalled()
  })

  it('runs all loaders on Cloud', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
    expect(mocks.loadAssets).toHaveBeenCalledOnce()
    expect(mocks.loadSettings).toHaveBeenCalledOnce()
    expect(mocks.loadPaymentReturn).toHaveBeenCalledOnce()
  })

  it('recovers an interrupted checkout after handling the payment return', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
    expect(
      vi.mocked(useSubscriptionDialog().resumePendingPricingFlow).mock
        .invocationCallOrder[0]
    ).toBeGreaterThan(mocks.loadPaymentReturn.mock.invocationCallOrder[0])
  })

  it('resolves without waiting for checkout recovery to settle', async () => {
    vi.mocked(
      useSubscriptionDialog().resumePendingPricingFlow
    ).mockImplementationOnce(() => new Promise<undefined>(() => {}))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
  })

  it('reports a checkout-recovery failure instead of rejecting unhandled', async () => {
    const failure = new Error('boom')
    vi.mocked(
      useSubscriptionDialog().resumePendingPricingFlow
    ).mockRejectedValueOnce(failure)

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadPaymentReturn).toHaveBeenCalledOnce()
    await vi.waitFor(() => {
      expect(mocks.reportError).toHaveBeenCalledWith(failure, {
        errorType: 'billing_pending_checkout_resume_failure'
      })
    })
  })

  it('isolates a pricing-loader failure so it does not abort the boot chain', async () => {
    mocks.loadPricingTable.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
    expect(mocks.loadAssets).toHaveBeenCalledOnce()
  })

  it('isolates a top-up-loader failure so it does not abort the boot chain', async () => {
    mocks.loadTopUp.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
    expect(mocks.loadSettings).toHaveBeenCalledOnce()
    expect(mocks.loadPaymentReturn).toHaveBeenCalledOnce()
  })

  it('isolates a settings-loader failure so it does not abort the boot chain', async () => {
    mocks.loadSettings.mockImplementationOnce(() => {
      throw new Error('boom')
    })

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadPaymentReturn).toHaveBeenCalledOnce()
    expect(
      useSubscriptionDialog().resumePendingPricingFlow
    ).toHaveBeenCalledOnce()
  })
})
