import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyFiles, ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  BLUE,
  RED,
  addPackNode,
  dispatchExecuted,
  inputImage,
  legacyWidgetPoint,
  redrawCanvas,
  uploadSolidImage,
  widgetState
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

export async function widgetValue(
  comfyPage: ComfyPage,
  id: NodeId,
  name: string
) {
  return widgetState(comfyPage, id, name, ['value'])
}

export async function addImageCompareWithRunOutput(
  comfyPage: ComfyPage,
  comfyFiles: ComfyFiles
) {
  const imageA = await uploadSolidImage(
    comfyPage,
    comfyFiles,
    'n2a_deno_a.png',
    RED,
    [512, 256]
  )
  const imageB = await uploadSolidImage(
    comfyPage,
    comfyFiles,
    'n2a_deno_b.png',
    BLUE,
    [512, 256]
  )
  const id = await addPackNode(comfyPage, 'DenoImageCompare', [150, 110])
  await dispatchExecuted(comfyPage, id, {
    a_images: [inputImage(imageA)],
    b_images: [inputImage(imageB)]
  })
  await expect
    .poll(() =>
      comfyPage.page.evaluate((nodeId) => {
        const node = window.app!.graph.getNodeById(nodeId)!
        const images: Record<'a' | 'b', { loaded: boolean } | null> =
          Reflect.get(node, '__denoImageCompareImages') ?? {}
        return Boolean(images.a?.loaded && images.b?.loaded)
      }, id)
    )
    .toBe(true)
  return id
}

export async function comparePanelWidth(comfyPage: ComfyPage, id: NodeId) {
  const nodeWidth = await comfyPage.page.evaluate(
    (nodeId) => window.app!.graph.getNodeById(nodeId)!.size[0],
    id
  )
  return Math.max(nodeWidth - 28, 532)
}

export async function previewPoint(
  comfyPage: ComfyPage,
  id: NodeId,
  fx: number
) {
  const panelWidth = await comparePanelWidth(comfyPage, id)
  return legacyWidgetPoint(
    comfyPage,
    id,
    'deno_image_compare_canvas',
    26 + (panelWidth - 24) * fx,
    246
  )
}

export async function toggleBounds(
  comfyPage: ComfyPage,
  id: NodeId,
  row: string
) {
  await expect
    .poll(async () => {
      await redrawCanvas(comfyPage)
      return widgetState(comfyPage, id, row, [
        'hitAreas',
        'toggle',
        'bounds',
        '1'
      ])
    })
    .toBeGreaterThan(0)
  const bounds = await widgetState(comfyPage, id, row, [
    'hitAreas',
    'toggle',
    'bounds'
  ])
  if (!Array.isArray(bounds)) throw new Error('toggle bounds missing')
  return bounds.map(Number)
}
