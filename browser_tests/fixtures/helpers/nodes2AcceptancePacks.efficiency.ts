import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export const KSAMPLER = 'KSampler (Efficient)'

export const SEED_BUTTON = '🎲 Randomize / ♻️ Last Queued Seed'

export async function visibleLoraNameRows(
  comfyPage: ComfyPage,
  nodeId: NodeId
) {
  if (comfyPage.isVueNodes)
    return comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator('[data-widget-name^="lora_name_"]:visible')
      .count()
  return comfyPage.page.evaluate(
    (id) =>
      window
        .app!.graph.getNodeById(id)!
        .widgets!.filter(
          (w) =>
            w.name.startsWith('lora_name_') &&
            !w.type.startsWith('tschide') &&
            !w.hidden
        ).length,
    nodeId
  )
}

export async function setLoraCount(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  count: number
) {
  await comfyPage.page.evaluate(
    ({ id, count }) => {
      const node = window.app!.graph.getNodeById(id)!
      node.widgets!.find((w) => w.name === 'lora_count')!.value = count
      window.app!.canvas.setDirty(true, true)
    },
    { id: nodeId, count }
  )
}

export async function previewImageBox(comfyPage: ComfyPage, filename: string) {
  const image = comfyPage.page.locator(`body > img[src*="${filename}"]`)
  await expect(image).toBeVisible()
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.complete))
    .toBe(true)
  const box = await image.boundingBox()
  if (!box) throw new Error('preview image has no box')
  return box
}
