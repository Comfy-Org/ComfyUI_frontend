import { useVueFeatureFlags } from '@/composables/useVueFeatureFlags'
import type { LGraph, rendererType } from '@/lib/litegraph/src/LGraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import { createBounds } from '@/lib/litegraph/src/measure'
import { useSettingStore } from '@/platform/settings/settingStore'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import { useLayoutMutations } from '@/renderer/core/layout/operations/layoutMutations'
import type { NodeBoundsUpdate } from '@/renderer/core/layout/types'
import { app as comfyApp } from '@/scripts/app'
import type { SubgraphInputNode } from '@/lib/litegraph/src/subgraph/SubgraphInputNode'
import type { SubgraphOutputNode } from '@/lib/litegraph/src/subgraph/SubgraphOutputNode'

const SCALE_FACTOR = 1.75

export function ensureCorrectLayoutScale(
  renderer?: rendererType,
  targetGraph?: LGraph
) {
  const settingStore = useSettingStore()

  const autoScaleLayoutSetting = settingStore.get(
    'Comfy.VueNodes.AutoScaleLayout'
  )

  if (autoScaleLayoutSetting === false) {
    return
  }

  const { shouldRenderVueNodes } = useVueFeatureFlags()

  const canvas = comfyApp.canvas
  const graph = targetGraph ?? canvas?.graph

  if (!graph || !graph.nodes) return

  // Use renderer from graph, default to 'LG' for the check (but don't modify graph yet)
  if (!renderer) {
    // Always assume legacy LG format when unknown (pre-dates this feature)
    renderer = 'LG'
  }

  const doesntNeedScale =
    (renderer === 'LG' && shouldRenderVueNodes.value === false) ||
    (renderer === 'Vue' && shouldRenderVueNodes.value === true)

  if (doesntNeedScale) {
    // Don't scale, but ensure workflowRendererVersion is set for future checks
    if (!graph.extra.workflowRendererVersion) {
      graph.extra.workflowRendererVersion = renderer
    }
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

    // Track updates for layout store (only if this is the active graph)
    if (!targetGraph || targetGraph === canvas?.graph) {
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
  }

  if (
    (!targetGraph || targetGraph === canvas?.graph) &&
    yjsMoveNodeUpdates.length > 0
  ) {
    layoutStore.batchUpdateNodeBounds(yjsMoveNodeUpdates)
  }

  for (const reroute of graph.reroutes.values()) {
    const oldX = reroute.pos[0]
    const oldY = reroute.pos[1]

    const relativeX = oldX - originX
    const relativeY = oldY - originY
    const newX = originX + relativeX * scaleFactor
    const newY = originY + relativeY * scaleFactor

    reroute.pos = [newX, newY]

    if (
      (!targetGraph || targetGraph === canvas?.graph) &&
      shouldRenderVueNodes.value
    ) {
      const layoutMutations = useLayoutMutations()
      layoutMutations.moveReroute(
        reroute.id,
        { x: newX, y: newY },
        { x: oldX, y: oldY }
      )
    }
  }

  if ('inputNode' in graph && 'outputNode' in graph) {
    const ioNodes = [
      graph.inputNode as SubgraphInputNode,
      graph.outputNode as SubgraphOutputNode
    ]
    for (const ioNode of ioNodes) {
      const oldX = ioNode.pos[0]
      const oldY = ioNode.pos[1]
      const oldWidth = ioNode.size[0]
      const oldHeight = ioNode.size[1]

      const relativeX = oldX - originX
      const relativeY = oldY - originY
      const newX = originX + relativeX * scaleFactor
      const newY = originY + relativeY * scaleFactor
      const newWidth = oldWidth * scaleFactor
      const newHeight = oldHeight * scaleFactor

      ioNode.pos = [newX, newY]
      ioNode.size = [newWidth, newHeight]
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

  if ((!targetGraph || targetGraph === canvas?.graph) && canvas) {
    const originScreen = canvas.ds.convertOffsetToCanvas([originX, originY])
    canvas.ds.changeScale(canvas.ds.scale / scaleFactor, originScreen)
  }

  if (needsUpscale) {
    graph.extra.workflowRendererVersion = 'Vue'
  }

  if (needsDownscale) {
    graph.extra.workflowRendererVersion = 'LG'
  }
}
