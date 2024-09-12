import { app, type ComfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'
import type { ComfyLGraphNode } from '@/types/comfyLGraphNode'
import { LGraphBadge } from '@comfyorg/litegraph'
import { useSettingStore } from '@/stores/settingStore'
import { computed, ComputedRef, watch } from 'vue'
import {
  getNodeSource as getNodeSourceFromPythonModule,
  NodeBadgeMode
} from '@/types/nodeSource'
import _ from 'lodash'
import { getColorPalette, defaultColorPalette } from './colorPalette'
import { BadgePosition } from '@comfyorg/litegraph'
import type { Palette } from '@/types/colorPalette'

function getNodeSource(node: ComfyLGraphNode) {
  const pythonModule = (node.constructor as typeof ComfyLGraphNode).nodeData
    ?.python_module
  return pythonModule ? getNodeSourceFromPythonModule(pythonModule) : null
}

function isCoreNode(node: ComfyLGraphNode) {
  return getNodeSource(node)?.type === 'core'
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
    : nodeSource?.badgeText ?? ''
}

class NodeBadgeExtension implements ComfyExtension {
  name = 'Comfy.NodeBadge'

  constructor(
    public nodeIdBadgeMode: ComputedRef<NodeBadgeMode> | null = null,
    public nodeSourceBadgeMode: ComputedRef<NodeBadgeMode> | null = null,
    public colorPalette: ComputedRef<Palette> | null = null
  ) {}

  init(app: ComfyApp) {
    if (!app.vueAppReady) {
      return
    }

    const settingStore = useSettingStore()
    this.nodeSourceBadgeMode = computed(
      () =>
        settingStore.get('Comfy.NodeBadge.NodeSourceBadgeMode') as NodeBadgeMode
    )
    this.nodeIdBadgeMode = computed(
      () => settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') as NodeBadgeMode
    )
    this.colorPalette = computed(() =>
      getColorPalette(settingStore.get('Comfy.ColorPalette'))
    )

    watch(this.nodeSourceBadgeMode, () => {
      app.graph.setDirtyCanvas(true, true)
    })

    watch(this.nodeIdBadgeMode, () => {
      app.graph.setDirtyCanvas(true, true)
    })
  }

  nodeCreated(node: ComfyLGraphNode, app: ComfyApp) {
    if (!app.vueAppReady) {
      return
    }

    node.badgePosition = BadgePosition.TopRight
    // @ts-expect-error Disable ComfyUI-Manager's badge drawing by setting badge_enabled to true. Remove this when ComfyUI-Manager's badge drawing is removed.
    node.badge_enabled = true

    const badge = computed(
      () =>
        new LGraphBadge({
          text: _.truncate(
            [
              getNodeIdBadge(node, this.nodeIdBadgeMode.value),
              getNodeSourceBadge(node, this.nodeSourceBadgeMode.value)
            ]
              .filter((s) => s.length > 0)
              .join(' '),
            {
              length: 25
            }
          ),
          fgColor:
            this.colorPalette.value.colors.litegraph_base?.BADGE_FG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_FG_COLOR,
          bgColor:
            this.colorPalette.value.colors.litegraph_base?.BADGE_BG_COLOR ||
            defaultColorPalette.colors.litegraph_base.BADGE_BG_COLOR
        })
    )

    node.badges.push(() => badge.value)
  }
}

app.registerExtension(new NodeBadgeExtension())
