import { computed, watch } from 'vue'
import type { ComputedRef } from 'vue'

import { LiteGraph } from '@/lib/litegraph/src/litegraph'
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
  let disabledNodeCategories: ComputedRef<Set<string>> | undefined

  function getDisabledNodeCategories() {
    if (disabledNodeCategories) return disabledNodeCategories

    const governanceStore = usePartnerNodeGovernanceStore()
    disabledNodeCategories = computed(() => {
      if (governanceStore.policy?.enforcementEnabled !== true) {
        return new Set<string>()
      }

      return new Set(
        governanceStore.providers
          .filter(({ id }) => !governanceStore.isProviderEnabled(id))
          .flatMap(({ nodeCategories }) => nodeCategories)
      )
    })
    return disabledNodeCategories
  }

  function isNodeDisabled(nodeDef: NodeDisabledInput): boolean {
    return (
      nodeDef.api_node === true &&
      getDisabledNodeCategories().value.has(getProviderName(nodeDef.category))
    )
  }

  return { isNodeDisabled, getDisabledNodeCategories }
}

let listDisabledSyncStarted = false

// Registered node types carry list_disabled as a static, stamped at
// registration time — re-stamp them whenever the policy changes so the
// legacy add-node menu stays correct regardless of load order.
export function startListDisabledSync(): void {
  if (listDisabledSyncStarted) return
  listDisabledSyncStarted = true

  const { isNodeDisabled, getDisabledNodeCategories } = useNodeDisabledState()
  watch(
    getDisabledNodeCategories(),
    () => {
      for (const ctor of Object.values(LiteGraph.registered_node_types)) {
        const nodeData = ctor.nodeData
        if (nodeData?.api_node !== true) continue
        ctor.list_disabled = isNodeDisabled({
          api_node: nodeData.api_node,
          category: nodeData.category ?? ''
        })
      }
    },
    { immediate: true }
  )
}
