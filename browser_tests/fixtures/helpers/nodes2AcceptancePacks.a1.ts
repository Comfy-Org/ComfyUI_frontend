import type { NodeId } from '@comfyorg/graph-model/nodeId'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type { ClientRect } from '@e2e/fixtures/helpers/nodes2AcceptancePacks'
import {
  graphToClient,
  redrawCanvas
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

declare global {
  interface Window {
    __nodes2QueueCalls?: { queuePrompt: number; interrupt: number }
  }
}

export async function nodeLocalPoint(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  local: readonly [number, number]
) {
  const point = await comfyPage.page.evaluate(
    ({ nodeId, local }) => {
      const node = window.app!.graph.getNodeById(nodeId)!
      return [node.pos[0] + local[0], node.pos[1] + local[1]] as const
    },
    { nodeId, local }
  )
  return graphToClient(comfyPage, point)
}

export async function nodeLocalRect(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  rect: readonly [number, number, number, number]
): Promise<ClientRect> {
  const topLeft = await nodeLocalPoint(comfyPage, nodeId, [rect[0], rect[1]])
  const bottomRight = await nodeLocalPoint(comfyPage, nodeId, [
    rect[0] + rect[2],
    rect[1] + rect[3]
  ])
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y
  }
}

export async function countQueueCalls(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    const calls = { queuePrompt: 0, interrupt: 0 }
    window.__nodes2QueueCalls = calls
    const app = window.app!
    Reflect.set(app, 'queuePrompt', async () => {
      calls.queuePrompt += 1
      return true
    })
    Reflect.set(app.api, 'interrupt', async () => {
      calls.interrupt += 1
    })
  })
}

export async function queueCalls(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(
    () => window.__nodes2QueueCalls ?? { queuePrompt: 0, interrupt: 0 }
  )
}

export async function clickButtonWidget(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  name: string
) {
  if (comfyPage.isVueNodes) {
    await comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator(`[data-widget-name="${name}"]`)
      .getByRole('button')
      .click()
    return
  }
  const centre = await comfyPage.page.evaluate(
    ({ nodeId, name }) => {
      const node = window.app!.graph.getNodeById(nodeId)!
      const widget = node.widgets!.find((w) => w.name === name)!
      return [
        node.size[0] / 2,
        (widget.last_y ?? 0) + window.LiteGraph!.NODE_WIDGET_HEIGHT / 2
      ] as const
    },
    { nodeId, name }
  )
  const point = await nodeLocalPoint(comfyPage, nodeId, centre)
  await comfyPage.page.mouse.click(point.x, point.y)
}

export async function widgetClientTop(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  name: string
) {
  if (comfyPage.isVueNodes) {
    const box = await comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator(`[data-widget-name="${name}"]`)
      .boundingBox()
    if (!box) throw new Error(`Widget ${name} has no box`)
    return box.y
  }
  await expect
    .poll(async () => {
      await redrawCanvas(comfyPage)
      return comfyPage.page.evaluate(
        ({ nodeId, name }) =>
          window
            .app!.graph.getNodeById(nodeId)!
            .widgets!.find((w) => w.name === name)?.last_y,
        { nodeId, name }
      )
    })
    .toBeGreaterThan(0)
  const lastY = await comfyPage.page.evaluate(
    ({ nodeId, name }) =>
      window
        .app!.graph.getNodeById(nodeId)!
        .widgets!.find((w) => w.name === name)!.last_y!,
    { nodeId, name }
  )
  return (await nodeLocalPoint(comfyPage, nodeId, [0, lastY])).y
}

export async function panCanvasY(
  comfyPage: ComfyPage,
  clientY: number,
  targetY: number
) {
  await comfyPage.page.evaluate((delta) => {
    const canvas = window.app!.canvas
    canvas.ds.offset[1] += delta
    canvas.setDirty(true, true)
  }, targetY - clientY)
  await comfyPage.nextFrame()
}

export async function selectedNodeIds(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() =>
    [...window.app!.canvas.selectedItems].flatMap((item) =>
      'id' in item ? [String(item.id)] : []
    )
  )
}
