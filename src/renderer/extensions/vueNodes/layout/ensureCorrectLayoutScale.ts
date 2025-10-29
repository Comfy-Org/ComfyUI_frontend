import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createBounds } from '@/lib/litegraph/src/measure'
import { useSettingStore } from '@/platform/settings/settingStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { NodeBoundsUpdate } from '@/renderer/core/layout/types'
import { app as comfyApp } from '@/scripts/app'

const SCALE_FACTOR = 1.75

export function ensureCorrectLayoutScale() {
  const settingStore = useSettingStore()

  const autoScaleLayoutSetting = settingStore.get(
    'Comfy.VueNodes.AutoScaleLayout'
  )

  if (autoScaleLayoutSetting === false) {
    return
  }

  const canvas = comfyApp.canvas
  const graph = canvas?.graph

  if (!graph || !graph.nodes) return

  if (graph.extra?.vueNodesScaled === true) {
    return
  }

  const vueNodesEnabled = settingStore.get('Comfy.VueNodes.Enabled')
  if (!vueNodesEnabled) {
    return
  }

  const lgBounds = createBounds(graph.nodes)

  if (!lgBounds) return

  const allVueNodes = layoutStore.getAllNodes().value

  const originX = lgBounds[0]
  const originY = lgBounds[1]

  const lgNodesById = new Map(
    graph.nodes.map((node) => [String(node.id), node])
  )

  const yjsMoveNodeUpdates: NodeBoundsUpdate[] = []

  for (const vueNode of allVueNodes.values()) {
    const lgNode = lgNodesById.get(String(vueNode.id))
    if (!lgNode) continue

    const lgBodyY = lgNode.pos[1] - LiteGraph.NODE_TITLE_HEIGHT

    const relativeX = lgNode.pos[0] - originX
    const relativeY = lgBodyY - originY
    const newX = originX + relativeX * SCALE_FACTOR
    const newY = originY + relativeY * SCALE_FACTOR
    const newWidth = lgNode.width * SCALE_FACTOR
    const newHeight = lgNode.height * SCALE_FACTOR

    yjsMoveNodeUpdates.push({
      nodeId: vueNode.id,
      bounds: {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight
      }
    })
  }

  layoutStore.batchUpdateNodeBounds(yjsMoveNodeUpdates)

  graph.groups.forEach((group) => {
    const groupBodyY = group.pos[1] - LiteGraph.NODE_TITLE_HEIGHT

    const relativeX = group.pos[0] - originX
    const relativeY = groupBodyY - originY

    const newPosY =
      originY + relativeY * SCALE_FACTOR + LiteGraph.NODE_TITLE_HEIGHT

    group.pos = [originX + relativeX * SCALE_FACTOR, newPosY]
    group.size = [group.size[0] * SCALE_FACTOR, group.size[1] * SCALE_FACTOR]
  })

  const originScreen = canvas.ds.convertOffsetToCanvas([originX, originY])
  canvas.ds.changeScale(canvas.ds.scale / SCALE_FACTOR, originScreen)

  if (!graph.extra) graph.extra = {}
  graph.extra.vueNodesScaled = true
}
