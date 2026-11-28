import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export type EmphasisCheck = (emphasized: boolean) => Promise<void>

const NODE_CLIP_PADDING = 24

export async function canvasNodeEmphasis(
  comfyPage: ComfyPage,
  title: string,
  mask: Locator
): Promise<EmphasisCheck> {
  const bounds = await (
    await comfyPage.nodeOps.getNodeRefByTitle(title)
  ).getBounding()
  const clip = await comfyPage.page.evaluate(
    ({ x, y, width, height, padding }) => {
      const [left, top] = window.app!.canvasPosToClientPos([x, y])
      const [right, bottom] = window.app!.canvasPosToClientPos([
        x + width,
        y + height
      ])
      return {
        x: left - padding,
        y: top - padding,
        width: right - left + padding * 2,
        height: bottom - top + padding * 2
      }
    },
    { ...bounds, padding: NODE_CLIP_PADDING }
  )
  const screenshotNode = () =>
    comfyPage.page.screenshot({
      clip,
      mask: [mask],
      animations: 'disabled'
    })
  const idleNode = await screenshotNode()

  return async (emphasized) => {
    await expect
      .poll(async () => (await screenshotNode()).equals(idleNode))
      .toBe(!emphasized)
  }
}

export async function vueNodeEmphasis(
  comfyPage: ComfyPage,
  title: string
): Promise<EmphasisCheck> {
  const node = await comfyPage.vueNodes.getFixtureByTitle(title)

  return async (emphasized) => {
    await expect(comfyPage.vueNodes.emphasizedNodes).toHaveCount(
      emphasized ? 1 : 0
    )
    await expect(node.stateOutline).toBeVisible({ visible: emphasized })
  }
}
