import { usePreferredReducedMotion } from '@vueuse/core'
import log from 'loglevel'

import { visibleCanvasViewport } from '@/composables/canvas/visibleCanvasViewport'
import { selectLinkDestination } from '@/lib/litegraph/src/canvas/linkSelection'
import type { LinkArrival } from '@/lib/litegraph/src/canvas/linkSelection'
import type { ReadOnlyRect } from '@comfyorg/shared-frontend-utils/geometry'
import type { LGraphCanvas } from '@comfyorg/graph-model/entityRegistry'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import type { NodeId } from '@comfyorg/graph-model/nodeId'

const ARRIVAL_TOOLBOX_CLEARANCE = 64

const logger = log.getLogger('LinkDestinationNavigation')

export function useLinkDestinationNavigation() {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const motionPreference = usePreferredReducedMotion()

  function goToLinkDestination(nodeId: NodeId): boolean {
    const canvas = canvasStore.canvas
    if (!canvas?.graph) return false
    const arrival = selectLinkDestination(canvas.graph, nodeId)
    if (!arrival) {
      logger.debug('No linked socket left to go to on node', nodeId)
      return false
    }
    frameArrival(canvas, arrival)
    return true
  }

  function frameArrival(canvas: LGraphCanvas, { socket, bounds }: LinkArrival) {
    const viewport = visibleCanvasViewport(canvas)
    const target: ReadOnlyRect = fitsInView(canvas.ds.scale, bounds, viewport)
      ? bounds
      : [socket.x, socket.y, 0, 0]
    const framing = { zoom: 0, viewport }
    if (
      motionPreference.value === 'reduce' ||
      settingStore.get('Comfy.Appearance.DisableAnimations')
    ) {
      canvas.ds.fitToBounds(target, framing)
      canvas.setDirty(true, true)
    } else {
      canvas.animateToBounds(target, framing)
    }
  }

  return { goToLinkDestination }
}

function fitsInView(
  scale: number,
  [, , width, height]: ReadOnlyRect,
  [, , viewWidth, viewHeight]: ReadOnlyRect
): boolean {
  const clearance = 2 * ARRIVAL_TOOLBOX_CLEARANCE
  return (
    width * scale <= viewWidth - clearance &&
    height * scale <= viewHeight - clearance
  )
}
