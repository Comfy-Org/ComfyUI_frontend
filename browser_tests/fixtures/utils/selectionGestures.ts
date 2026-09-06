import type { Locator } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { Position } from '@e2e/fixtures/types'
import { sleep } from '@e2e/fixtures/utils/timing'

export async function titleCenter(title: Locator): Promise<Position> {
  await title.hover()
  const box = await title.boundingBox()
  if (!box) throw new Error('Title must be rendered before pressing')
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

export async function pressMoveRelease(
  comfyPage: ComfyPage,
  origin: Position,
  delta: Position,
  holdMs = 0
) {
  await comfyPage.page.mouse.move(origin.x, origin.y)
  await comfyPage.page.mouse.down()
  try {
    // Deliberate hold tests time-based drag promotion, not rendering readiness.
    if (holdMs) await sleep(holdMs)
    await comfyPage.page.mouse.move(origin.x + delta.x, origin.y + delta.y)
  } finally {
    await comfyPage.page.mouse.up()
  }
  await comfyPage.nextFrame()
}

export async function groupBounds(comfyPage: ComfyPage, title: string) {
  return comfyPage.page.evaluate((title) => {
    const app = window.app!
    const group = app.graph.groups.find((group) => group.title === title)
    if (!group) throw new Error(`Group "${title}" must exist`)
    const [x, y] = app.canvasPosToClientPos(group.pos)
    return {
      x,
      y,
      width: group.size[0] * app.canvas.ds.scale,
      height: group.size[1] * app.canvas.ds.scale
    }
  }, title)
}

export async function nodeZIndex(node: Locator) {
  return node.evaluate((element) => Number(getComputedStyle(element).zIndex))
}

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
