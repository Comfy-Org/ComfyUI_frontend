import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

export async function marqueeAround(comfyPage: ComfyPage, nodes: Locator) {
  const boxes = await nodes.evaluateAll((elements) =>
    elements.map((element) => {
      const { left, top, right, bottom } = element.getBoundingClientRect()
      return { left, top, right, bottom }
    })
  )
  if (!boxes.length) throw new Error('Marquee targets must be rendered')

  await comfyPage.canvasOps.dragAndDrop(
    {
      x: Math.min(...boxes.map((box) => box.left)) - 20,
      y: Math.min(...boxes.map((box) => box.top)) - 20
    },
    {
      x: Math.max(...boxes.map((box) => box.right)) + 20,
      y: Math.max(...boxes.map((box) => box.bottom)) + 20
    }
  )
}
