import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import {
  isNodeFromPartnerProvider,
  useNodeDisabledState
} from '@/platform/nodeDisabled/nodeDisabledState'
import type { PartnerProvider } from '@/platform/workspace/api/partnerNodePolicyApi'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'

const provider: PartnerProvider = {
  id: 'openai',
  displayName: 'OpenAI',
  nodeCategories: ['OpenAI']
}

const apiNode = {
  api_node: true,
  category: 'api/image/OpenAI'
} satisfies Pick<ComfyNodeDef, 'api_node' | 'category'>

describe('nodeDisabledState', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
  })

  it('matches API nodes to provider categories', () => {
    expect(isNodeFromPartnerProvider(apiNode, provider)).toBe(true)
    expect(
      isNodeFromPartnerProvider({ ...apiNode, api_node: false }, provider)
    ).toBe(false)
    expect(
      isNodeFromPartnerProvider(
        { ...apiNode, category: 'api/image/Google' },
        provider
      )
    ).toBe(false)
  })

  it('derives disabled state from enforced provider policy', () => {
    const governanceStore = usePartnerNodeGovernanceStore()
    governanceStore.providers = [provider]
    governanceStore.policy = {
      enforcementEnabled: true,
      providers: [{ providerId: provider.id, enabled: false }]
    }
    const { isNodeDisabled } = useNodeDisabledState()

    expect(isNodeDisabled(apiNode)).toBe(true)

    governanceStore.policy = {
      enforcementEnabled: false,
      providers: [{ providerId: provider.id, enabled: false }]
    }
    expect(isNodeDisabled(apiNode)).toBe(false)

    governanceStore.policy = {
      enforcementEnabled: true,
      providers: [{ providerId: provider.id, enabled: true }]
    }
    expect(isNodeDisabled(apiNode)).toBe(false)
  })

  it('disables a governed provider missing from an enforced policy', () => {
    const governanceStore = usePartnerNodeGovernanceStore()
    governanceStore.providers = [provider]
    governanceStore.policy = {
      enforcementEnabled: true,
      providers: []
    }

    expect(useNodeDisabledState().isNodeDisabled(apiNode)).toBe(true)
  })
})
