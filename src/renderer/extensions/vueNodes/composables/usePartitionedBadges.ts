import { trim } from 'es-toolkit'
import { computed, toValue } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { NodeBadgeProps } from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { nodeBadges } from '@/systems/badgeSystem'
import { NodeBadgeMode } from '@/types/nodeSource'
import { resolveNode } from '@/utils/litegraphUtil'

function splitAroundFirstSpace(text: string): [string, string | undefined] {
  const index = text.indexOf(' ')
  if (index === -1) return [text, undefined]
  return [text.slice(0, index), text.slice(index + 1)]
}

/**
 * Partitions a node's badge rows into the Vue renderer's chips: core
 * rows, credits rows as pricing entries, and raw `node.badges`
 * extension badges appended last.
 */
export function usePartitionedBadges(nodeData: VueNodeData) {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const nodeDef = useNodeDefStore().nodeDefsByName[nodeData.type]

  return computed(() => {
    const showComfyLogo =
      !!nodeDef?.isCoreNode &&
      settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode') ===
        NodeBadgeMode.ShowAll

    const core: NodeBadgeProps[] = []
    const extension: NodeBadgeProps[] = []
    const pricing: { required: string; rest?: string }[] = []

    const rootGraph = canvasStore.currentGraph?.rootGraph
    const node = rootGraph ? resolveNode(nodeData.id, rootGraph) : undefined
    for (const row of node ? nodeBadges(node) : []) {
      if (row.kind === 'credits') {
        const [required, rest] = splitAroundFirstSpace(row.text)
        pricing.push({ required, rest })
        continue
      }
      if (nodeDef?.isCoreNode && row.part === 'source') continue
      core.push({
        text: row.part === 'lifecycle' ? trim(row.text, ['[', ']']) : row.text
      })
    }

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
