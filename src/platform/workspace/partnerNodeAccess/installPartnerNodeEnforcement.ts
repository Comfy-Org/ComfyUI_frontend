import { watchEffect } from 'vue'

import { t } from '@/i18n'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { useNodeDefStore } from '@/stores/nodeDefStore'

import { usePartnerNodeAccessStore } from './partnerNodeAccessStore'

/**
 * PROTOTYPE (DES-484): hides workspace-disabled partner nodes from every
 * discovery surface. The node-def filter covers search (v1/v2) and both
 * node-library sidebars via `visibleNodeDefs`; the `skip_list` sync covers
 * the litegraph right-click Add Node menu (same pattern as the dev_only
 * sync in nodeDefStore). Creation paths that bypass discovery (paste,
 * workflow load) are enforced at run time instead.
 */
export function installPartnerNodeEnforcement() {
  const accessStore = usePartnerNodeAccessStore()
  const nodeDefStore = useNodeDefStore()

  nodeDefStore.registerNodeDefFilter({
    id: 'core.partnerNodeAccess',
    name: t('nodeFilters.hideDisabledPartnerNodes'),
    description: t('nodeFilters.hideDisabledPartnerNodesDescription'),
    predicate: (nodeDef) => !accessStore.disabledNodeTypes.has(nodeDef.name)
  })

  watchEffect(() => {
    const disabled = accessStore.disabledNodeTypes
    for (const [typeName, nodeType] of Object.entries(
      LiteGraph.registered_node_types
    )) {
      if (nodeType.nodeData?.api_node) {
        nodeType.skip_list = disabled.has(typeName)
      }
    }
  })
}
