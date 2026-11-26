import { randomUUID } from 'node:crypto'

import type { Locator } from '@playwright/test'

import type { NodeId } from '@comfyorg/graph-model/nodeId'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import {
  center,
  colourDistance,
  createSolidPng,
  ksamplerBodyRect,
  readScreenPixels,
  uploadInputImage,
  widgetRow
} from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'
import type { ClientRect } from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'
import { TestIds } from '@e2e/fixtures/selectors'

const SOLID_IMAGE_SIZE = 512

export async function boxOf(
  locator: Locator,
  what: string
): Promise<ClientRect> {
  await expect(locator, `${what} is shown`).toBeVisible()
  const box = await locator.boundingBox()
  if (!box) throw new Error(`${what} has no box`)
  return box
}

export async function classicSocketDiameter(
  comfyPage: ComfyPage,
  input: string
) {
  const [x, y] = await comfyPage.page.evaluate((name) => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    const index = node.inputs.findIndex((slot) => slot.name === name)
    return window.app!.canvasPosToClientPos(node.getInputPos(index))
  }, input)
  const rect = {
    x: Math.round(x) - 8,
    y: Math.round(y) - 8,
    width: 16,
    height: 16
  }
  const pixels = await readScreenPixels(comfyPage, rect)
  const background = pixels.rgb(0, 0)
  const fill = pixels.rgb(Math.floor(x) - rect.x, Math.floor(y) - rect.y)
  const contrast = colourDistance(fill, background)
  expect(contrast, `${input} socket is drawn`).toBeGreaterThan(60)
  let covered = 0
  for (let row = 0; row < pixels.height; row++)
    for (let column = 0; column < pixels.width; column++)
      covered += Math.min(
        1,
        colourDistance(pixels.rgb(column, row), background) / contrast
      )
  return 2 * Math.sqrt(covered / Math.PI)
}

export async function classicWidgetInsets(comfyPage: ComfyPage, name: string) {
  const node = await ksamplerBodyRect(comfyPage)
  const row = await widgetRow(comfyPage, name)
  const strip = {
    x: Math.floor(node.x),
    y: Math.floor(center(row).y),
    width: Math.ceil(node.x + node.width) - Math.floor(node.x),
    height: 1
  }
  const pixels = await readScreenPixels(comfyPage, strip)
  const firstDrawn = (columns: number[]) => {
    const background = pixels.rgb(columns[0], 0)
    const column = columns.find(
      (x) => colourDistance(pixels.rgb(x, 0), background) > 30
    )
    if (column === undefined) throw new Error(`${name} row is not drawn`)
    return strip.x + column + 0.5
  }
  const inside = Array.from(
    { length: pixels.width - 6 },
    (_, index) => index + 3
  )
  return {
    left: firstDrawn(inside) - node.x,
    right: node.x + node.width - firstDrawn(inside.toReversed())
  }
}

export async function vueWidgetInsets(comfyPage: ComfyPage, name: string) {
  const vueNode = comfyPage.vueNodes.getNodeByTitle('KSampler')
  const node = await boxOf(
    vueNode.getByTestId(TestIds.node.innerWrapper),
    'KSampler node'
  )
  const control = await boxOf(
    vueNode
      .locator(`[data-widget-name="${name}"]`)
      .getByTestId(TestIds.widgets.numberRow),
    `${name} control`
  )
  return {
    left: control.x - node.x,
    right: node.x + node.width - (control.x + control.width)
  }
}

export async function widgetRowTop(comfyPage: ComfyPage, name: string) {
  if (comfyPage.isVueNodes)
    return (
      await boxOf(
        comfyPage.vueNodes
          .getNodeByTitle('KSampler')
          .locator(`[data-widget-name="${name}"]`),
        `${name} row`
      )
    ).y
  return (await widgetRow(comfyPage, name)).y
}

async function savedSize(comfyPage: ComfyPage, id: NodeId) {
  return comfyPage.page.evaluate((nodeId) => {
    const saved = window
      .app!.graph.serialize()
      .nodes.find((node) => String(node.id) === String(nodeId))
    if (!saved) throw new Error(`Node ${nodeId} is not saved`)
    return [saved.size[0], saved.size[1]]
  }, id)
}

export async function settledSavedSize(comfyPage: ComfyPage, id: NodeId) {
  let previous = await savedSize(comfyPage, id)
  await expect
    .poll(async () => {
      await comfyPage.nextFrame()
      const next = await savedSize(comfyPage, id)
      const unchanged = next[0] === previous[0] && next[1] === previous[1]
      previous = next
      return unchanged
    })
    .toBe(true)
  return previous
}

