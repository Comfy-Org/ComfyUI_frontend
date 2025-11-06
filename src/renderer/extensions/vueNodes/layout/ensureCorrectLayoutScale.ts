import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import type { rendererType } from '@/lib/litegraph/src/LGraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createBounds } from '@/lib/litegraph/src/measure'
import { useSettingStore } from '@/platform/settings/settingStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import type { NodeBoundsUpdate } from '@/renderer/core/layout/types'
import { app as comfyApp } from '@/scripts/app'

const SCALE_FACTOR = 1.75

export function ensureCorrectLayoutScale(renderer?: rendererType) {
  const settingStore = useSettingStore()

  const autoScaleLayoutSetting = settingStore.get(
    'Comfy.VueNodes.AutoScaleLayout'
  )

  if (autoScaleLayoutSetting === false) {
    return
  }

  const { shouldRenderVueNodes } = useVueFeatureFlags()

  const canvas = comfyApp.canvas
  const graph = canvas?.graph

  if (!graph || !graph.nodes) return

  if (!renderer) {
    // Always assume legacy LG format when unknown (pre-dates this feature)
    renderer = 'LG'
    graph.extra.workflowRendererVersion = renderer
  }

  const doesntNeedScale =
    (renderer === 'LG' && shouldRenderVueNodes.value === false) ||
    (renderer === 'Vue' && shouldRenderVueNodes.value === true)

  if (doesntNeedScale) {
    return
  }

  const needsUpscale = renderer === 'LG' && shouldRenderVueNodes.value === true
  const needsDownscale =
    renderer === 'Vue' && shouldRenderVueNodes.value === false

  const lgBounds = createBounds(graph.nodes)

  if (!lgBounds) return

  const originX = lgBounds[0]
  const originY = lgBounds[1]

  const lgNodesById = new Map(graph.nodes.map((node) => [node.id, node]))

  const yjsMoveNodeUpdates: NodeBoundsUpdate[] = []

  const scaleFactor = needsUpscale
    ? SCALE_FACTOR
    : needsDownscale
      ? 1 / SCALE_FACTOR
      : 1

  for (const node of graph.nodes) {
    const lgNode = lgNodesById.get(node.id)
    if (!lgNode) continue

    const lgBodyY = lgNode.pos[1]

    const relativeX = lgNode.pos[0] - originX
    const relativeY = lgBodyY - originY
    const newX = originX + relativeX * scaleFactor
    const newY = originY + relativeY * scaleFactor
    const newWidth = lgNode.width * scaleFactor
    const newHeight = lgNode.height * scaleFactor

    // Directly update LiteGraph node to ensure immediate consistency
    // Dont need to reference vue directly because the pos and dims are already in yjs
    lgNode.pos[0] = newX
    lgNode.pos[1] = newY
    lgNode.size[0] = newWidth
    lgNode.size[1] =
      newHeight - (needsDownscale ? LiteGraph.NODE_TITLE_HEIGHT : 0)

    yjsMoveNodeUpdates.push({
      nodeId: String(lgNode.id),
      bounds: {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight - (needsDownscale ? LiteGraph.NODE_TITLE_HEIGHT : 0)
      }
    })
  }

  layoutStore.batchUpdateNodeBounds(yjsMoveNodeUpdates)

  const layoutMutations = useLayoutMutations()
  for (const reroute of graph.reroutes.values()) {
    const oldX = reroute.pos[0]
    const oldY = reroute.pos[1]

    const relativeX = oldX - originX
    const relativeY = oldY - originY
    const newX = originX + relativeX * scaleFactor
    const newY = originY + relativeY * scaleFactor

    reroute.pos = [newX, newY]

    if (shouldRenderVueNodes.value) {
      layoutMutations.moveReroute(
        reroute.id,
        { x: newX, y: newY },
        { x: oldX, y: oldY }
      )
    }
  }

  graph.groups.forEach((group) => {
    const originalPosX = group.pos[0]
    const originalPosY = group.pos[1]
    const originalWidth = group.size[0]
    const originalHeight = group.size[1]

    const adjustedY = needsDownscale
      ? originalPosY - LiteGraph.NODE_TITLE_HEIGHT
      : originalPosY

    const relativeX = originalPosX - originX
    const relativeY = adjustedY - originY

    const newWidth = originalWidth * scaleFactor
    const newHeight = originalHeight * scaleFactor

    const scaledX = originX + relativeX * scaleFactor
    const scaledY = originY + relativeY * scaleFactor

    const finalY = needsUpscale
      ? scaledY + LiteGraph.NODE_TITLE_HEIGHT
      : scaledY

    group.pos = [scaledX, finalY]
    group.size = [newWidth, newHeight]
  })

  const originScreen = canvas.ds.convertOffsetToCanvas([originX, originY])
  canvas.ds.changeScale(canvas.ds.scale / scaleFactor, originScreen)

  if (needsUpscale) {
    graph.extra.workflowRendererVersion = 'Vue'
  }

  if (needsDownscale) {
    graph.extra.workflowRendererVersion = 'LG'
  }
}
