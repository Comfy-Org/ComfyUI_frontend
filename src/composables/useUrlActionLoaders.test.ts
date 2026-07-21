import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useUrlActionLoaders } from './useUrlActionLoaders'

const mockIsCloud = vi.hoisted(() => ({ value: true }))
vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

const mockFlags = vi.hoisted(() => ({ value: { teamWorkspacesEnabled: true } }))
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ flags: mockFlags.value })
}))

const mocks = vi.hoisted(() => ({
  loadInvite: vi.fn().mockResolvedValue(undefined),
  loadCreateWorkspace: vi.fn().mockResolvedValue(undefined),
  loadPricingTable: vi.fn().mockResolvedValue(undefined),
  useInvite: vi.fn(),
  useCreateWorkspace: vi.fn(),
  usePricingTable: vi.fn()
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

describe('useUrlActionLoaders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsCloud.value = true
    mockFlags.value = { teamWorkspacesEnabled: true }
  })

  it('does not instantiate or run any loader off cloud', async () => {
    mockIsCloud.value = false

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.useInvite).not.toHaveBeenCalled()
    expect(mocks.useCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.usePricingTable).not.toHaveBeenCalled()
    expect(mocks.loadInvite).not.toHaveBeenCalled()
    expect(mocks.loadCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadPricingTable).not.toHaveBeenCalled()
  })

  it('runs all loaders on cloud when team workspaces are enabled', async () => {
    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
  })

  it('runs the pricing loader but skips the flag-gated loaders when team workspaces are disabled', async () => {
    mockFlags.value = { teamWorkspacesEnabled: false }

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await runUrlActionLoaders()

    expect(mocks.loadInvite).not.toHaveBeenCalled()
    expect(mocks.loadCreateWorkspace).not.toHaveBeenCalled()
    expect(mocks.loadPricingTable).toHaveBeenCalledOnce()
  })

  it('isolates a pricing-loader failure so it does not abort the boot chain', async () => {
    mocks.loadPricingTable.mockRejectedValueOnce(new Error('boom'))

    const { runUrlActionLoaders } = useUrlActionLoaders()
    await expect(runUrlActionLoaders()).resolves.toBeUndefined()

    expect(mocks.loadInvite).toHaveBeenCalledOnce()
    expect(mocks.loadCreateWorkspace).toHaveBeenCalledOnce()
  })
})
