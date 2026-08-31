import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUrlActionLoaders } from './useUrlActionLoaders'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mocks = vi.hoisted(() => ({
  loadInvite: vi.fn(async () => undefined),
  loadCreateWorkspace: vi.fn(async () => undefined),
  loadPricingTable: vi.fn(async () => undefined),
  loadTopUp: vi.fn(async () => undefined),
  loadSettings: vi.fn(),
  loadPaymentReturn: vi.fn(async () => undefined),
  resumePendingPricingFlow: vi.fn(async () => undefined),
  useInvite: vi.fn(),
  useCreateWorkspace: vi.fn(),
  usePricingTable: vi.fn(),
  useTopUp: vi.fn(),
  useSettings: vi.fn(),
  usePaymentReturn: vi.fn(),
  useSubscriptionDialog: vi.fn()
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
mocks.useSubscriptionDialog.mockImplementation(() => ({
  resumePendingPricingFlow: mocks.resumePendingPricingFlow
}))

vi.mock('@/platform/workspace/composables/useInviteUrlLoader', () => ({
  useInviteUrlLoader: mocks.useInvite
}))
vi.mock('@/platform/workspace/composables/useCreateWorkspaceUrlLoader', () => ({
  useCreateWorkspaceUrlLoader: mocks.useCreateWorkspace
}))
vi.mock(
  '@/platform/cloud/subscription/composables/usePricingTableUrlLoader',
  () => ({ usePricingTableUrlLoader: mocks.usePricingTable })
)
vi.mock('@/platform/cloud/subscription/composables/useTopUpUrlLoader', () => ({
  useTopUpUrlLoader: mocks.useTopUp
}))
vi.mock('@/platform/settings/composables/useSettingsUrlLoader', () => ({
  useSettingsUrlLoader: mocks.useSettings
}))
vi.mock(
  '@/platform/cloud/subscription/composables/usePaymentReturnUrlLoader',
  () => ({ usePaymentReturnUrlLoader: mocks.usePaymentReturn })
)
vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({ useSubscriptionDialog: mocks.useSubscriptionDialog })
)

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
    mocks.useSubscriptionDialog.mockImplementation(() => ({
      resumePendingPricingFlow: mocks.resumePendingPricingFlow
    }))
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
    expect(mocks.useSubscriptionDialog).not.toHaveBeenCalled()
    expect(mocks.loadInvite).not.toHaveBeenCalled()
    expect(mocks.loadCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadPricingTable).not.toHaveBeenCalled()
    expect(mocks.loadTopUp).not.toHaveBeenCalled()
    expect(mocks.loadSettings).not.toHaveBeenCalled()
    expect(mocks.loadPaymentReturn).not.toHaveBeenCalled()
    expect(mocks.resumePendingPricingFlow).not.toHaveBeenCalled()
  })

  it('runs all loaders on Cloud', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
    expect(mocks.loadSettings).toHaveBeenCalledOnce()
    expect(mocks.loadPaymentReturn).toHaveBeenCalledOnce()
  })

  it('recovers an interrupted checkout after handling the payment return', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.resumePendingPricingFlow).toHaveBeenCalledOnce()
    expect(
      mocks.resumePendingPricingFlow.mock.invocationCallOrder[0]
    ).toBeGreaterThan(mocks.loadPaymentReturn.mock.invocationCallOrder[0])
  })

  it('isolates a checkout-recovery failure so it does not abort the boot chain', async () => {
    mocks.resumePendingPricingFlow.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadPaymentReturn).toHaveBeenCalledOnce()
  })

  it('isolates a pricing-loader failure so it does not abort the boot chain', async () => {
    mocks.loadPricingTable.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
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
    expect(mocks.resumePendingPricingFlow).toHaveBeenCalledOnce()
  })
})
