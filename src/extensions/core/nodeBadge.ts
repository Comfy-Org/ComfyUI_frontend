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

function badgeTextVisible(
  node: ComfyLGraphNode,
  badgeMode: NodeBadgeMode
): boolean {
  return (
    badgeMode === NodeBadgeMode.None ||
    (isCoreNode(node) && badgeMode === NodeBadgeMode.HideBuiltIn)
  )
}

function getNodeIdBadgeText(
  node: ComfyLGraphNode,
  nodeIdBadgeMode: NodeBadgeMode
) {
  return badgeTextVisible(node, nodeIdBadgeMode) ? '' : `#${node.id}`
}

function getNodeSourceBadgeText(
  node: ComfyLGraphNode,
  nodeSourceBadgeMode: NodeBadgeMode
) {
  const nodeSource = getNodeSource(node)
  return badgeTextVisible(node, nodeSourceBadgeMode)
    ? ''
    : nodeSource?.badgeText ?? ''
}

function getNodeLifeCycleBadgeText(
  node: ComfyLGraphNode,
  nodeLifeCycleBadgeMode: NodeBadgeMode
) {
  let text = ''
  const nodeDef = (node.constructor as typeof ComfyLGraphNode).nodeData

  if (nodeDef.deprecated) {
    text = '[DEPR]'
  }

  if (nodeDef.experimental) {
    text = '[BETA]'
  }

  return badgeTextVisible(node, nodeLifeCycleBadgeMode) ? '' : text
}

class NodeBadgeExtension implements ComfyExtension {
  name = 'Comfy.NodeBadge'

  constructor(
    public nodeIdBadgeMode: ComputedRef<NodeBadgeMode> | null = null,
    public nodeSourceBadgeMode: ComputedRef<NodeBadgeMode> | null = null,
    public nodeLifeCycleBadgeMode: ComputedRef<NodeBadgeMode> | null = null,
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
    this.nodeLifeCycleBadgeMode = computed(
      () =>
        settingStore.get(
          'Comfy.NodeBadge.NodeLifeCycleBadgeMode'
        ) as NodeBadgeMode
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
    watch(this.nodeLifeCycleBadgeMode, () => {
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
              getNodeIdBadgeText(node, this.nodeIdBadgeMode.value),
              getNodeLifeCycleBadgeText(
                node,
                this.nodeLifeCycleBadgeMode.value
              ),
              getNodeSourceBadgeText(node, this.nodeSourceBadgeMode.value)
            ]
              .filter((s) => s.length > 0)
              .join(' '),
            {
              length: 31
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
