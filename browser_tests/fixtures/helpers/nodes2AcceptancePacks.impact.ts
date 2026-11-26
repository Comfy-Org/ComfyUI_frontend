import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  countColour,
  nodeScreenRect,
  padRect
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

const ZONE_RED = [162, 58, 58] as const

export const PROGRESS_GREEN = [0, 128, 0] as const

export const STATUS_TEXT = 'n2a upscaling'

export async function zonePixels(comfyPage: ComfyPage, nodeId: NodeId) {
  return countColour(
    comfyPage,
    padRect(await nodeScreenRect(comfyPage, nodeId), 4),
    ZONE_RED,
    6
  )
}

export async function areaAboveNode(comfyPage: ComfyPage, nodeId: NodeId) {
  const rect = await nodeScreenRect(comfyPage, nodeId)
  return { x: rect.x - 4, y: rect.y - 40, width: rect.width + 8, height: 44 }
}
