import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUrlActionLoaders } from './useUrlActionLoaders'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mocks = vi.hoisted(() => ({
  loadInvite: vi.fn().mockResolvedValue(undefined),
  loadCreateWorkspace: vi.fn().mockResolvedValue(undefined),
  loadPricingTable: vi.fn().mockResolvedValue(undefined),
  loadTopUp: vi.fn().mockResolvedValue(undefined),
  loadPaymentReturn: vi.fn().mockResolvedValue(undefined),
  useInvite: vi.fn(),
  useCreateWorkspace: vi.fn(),
  usePricingTable: vi.fn(),
  useTopUp: vi.fn(),
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
mocks.usePaymentReturn.mockImplementation(() => ({
  loadPaymentReturnFromUrl: mocks.loadPaymentReturn
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
vi.mock(
  '@/platform/cloud/subscription/composables/usePaymentReturnUrlLoader',
  () => ({ usePaymentReturnUrlLoader: mocks.usePaymentReturn })
)

describe('useUrlActionLoaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
  })

  it('does not instantiate or run any loader off cloud', async () => {
    mockIsCloud.value = false

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.useInvite).not.toHaveBeenCalled()
    expect(mocks.useCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.usePricingTable).not.toHaveBeenCalled()
    expect(mocks.useTopUp).not.toHaveBeenCalled()
    expect(mocks.usePaymentReturn).not.toHaveBeenCalled()
    expect(mocks.loadInvite).not.toHaveBeenCalled()
    expect(mocks.loadCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadPricingTable).not.toHaveBeenCalled()
    expect(mocks.loadTopUp).not.toHaveBeenCalled()
    expect(mocks.loadPaymentReturn).not.toHaveBeenCalled()
  })

  it('runs all loaders on Cloud', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
    expect(mocks.loadTopUp).toHaveBeenCalledOnce()
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
    expect(mocks.loadPaymentReturn).toHaveBeenCalledOnce()
  })
})
