import { trim } from 'es-toolkit'
import { computed, toValue } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { NodeBadgeProps } from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { app } from '@/scripts/app'
import { useNodeBadgeStore } from '@/stores/nodeBadgeStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { NodeBadgeMode } from '@/types/nodeSource'
import { resolveNode } from '@/utils/litegraphUtil'

function splitAroundFirstSpace(text: string): [string, string | undefined] {
  const index = text.indexOf(' ')
  if (index === -1) return [text, undefined]
  return [text.slice(0, index), text.slice(index + 1)]
}

/**
 * Partitions a node's badge rows from {@link useNodeBadgeStore} for the
 * Vue renderer: core rows become chips (lifecycle text is bracket-trimmed
 * and a built-in node's source row is replaced by the Comfy logo chip),
 * credits rows become pricing entries, and badges pushed onto the raw
 * `node.badges` extension surface are appended as extension chips.
 */
export function usePartitionedBadges(nodeData: VueNodeData) {
  const settingStore = useSettingStore()
  const badgeStore = useNodeBadgeStore()
  const nodeDef = useNodeDefStore().nodeDefsByName[nodeData.type]

  const rows = computed(() => {
    const graphId = app.canvas?.graph?.rootGraph.id
    if (graphId === undefined || nodeData.id == null) return []
    return badgeStore.getBadges(graphId, nodeData.id)
  })

  return computed(() => {
    const showComfyLogo =
      nodeDef?.isCoreNode &&
      settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode') ===
        NodeBadgeMode.ShowAll

    const core: NodeBadgeProps[] = []
    const extension: NodeBadgeProps[] = []
    const pricing: { required: string; rest?: string }[] = []

    for (const row of rows.value) {
      if (row.kind === 'credits') {
        const [required, rest] = splitAroundFirstSpace(row.text)
        pricing.push({ required, rest })
        continue
      }
      if (row.kind === 'core') {
        if (nodeDef?.isCoreNode && row.part === 'source') continue
        core.push({
          text: row.part === 'lifecycle' ? trim(row.text, ['[', ']']) : row.text
        })
        continue
      }
      extension.push({ text: row.text })
    }

    const rootGraph = app.canvas?.graph?.rootGraph
    const node = rootGraph ? resolveNode(nodeData.id, rootGraph) : undefined
    for (const badge of (node?.badges ?? []).map(toValue)) {
      if (!badge.text) continue
      extension.push(badge)
    }

    return {
      hasComfyBadge: showComfyLogo && pricing.length === 0,
      core,
      extension,
      pricing
    }
  })
}