export async function expectImageShown(
  comfyPage: ComfyPage,
  id: NodeId,
  vueNodes: boolean
) {
  if (vueNodes) {
    const image = comfyPage.vueNodes
      .getNodeLocator(String(id))
      .getByTestId(TestIds.node.mainImage)
    await expect(image, 'Load Image preview is shown').toBeVisible()
    await expect
      .poll(() =>
        image.evaluate((img: HTMLImageElement) =>
          img.complete ? img.naturalWidth : 0
        )
      )
      .toBe(SOLID_IMAGE_SIZE)
    return
  }
  await expect
    .poll(
      () =>
        comfyPage.page.evaluate((nodeId) => {
          const node = window.app!.graph.getNodeById(nodeId)!
          window.app!.canvas.setDirty(true, true)
          const loaded = node.imgs?.[0]?.naturalWidth ?? 0
          const previewed = node.widgets?.some(
            (widget) => widget.name === '$$canvas-image-preview'
          )
          return previewed ? loaded : 0
        }, id),
      { message: 'Load Image preview is drawn' }
    )
    .toBe(SOLID_IMAGE_SIZE)
}

export async function addLoadImageShowing(
  comfyPage: ComfyPage,
  vueNodes: boolean,
  filename: string
) {
  const loadImage = await comfyPage.nodeOps.addNode(
    'LoadImage',
    {},
    { x: 300, y: 500 }
  )
  await comfyPage.page.evaluate(
    ([id, name]) => {
      const node = window.app!.graph.getNodeById(id)!
      const widget = node.widgets!.find((w) => w.name === 'image')!
      widget.value = name
      widget.callback?.(name)
      window.app!.canvas.ds.scale = 1
    },
    [loadImage.id, filename] as const
  )
  await loadImage.centerOnNode()
  await expectImageShown(comfyPage, loadImage.id, vueNodes)
  return loadImage.id
}

export async function classicLoadImageHeight(
  comfyPage: ComfyPage,
  filename: string
) {
  if (comfyPage.isVueNodes)
    await comfyPage.menu.topbar.setVueNodesEnabled(false)
  const probe = await addLoadImageShowing(comfyPage, false, filename)
  const [, height] = await settledSavedSize(comfyPage, probe)
  await comfyPage.page.evaluate((id) => {
    window.app!.graph.remove(window.app!.graph.getNodeById(id)!)
  }, probe)
  if (comfyPage.isVueNodes) await comfyPage.menu.topbar.setVueNodesEnabled(true)
  return height
}

export async function uploadInputSolidImage(
  comfyPage: ComfyPage,
  comfyFiles: {
    deleteAfterTest: (file: { filename: string; type: string }) => void
  }
) {
  const filename = `nodes2_acceptance_solid_${randomUUID()}.png`
  comfyFiles.deleteAfterTest({ filename, type: 'input' })
  await uploadInputImage(
    comfyPage,
    filename,
    createSolidPng(SOLID_IMAGE_SIZE, SOLID_IMAGE_SIZE, [200, 40, 40])
  )
  return filename
}

export async function stepsSocketShown(comfyPage: ComfyPage) {
  if (comfyPage.isVueNodes)
    return comfyPage.vueNodes
      .getNodeByTitle('KSampler')
      .locator('[data-widget-name="steps"]')
      .getByTestId('slot-dot')
      .evaluate((dot) => {
        let opacity = 1
        for (let e: Element | null = dot; e; e = e.parentElement)
          opacity *= Number(getComputedStyle(e).opacity)
        return opacity >= 0.5
      })
  const [x, y] = await comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    window.app!.canvas.setDirty(true, true)
    const index = node.inputs.findIndex((slot) => slot.name === 'steps')
    return window.app!.canvasPosToClientPos(node.getInputPos(index))
  })
  const pixels = await readScreenPixels(comfyPage, {
    x: Math.round(x) - 5,
    y: Math.round(y) - 5,
    width: 9,
    height: 9
  })
  const background = pixels.rgb(0, 0)
  let drawn = 0
  for (let row = 0; row < pixels.height; row++)
    for (let column = 0; column < pixels.width; column++)
      if (colourDistance(pixels.rgb(column, row), background) > 30) drawn++
  return drawn >= 25
}
