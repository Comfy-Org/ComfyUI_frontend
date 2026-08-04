import { computed } from 'vue'

import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { PartnerProvider } from '@/platform/workspace/api/partnerNodePolicyApi'
import { usePartnerNodeGovernanceStore } from '@/platform/workspace/stores/partnerNodeGovernanceStore'
import { getProviderName } from '@/utils/categoryUtil'

type NodeDisabledInput = Pick<ComfyNodeDef, 'api_node' | 'category'>

// TODO: Remove isNodeFromPartnerProvider once object_info.disabled is available.
export function isNodeFromPartnerProvider(
  nodeDef: NodeDisabledInput,
  provider: PartnerProvider
): boolean {
  return (
    nodeDef.api_node === true &&
    provider.nodeCategories.includes(getProviderName(nodeDef.category))
  )
}

export function useNodeDisabledState() {
  const governanceStore = usePartnerNodeGovernanceStore()
  const disabledNodeCategories = computed(() => {
    if (governanceStore.policy?.enforcementEnabled !== true) {
      return new Set<string>()
    }

    return new Set(
      governanceStore.providers
        .filter(({ id }) => !governanceStore.isProviderEnabled(id))
        .flatMap(({ nodeCategories }) => nodeCategories)
    )
  })

  function isNodeDisabled(nodeDef: NodeDisabledInput): boolean {
    return (
      nodeDef.api_node === true &&
      disabledNodeCategories.value.has(getProviderName(nodeDef.category))
    )
  }

  return { isNodeDisabled }
}
