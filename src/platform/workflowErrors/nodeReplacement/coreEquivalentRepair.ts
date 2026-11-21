import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useNodeReplacementStore } from '@/platform/workflowErrors/nodeReplacement/nodeReplacementStore'
import { useNodeReplacement } from '@/platform/workflowErrors/nodeReplacement/useNodeReplacement'

/** The Replace with Core Equivalent repair for these nodes, when any has an installed-node replacement. */
export function coreEquivalentRepair(nodes: readonly LGraphNode[]) {
  const store = useNodeReplacementStore()
  if (!nodes.some((node) => store.getInstalledNodeReplacement(node)))
    return undefined
  return {
    id: 'replaceWithCoreEquivalent',
    label: t(
      nodes.length > 1
        ? 'nodeReplacement.replaceSelectedWithCoreEquivalents'
        : 'nodeReplacement.replaceWithCoreEquivalent'
    ),
    action: () => useNodeReplacement().replaceInstalledNodes(nodes)
  }
}
