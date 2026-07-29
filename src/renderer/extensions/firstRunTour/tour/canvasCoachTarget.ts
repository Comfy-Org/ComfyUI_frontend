import { watch } from 'vue'

import type { MovingTarget } from '@/platform/onboarding/coachmarkRegistry'
import { useTransformState } from '@/renderer/core/layout/transform/useTransformState'
import type { NodeId } from '@/types/nodeId'

/** A canvas node as a coachmark target, carried by the camera every frame. */
export function canvasNodeTarget(nodeId: NodeId): MovingTarget {
  const { camera } = useTransformState()
  return {
    selector: `[data-node-id="${CSS.escape(String(nodeId))}"]`,
    onMove: (notify) =>
      watch(() => [camera.x, camera.y, camera.z], notify, { flush: 'post' })
  }
}
