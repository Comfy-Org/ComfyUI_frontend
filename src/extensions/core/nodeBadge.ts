// @ts-strict-ignore
import { app, type ComfyApp } from '@/scripts/app'
import type { ComfyExtension } from '@/types/comfy'
import type { LGraphNode } from '@comfyorg/litegraph'
import { LGraphBadge } from '@comfyorg/litegraph'
import { useSettingStore } from '@/stores/settingStore'
import { computed, ComputedRef, watch } from 'vue'
import { NodeBadgeMode, NodeSource, NodeSourceType } from '@/types/nodeSource'
import _ from 'lodash'
import { getColorPalette, defaultColorPalette } from './colorPalette'
import { BadgePosition } from '@comfyorg/litegraph'
import type { Palette } from '@/types/colorPalette'
import { useNodeDefStore } from '@/stores/nodeDefStore'

function getNodeSource(node: LGraphNode): NodeSource | null {
  const nodeDef = node.constructor.nodeData
  // Frontend-only nodes don't have nodeDef
  if (!nodeDef) {
    return null
  }
  const nodeDefStore = useNodeDefStore()
  return nodeDefStore.nodeDefsByName[nodeDef.name]?.nodeSource ?? null
}

function isCoreNode(node: LGraphNode) {
  return getNodeSource(node)?.type === NodeSourceType.Core
}

function badgeTextVisible(node: LGraphNode, badgeMode: NodeBadgeMode): boolean {
  return (
    badgeMode === NodeBadgeMode.None ||
    (isCoreNode(node) && badgeMode === NodeBadgeMode.HideBuiltIn)
  )
}

function getNodeIdBadgeText(node: LGraphNode, nodeIdBadgeMode: NodeBadgeMode) {
  return badgeTextVisible(node, nodeIdBadgeMode) ? '' : `#${node.id}`
}

function getNodeSourceBadgeText(
  node: LGraphNode,
  nodeSourceBadgeMode: NodeBadgeMode
) {
  const nodeSource = getNodeSource(node)
  return badgeTextVisible(node, nodeSourceBadgeMode)
    ? ''
    : nodeSource?.badgeText ?? ''
}

function getNodeLifeCycleBadgeText(
  node: LGraphNode,
  nodeLifeCycleBadgeMode: NodeBadgeMode
) {
  let text = ''
  const nodeDef = node.constructor.nodeData

  // Frontend-only nodes don't have nodeDef
  if (!nodeDef) {
    return ''
  }

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

  nodeCreated(node: LGraphNode, app: ComfyApp) {
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
