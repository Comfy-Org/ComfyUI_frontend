import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Rgb } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import { widgetState } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import { nodeLocalPoint } from '@e2e/fixtures/helpers/nodes2AcceptancePacks.a1'

export const BLACK: Rgb = [0, 0, 0]

export const FOLDER_PANEL_GREY: Rgb = [0x2a, 0x2a, 0x2a]

export const GRADIENT_BAR_LEFT = 10

export const GRADIENT_BAR_TOP = 222

export async function gradientStops(comfyPage: ComfyPage, id: NodeId) {
  const value = await widgetState(comfyPage, id, 'gradient_colors', ['value'])
  const stops: { pos: number }[] = JSON.parse(String(value))
  return stops.map((stop) => Math.round(stop.pos * 100) / 100)
}

export async function gradientBarPoint(
  comfyPage: ComfyPage,
  id: NodeId,
  fraction: number
) {
  const width = await comfyPage.page.evaluate(
    (nodeId) => window.app!.graph.getNodeById(nodeId)!.size[0] - 20,
    id
  )
  return nodeLocalPoint(comfyPage, id, [
    GRADIENT_BAR_LEFT + width * fraction,
    GRADIENT_BAR_TOP + 20
  ])
}
