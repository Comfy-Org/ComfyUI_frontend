import { computed } from 'vue'

import { useDisabledPartnerNodesStore } from '@/platform/workspace/stores/disabledPartnerNodesStore'
import { NodeSearchService } from '@/services/nodeSearchService'
import { useNodeDefStore } from '@/stores/nodeDefStore'

export function useDisabledNodeSearch() {
  const nodeDefStore = useNodeDefStore()
  const disabledPartnerNodesStore = useDisabledPartnerNodesStore()
  const disabledNodeDefs = computed(() =>
    Object.values(nodeDefStore.nodeDefsByName).filter((nodeDef) =>
      disabledPartnerNodesStore.isNodeDefDisabled(nodeDef)
    )
  )
  const disabledSearchService = computed(
    () => new NodeSearchService(disabledNodeDefs.value)
  )

  return { disabledNodeDefs, disabledSearchService }
}
