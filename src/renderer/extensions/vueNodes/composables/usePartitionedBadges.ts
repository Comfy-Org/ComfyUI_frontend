import { trim } from 'es-toolkit'
import { computed, toValue } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'

import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { NodeBadgeProps } from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { nodeBadges } from '@/systems/badgeSystem'
import { NodeBadgeMode } from '@/types/nodeSource'
import { resolveNode } from '@/utils/litegraphUtil'

export interface NodeBadgeGroup {
  kind: 'core' | 'source' | 'extension' | 'credits'
  badges: NodeBadgeProps[]
}

const COMFY_CLOUD_PYTHON_MODULE = 'comfy_api_nodes.nodes_comfy_cloud'

export function usePartitionedBadges(nodeData: NodeState) {
  const settingStore = useSettingStore()
  const canvasStore = useCanvasStore()
  const nodeDefStore = useNodeDefStore()

  return computed(() => {
    const rootGraph = canvasStore.currentGraph?.rootGraph
    const node = rootGraph ? resolveNode(nodeData.id, rootGraph) : undefined
    const nodeDef = node ? nodeDefStore.fromLGraphNode(node) : null
    const showComfyLogo =
      nodeDef?.isCoreNode === true &&
      settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode') ===
        NodeBadgeMode.ShowAll
    const isComfyCloudNode =
      nodeDef?.python_module === COMFY_CLOUD_PYTHON_MODULE

    const core: NodeBadgeProps[] = []
    const extension = (node?.badges ?? [])
      .map(toValue)
      .filter((badge) => badge.text)
    const credits: NodeBadgeProps[] = []

    for (const row of node ? nodeBadges(node) : []) {
      if (row.kind === 'credits') {
        credits.push({
          text: row.text,
          cssIcon: 'icon-[lucide--coins] order-first bg-credit'
        })
        continue
      }
      if (nodeDef?.isCoreNode && row.part === 'source') continue
      core.push({
        text: row.part === 'lifecycle' ? trim(row.text, ['[', ']']) : row.text
      })
    }

    const source: NodeBadgeProps[] =
      (showComfyLogo && credits.length === 0) || isComfyCloudNode
        ? [
            {
              text: '',
              cssIcon: cn(
                'icon-[comfy--comfy-c] size-3',
                isComfyCloudNode && 'text-brand-yellow'
              )
            }
          ]
        : []
    const groups: NodeBadgeGroup[] = [
      { kind: 'core', badges: core },
      { kind: 'source', badges: source },
      { kind: 'extension', badges: extension },
      { kind: 'credits', badges: credits }
    ]

    return { groups: groups.filter((group) => group.badges.length > 0) }
  })
}
