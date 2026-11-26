import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  addPackNode,
  countColour,
  nodeScreenRect
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

export const SPEECH_SETTING =
  'Comfy.Settings.alekpet.ExtrasNode.SpeechAndRecognationSpeech'

export async function addIdeNode(comfyPage: ComfyPage) {
  const id = await addPackNode(comfyPage, 'IDENode', [150, 150], [500, 500])
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate(
          (nodeId) =>
            !!window
              .app!.graph.getNodeById(nodeId)
              ?.widgets?.some((widget) => widget.name === 'update_node'),
          id
        ),
      { message: 'IDE node finished onNodeCreated' }
    )
    .toBe(true)
  return id
}

export async function imageTypeLabelPixels(
  comfyPage: ComfyPage,
  nodeId: NodeId
) {
  const rect = await nodeScreenRect(comfyPage, nodeId)
  return countColour(
    comfyPage,
    { x: rect.x + 30, y: rect.y, width: rect.width - 30, height: 160 },
    [100, 181, 246],
    30
  )
}
