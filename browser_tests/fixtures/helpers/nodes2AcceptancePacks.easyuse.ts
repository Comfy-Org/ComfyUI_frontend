import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyFiles, ComfyPage } from '@e2e/fixtures/ComfyPage'
import {
  BLUE,
  RED,
  dispatchPackEvent,
  legacyWidgetPoint,
  nodeGeometry,
  nodeValue,
  uploadSolidImage
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

export const CHOOSER = 'easy imageChooser'

const CONFIRM_LABEL = 'Progress selected image'

export async function pauseWithTwoImages(
  comfyPage: ComfyPage,
  comfyFiles: ComfyFiles,
  nodeId: NodeId
) {
  const imageA = await uploadSolidImage(
    comfyPage,
    comfyFiles,
    'n2a_easyuse_a.png',
    RED
  )
  const imageB = await uploadSolidImage(
    comfyPage,
    comfyFiles,
    'n2a_easyuse_b.png',
    BLUE
  )
  await dispatchPackEvent(comfyPage, 'easyuse-image-choose', {
    id: Number(nodeId),
    urls: [imageA, imageB].map((filename) => ({
      filename,
      subfolder: '',
      type: 'input'
    }))
  })
  await expect
    .poll(() => nodeValue(comfyPage, nodeId, ['isWaitingSelection']))
    .toBe(true)
}

export async function selectedImages(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const selected: unknown = Reflect.get(
      window.app!.graph.getNodeById(id)!,
      'selected_images'
    )
    return selected instanceof Set ? [...selected] : null
  }, nodeId)
}

export async function clickConfirm(comfyPage: ComfyPage, nodeId: NodeId) {
  if (comfyPage.isVueNodes) {
    const button = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .getByRole('button', { name: CONFIRM_LABEL })
    await expect(button).toBeEnabled()
    await button.click()
    return
  }
  const {
    size: [width]
  } = await nodeGeometry(comfyPage, nodeId)
  const button = await legacyWidgetPoint(
    comfyPage,
    nodeId,
    CONFIRM_LABEL,
    width / 2,
    10
  )
  await comfyPage.page.mouse.click(button.x, button.y)
}
