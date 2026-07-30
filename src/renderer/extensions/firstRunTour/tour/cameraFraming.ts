import { delay } from 'es-toolkit'

import type { ReadOnlyRect } from '@/lib/litegraph/src/interfaces'
import { CARD_WIDTH } from '@/platform/onboarding/coachmarkLayout'
import { useSettingStore } from '@/platform/settings/settingStore'
import { app } from '@/scripts/app'
import type { NodeId } from '@/types/nodeId'

const FOCUS_DURATION_MS = 450
const MAX_FOCUS_SCALE = 0.6

interface Viewport {
  width: number
  height: number
}

export function focusFill(bounds: ReadOnlyRect, viewport: Viewport): number {
  const [, , width, height] = bounds
  const sideRoom = viewport.width - CARD_WIDTH * 2
  const usableWidth = sideRoom > 0 ? sideRoom : viewport.width
  const scale = Math.min(
    usableWidth / Math.max(width, 1),
    viewport.height / Math.max(height, 1),
    MAX_FOCUS_SCALE
  )
  return Math.max(
    (scale * Math.max(width, 300)) / viewport.width,
    (scale * Math.max(height, 300)) / viewport.height
  )
}

export async function frameNode(
  nodeId: NodeId,
  signal: AbortSignal
): Promise<void> {
  const canvas = app.canvas
  const node = canvas?.graph?.getNodeById(nodeId)
  const viewport = canvas?.canvas.getBoundingClientRect()
  if (!canvas || !node || !viewport?.width || !viewport.height) return
  const bounds = node.boundingRect
  const zoom = focusFill(bounds, viewport)
  const reduced =
    useSettingStore().get('Comfy.Appearance.DisableAnimations') ||
    (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)
  if (reduced) {
    canvas.ds.fitToBounds(bounds, { zoom })
    canvas.setDirty(true, true)
    return
  }
  canvas.animateToBounds(bounds, { zoom, duration: FOCUS_DURATION_MS })
  await delay(FOCUS_DURATION_MS, { signal })
}
