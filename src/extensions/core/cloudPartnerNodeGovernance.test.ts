import { beforeEach, describe, expect, it, vi } from 'vitest'

const registerExtension = vi.hoisted(() => vi.fn())
const usePartnerNodeGovernanceStore = vi.hoisted(() => vi.fn())

vi.mock('@/platform/workspace/stores/partnerNodeGovernanceStore', () => ({
  usePartnerNodeGovernanceStore
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension })
}))

describe('cloudPartnerNodeGovernance', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('initializes governance during Cloud setup', async () => {
    await import('./cloudPartnerNodeGovernance')

    expect(registerExtension).toHaveBeenCalledOnce()
    const extension = registerExtension.mock.calls[0]?.[0] as {
      name: string
      setup: () => void
    }
    expect(extension.name).toBe('Comfy.Cloud.PartnerNodeGovernance')

    extension.setup()

    expect(usePartnerNodeGovernanceStore).toHaveBeenCalledOnce()
  })
})
