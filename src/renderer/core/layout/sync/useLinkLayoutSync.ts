import { tryOnScopeDispose } from '@vueuse/core'
import { computed, ref, toValue } from 'vue'

import type { LGraphCanvas } from '@/lib/litegraph/src/LGraphCanvas'
import { LLink } from '@/lib/litegraph/src/LLink'
import { Reroute } from '@/lib/litegraph/src/Reroute'
import type { Point } from '@/lib/litegraph/src/interfaces'
import { LinkDirection } from '@/lib/litegraph/src/types/globalEnums'
import { LitegraphLinkAdapter } from '@/renderer/core/canvas/litegraph/litegraphLinkAdapter'
import type { LinkRenderContext } from '@/renderer/core/canvas/litegraph/litegraphLinkAdapter'
import { getSlotPosition } from '@/renderer/core/canvas/litegraph/slotCalculations'
import { layoutStore } from '@/renderer/core/layout/store/layoutStore'
import type { LayoutChange } from '@/renderer/core/layout/types'

export function useLinkLayoutSync() {
  const canvasRef = ref<LGraphCanvas>()
  const graphRef = computed(() => canvasRef.value?.graph)
  const unsubscribeLayoutChange = ref<() => void>()
  const adapter = new LitegraphLinkAdapter()

  /**
   * Build link render context from canvas properties
   */
  function buildLinkRenderContext(): LinkRenderContext {
    const canvas = toValue(canvasRef)
    if (!canvas) {
      throw new Error('Canvas not initialized')
    }

    return {
      // Canvas settings
      renderMode: canvas.links_render_mode,
      connectionWidth: canvas.connections_width,
      renderBorder: canvas.render_connections_border,
      lowQuality: canvas.low_quality,
      highQualityRender: canvas.highquality_render,
      scale: canvas.ds.scale,
      linkMarkerShape: canvas.linkMarkerShape,
      renderConnectionArrows: canvas.render_connection_arrows,

      // State
      highlightedLinks: new Set(Object.keys(canvas.highlighted_links)),

      // Colors
      defaultLinkColor: canvas.default_link_color,
      linkTypeColors: (canvas.constructor as any).link_type_colors || {},

      // Pattern for disabled links
      disabledPattern: canvas._pattern
    }
  }

  /**
   * Recompute a single link and all its segments
   *
   * Note: This logic mirrors LGraphCanvas#renderAllLinkSegments but:
   * - Works with offscreen context for event-driven updates
   * - No visibility checks (always computes full geometry)
   * - No dragging state handling (pure geometry computation)
   */
  function recomputeLinkById(linkId: number): void {
    const canvas = toValue(canvasRef)
    const graph = toValue(graphRef)
    if (!graph || !canvas) return

    const link = graph.links.get(linkId)
    if (!link || link.id === -1) return // Skip floating/temp links

    // Get source and target nodes
    const sourceNode = graph.getNodeById(link.origin_id)
    const targetNode = graph.getNodeById(link.target_id)
    if (!sourceNode || !targetNode) return

    // Get slots
    const sourceSlot = sourceNode.outputs?.[link.origin_slot]
    const targetSlot = targetNode.inputs?.[link.target_slot]
    if (!sourceSlot || !targetSlot) return

    // Get positions
    const startPos = getSlotPosition(sourceNode, link.origin_slot, false)
    const endPos = getSlotPosition(targetNode, link.target_slot, true)

    // Get directions
    const startDir = sourceSlot.dir || LinkDirection.RIGHT
    const endDir = targetSlot.dir || LinkDirection.LEFT

    // Get reroutes for this link
    const reroutes = LLink.getReroutes(graph, link)

    // Build render context
    const context = buildLinkRenderContext()

    if (reroutes.length > 0) {
      // Render segmented link with reroutes
      let segmentStartPos = startPos
      let segmentStartDir = startDir

      for (let i = 0; i < reroutes.length; i++) {
        const reroute = reroutes[i]

        // Calculate reroute angle
        reroute.calculateAngle(Date.now(), graph, [
          segmentStartPos[0],
          segmentStartPos[1]
        ])

        // Calculate control points
        const distance = Math.sqrt(
          (reroute.pos[0] - segmentStartPos[0]) ** 2 +
            (reroute.pos[1] - segmentStartPos[1]) ** 2
        )
        const dist = Math.min(Reroute.maxSplineOffset, distance * 0.25)

        // Special handling for floating input chain
        const isFloatingInputChain = !sourceNode && targetNode
        const startControl: Readonly<Point> = isFloatingInputChain
          ? [0, 0]
          : [dist * reroute.cos, dist * reroute.sin]

        // Render segment to this reroute
        adapter.renderLinkDirect(
          canvas.ctx,
          segmentStartPos,
          reroute.pos,
          link,
          true, // skip_border
          0, // flow
          null, // color
          segmentStartDir,
          LinkDirection.CENTER,
          context,
          {
            startControl,
            endControl: reroute.controlPoint,
            reroute,
            disabled: false
          }
        )

        // Prepare for next segment
        segmentStartPos = reroute.pos
        segmentStartDir = LinkDirection.CENTER
      }

      // Render final segment from last reroute to target
      const lastReroute = reroutes[reroutes.length - 1]
      const finalDistance = Math.sqrt(
        (endPos[0] - lastReroute.pos[0]) ** 2 +
          (endPos[1] - lastReroute.pos[1]) ** 2
      )
      const finalDist = Math.min(Reroute.maxSplineOffset, finalDistance * 0.25)
      const finalStartControl: Readonly<Point> = [
        finalDist * lastReroute.cos,
        finalDist * lastReroute.sin
      ]

      adapter.renderLinkDirect(
        canvas.ctx,
        lastReroute.pos,
        endPos,
        link,
        true, // skip_border
        0, // flow
        null, // color
        LinkDirection.CENTER,
        endDir,
        context,
        {
          startControl: finalStartControl,
          disabled: false
        }
      )
    } else {
      // No reroutes - render direct link
      adapter.renderLinkDirect(
        canvas.ctx,
        startPos,
        endPos,
        link,
        true, // skip_border
        0, // flow
        null, // color
        startDir,
        endDir,
        context,
        {
          disabled: false
        }
      )
    }
  }

  /**
   * Recompute all links connected to a node
   */
  function recomputeLinksForNode(nodeId: number): void {
    const graph = toValue(graphRef)
    if (!graph) return

    const node = graph.getNodeById(nodeId)
    if (!node) return

    const linkIds = new Set<number>()

    // Collect output links
    if (node.outputs) {
      for (const output of node.outputs) {
        if (output.links) {
          for (const linkId of output.links) {
            linkIds.add(linkId)
          }
        }
      }
    }

    // Collect input links
    if (node.inputs) {
      for (const input of node.inputs) {
        if (input.link !== null && input.link !== undefined) {
          linkIds.add(input.link)
        }
      }
    }

    // Recompute each link
    for (const linkId of linkIds) {
      recomputeLinkById(linkId)
    }
  }

  /**
   * Recompute all links associated with a reroute
   */
  function recomputeLinksForReroute(rerouteId: number): void {
    const graph = toValue(graphRef)
    if (!graph) return

    const reroute = graph.reroutes.get(rerouteId)
    if (!reroute) return

    // Recompute all links that pass through this reroute
    for (const linkId of reroute.linkIds) {
      recomputeLinkById(linkId)
    }
  }

  /**
   * Start link layout sync with event-driven functionality
   */
  function start(canvasInstance: LGraphCanvas): void {
    canvasRef.value = canvasInstance
    if (!canvasInstance.graph) return

    // Initial computation for all existing links
    for (const link of canvasInstance.graph._links.values()) {
      if (link.id !== -1) {
        recomputeLinkById(link.id)
      }
    }

    // Subscribe to layout store changes
    unsubscribeLayoutChange.value?.()
    unsubscribeLayoutChange.value = layoutStore.onChange(
      (change: LayoutChange) => {
        switch (change.operation.type) {
          case 'moveNode':
          case 'resizeNode':
            recomputeLinksForNode(parseInt(change.operation.nodeId))
            break
          case 'batchUpdateBounds':
            for (const nodeId of change.operation.nodeIds) {
              recomputeLinksForNode(parseInt(nodeId))
            }
            break
          case 'createLink':
            recomputeLinkById(change.operation.linkId)
            break
          case 'deleteLink':
            // No-op - store already cleaned by existing code
            break
          case 'createReroute':
          case 'deleteReroute':
            // Recompute all affected links
            if ('linkIds' in change.operation) {
              for (const linkId of change.operation.linkIds) {
                recomputeLinkById(linkId)
              }
            }
            break
          case 'moveReroute':
            recomputeLinksForReroute(change.operation.rerouteId)
            break
        }
      }
    )
  }

  function stop(): void {
    unsubscribeLayoutChange.value?.()
    unsubscribeLayoutChange.value = undefined
    canvasRef.value = undefined
  }

  tryOnScopeDispose(stop)

  return {
    start,
    stop
  }
}
