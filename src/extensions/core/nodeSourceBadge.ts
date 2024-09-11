import { app } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'
import type { ComfyLGraphNode } from '@/types/comfyLGraphNode'
import { LGraphBadge } from '@comfyorg/litegraph'
import { useSettingStore } from '@/stores/settingStore'
import { computed, watch } from 'vue'
import {
  getNodeSource as getNodeSourceFromPythonModule,
  NodeBadgeMode
} from '@/types/nodeSource'
import _ from 'lodash'
import { colorPalettes } from './colorPalette'
import { BadgePosition } from '@comfyorg/litegraph'

const settingStore = useSettingStore()
const nodeSourceBadgeMode = computed(
  () => settingStore.get('Comfy.Node.NodeSourceBadgeMode') as NodeBadgeMode
)
const nodeIdBadgeMode = computed(
  () => settingStore.get('Comfy.Node.NodeIdBadgeMode') as NodeBadgeMode
)
const colorPalette = computed(
  () => colorPalettes[settingStore.get('Comfy.ColorPalette')]
)
const defaultColorPalette = colorPalettes['dark']

watch(nodeSourceBadgeMode, () => {
  app.graph.setDirtyCanvas(true, true)
})

watch(nodeIdBadgeMode, () => {
  app.graph.setDirtyCanvas(true, true)
})

function getNodeSource(node: ComfyLGraphNode) {
  const pythonModule = (node.constructor as typeof ComfyLGraphNode).nodeData
    ?.python_module
  return getNodeSourceFromPythonModule(pythonModule)
}

function isCoreNode(node: ComfyLGraphNode) {
  return getNodeSource(node).type === 'core'
}

function getNodeIdBadge(node: ComfyLGraphNode, nodeIdBadgeMode: NodeBadgeMode) {
  return nodeIdBadgeMode === NodeBadgeMode.None ||
    (isCoreNode(node) && nodeIdBadgeMode === NodeBadgeMode.HideBuiltIn)
    ? ''
    : `#${node.id}`
}

function getNodeSourceBadge(
  node: ComfyLGraphNode,
  nodeSourceBadgeMode: NodeBadgeMode
) {
  const nodeSource = getNodeSource(node)
  return nodeSourceBadgeMode === NodeBadgeMode.None ||
    (isCoreNode(node) && nodeSourceBadgeMode === NodeBadgeMode.HideBuiltIn)
    ? ''
    : nodeSource.badgeText
}

class NodeSourceBadgeExtension implements ComfyExtension {
  name = 'Comfy.NodeSourceBadge'
  nodeCreated(node: ComfyLGraphNode) {
    node.badgePosition = BadgePosition.TopRight
    // @ts-expect-error Disable ComfyUI-Manager's badge drawing by setting badge_enabled to true. Remove this when ComfyUI-Manager's badge drawing is removed.
    node.badge_enabled = true

    const idBadge = computed(
      () =>
        new LGraphBadge({
          text: _.truncate(getNodeIdBadge(node, nodeIdBadgeMode.value), {
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

    const sourceBadge = computed(
      () =>
        new LGraphBadge({
          text: _.truncate(
            getNodeSourceBadge(node, nodeSourceBadgeMode.value),
            {
              length: 25
            }
          ),
          fgColor:
            colorPalette.value.colors.litegraph_base?.BADGE_FG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_FG_COLOR,
          bgColor:
            colorPalette.value.colors.litegraph_base?.BADGE_BG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_BG_COLOR
        })
    )

    node.badges.push(() => idBadge.value)
    node.badges.push(() => sourceBadge.value)
  }
}

app.registerExtension(new NodeSourceBadgeExtension())
