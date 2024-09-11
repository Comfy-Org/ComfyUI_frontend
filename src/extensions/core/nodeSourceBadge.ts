import { app } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'
import type { ComfyLGraphNode } from '@/types/comfyLGraphNode'
import { LGraphBadge } from '@comfyorg/litegraph'
import { useSettingStore } from '@/stores/settingStore'
import { computed } from 'vue'
import { getNodeSource, NodeSourceBadgeMode } from '@/types/nodeSource'
import _ from 'lodash'
import { colorPalettes } from './colorPalette'
import { BadgePosition } from '@comfyorg/litegraph'

const settingStore = useSettingStore()
const nodeSourceBadgeMode = computed(
  () =>
    settingStore.get('Comfy.Node.NodeSourceBadgeMode') as NodeSourceBadgeMode
)
const colorPalette = computed(
  () => colorPalettes[settingStore.get('Comfy.ColorPalette')]
)
const defaultColorPalette = colorPalettes['dark']

function getNodeIdBadgeText(
  node: ComfyLGraphNode,
  nodeSourceBadgeMode: NodeSourceBadgeMode
) {
  if (nodeSourceBadgeMode === NodeSourceBadgeMode.None) {
    return ''
  }

  const nodeId = node.id
  if (
    nodeSourceBadgeMode === NodeSourceBadgeMode.IdNickname ||
    nodeSourceBadgeMode === NodeSourceBadgeMode.IdNicknameHideBuiltIn
  ) {
    return `#${nodeId}`
  }

  return ''
}

function getNodeSourceBadgeText(
  node: ComfyLGraphNode,
  nodeSourceBadgeMode: NodeSourceBadgeMode
) {
  if (nodeSourceBadgeMode === NodeSourceBadgeMode.None) {
    return ''
  }

  const pythonModule = (node.constructor as typeof ComfyLGraphNode).nodeData
    ?.python_module
  const nodeSource = getNodeSource(pythonModule)
  if (
    nodeSource.type === 'core' &&
    nodeSourceBadgeMode === NodeSourceBadgeMode.NicknameHideBuiltIn
  ) {
    return ''
  }
  return nodeSource.badgeText
}

function getBadgeText(
  node: ComfyLGraphNode,
  nodeSourceBadgeMode: NodeSourceBadgeMode
) {
  const nodeIdBadgeText = getNodeIdBadgeText(node, nodeSourceBadgeMode)
  const nodeSourceBadgeText = getNodeSourceBadgeText(node, nodeSourceBadgeMode)
  return [nodeIdBadgeText, nodeSourceBadgeText]
    .filter((text) => text.length > 0)
    .join(' ')
}

class NodeSourceBadgeExtension implements ComfyExtension {
  name = 'Comfy.NodeSourceBadge'
  nodeCreated(node: ComfyLGraphNode) {
    node.badgePosition = BadgePosition.TopRight
    // @ts-expect-error Disable ComfyUI-Manager's badge drawing by setting badge_enabled to true. Remove this when ComfyUI-Manager's badge drawing is removed.
    node.badge_enabled = true
    const badge = computed(
      () =>
        new LGraphBadge({
          text: _.truncate(getBadgeText(node, nodeSourceBadgeMode.value), {
            length: 25
          }),
          fgColor:
            colorPalette.value.colors.litegraph_base?.BADGE_FG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_FG_COLOR,
          bgColor:
            colorPalette.value.colors.litegraph_base?.BADGE_BG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_BG_COLOR
        })
    )

    node.badges.push(() => badge.value)
  }
}

app.registerExtension(new NodeSourceBadgeExtension())
