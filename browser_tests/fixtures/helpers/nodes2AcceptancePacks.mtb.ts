import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export const NOTE_PLUS = 'Note Plus (mtb)'
export const STACK_IMAGES = 'Stack Images (mtb)'
export const EDIT_ICON_STROKE_ON_NOTE_TITLE = [143, 133, 122] as const

export async function editIconRect(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((nodeId) => {
    const node = window.app!.graph.getNodeById(nodeId)!
    const rect: Record<'x' | 'y' | 'width' | 'height', number> = Reflect.get(
      node,
      'iconRect'
    )
    return [rect.x, rect.y, rect.width, rect.height] as const
  }, id)
}
