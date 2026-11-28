import { crc32, deflateSync } from 'node:zlib'

import { decodePng, matchingPixels } from '@e2e/fixtures/helpers/decodedImage'
import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

interface ClientRect {
  x: number
  y: number
  width: number
  height: number
}

const CLASSIC_WIDGET_MARGIN = 15

export const RENDERERS = [
  { name: 'classic', tags: [] },
  { name: 'Nodes 2.0', tags: ['@vue-nodes'] }
] as const

export async function showKSamplerAtZoomOne(comfyPage: ComfyPage) {
  const [node] = await comfyPage.nodeOps.getNodeRefsByType('KSampler')
  await comfyPage.page.evaluate(() => {
    window.app!.canvas.ds.scale = 1
  })
  await node.centerOnNode()
  await comfyPage.nextFrame()
  return node
}

export async function addKSamplerWidget(
  comfyPage: ComfyPage,
  widget: {
    type: 'number' | 'slider' | 'text' | 'toggle' | 'combo' | 'knob'
    name: string
    value: string | number | boolean
    options?: Record<string, unknown>
  }
) {
  await comfyPage.page.evaluate(({ type, name, value, options }) => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    node.properties[`${name}_callbacks`] = 0
    node.addWidget(
      type,
      name,
      value,
      () => {
        const key = `${name}_callbacks`
        node.properties[key] = Number(node.properties[key]) + 1
      },
      options ?? {}
    )
    window.app!.canvas.setDirty(true, true)
  }, widget)
  await comfyPage.nextFrame()
}

export async function nodeProperty(comfyPage: ComfyPage, key: string) {
  return comfyPage.page.evaluate((propertyKey) => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    return node.properties[propertyKey]
  }, key)
}

export async function widgetValue(comfyPage: ComfyPage, name: string) {
  return comfyPage.page.evaluate((widgetName) => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    return node.widgets!.find((w) => w.name === widgetName)!.value
  }, name)
}

export async function callbackCount(comfyPage: ComfyPage, name: string) {
  return comfyPage.page.evaluate((widgetName) => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    return Number(node.properties[`${widgetName}_callbacks`])
  }, name)
}

export async function widgetRow(
  comfyPage: ComfyPage,
  name: string
): Promise<ClientRect> {
  if (comfyPage.isVueNodes) {
    const row = comfyPage.vueNodes.getWidgetRowByLabel('KSampler', name).first()
    await expect(row).toBeVisible()
    const box = await row.boundingBox()
    if (!box) throw new Error(`Widget row ${name} has no box`)
    return box
  }
  await expect
    .poll(() =>
      comfyPage.page.evaluate((widgetName) => {
        const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
        window.app!.canvas.setDirty(true, true)
        return node.widgets!.find((w) => w.name === widgetName)!.last_y
      }, name)
    )
    .toBeDefined()
  return comfyPage.page.evaluate(
    ([widgetName, margin]) => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
      const widget = node.widgets!.find((w) => w.name === widgetName)!
      const [x, y, width] = node.getBounding()
      const top = y + window.LiteGraph!.NODE_TITLE_HEIGHT + widget.last_y!
      const height = window.LiteGraph!.NODE_WIDGET_HEIGHT
      const [left, clientTop] = window.app!.canvasPosToClientPos([
        x + margin,
        top
      ])
      const [right, clientBottom] = window.app!.canvasPosToClientPos([
        x + width - margin,
        top + height
      ])
      return {
        x: left,
        y: clientTop,
        width: right - left,
        height: clientBottom - clientTop
      }
    },
    [name, CLASSIC_WIDGET_MARGIN] as const
  )
}

export async function dragHorizontally(
  comfyPage: ComfyPage,
  from: { x: number; y: number },
  distance: number
) {
  const { mouse } = comfyPage.page
  await mouse.move(from.x, from.y)
  await mouse.down()
  await mouse.move(from.x + distance, from.y, { steps: 10 })
  await mouse.up()
  await comfyPage.nextFrame()
}

export const center = (rect: ClientRect) => ({
  x: rect.x + rect.width / 2,
  y: rect.y + rect.height / 2
})

export type { ClientRect }

export async function setKSamplerWidgetValue(
  comfyPage: ComfyPage,
  name: string,
  value: string | number | boolean
) {
  await comfyPage.page.evaluate(
    ([widgetName, widgetValue]) => {
      const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
      node.widgets!.find((w) => w.name === widgetName)!.value = widgetValue
      window.app!.canvas.setDirty(true, true)
    },
    [name, value] as const
  )
  await comfyPage.nextFrame()
}

export async function ksamplerBodyRect(
  comfyPage: ComfyPage
): Promise<ClientRect> {
  return comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    const [left, top] = window.app!.canvasPosToClientPos([
      node.pos[0],
      node.pos[1]
    ])
    const [right, bottom] = window.app!.canvasPosToClientPos([
      node.pos[0] + node.size[0],
      node.pos[1] + node.size[1]
    ])
    return { x: left, y: top, width: right - left, height: bottom - top }
  })
}

async function pixelsMatching(
  comfyPage: ComfyPage,
  rect: ClientRect,
  kind: 'bright' | 'saturated'
): Promise<number> {
  const image = await comfyPage.page.screenshot({
    clip: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height))
    }
  })
  return matchingPixels(
    await decodePng(comfyPage, image),
    kind === 'bright'
      ? (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b > 170
      : (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) > 60
  ).length
}

export const brightPixels = (comfyPage: ComfyPage, rect: ClientRect) =>
  pixelsMatching(comfyPage, rect, 'bright')

export const saturatedPixels = (comfyPage: ComfyPage, rect: ClientRect) =>
  pixelsMatching(comfyPage, rect, 'saturated')

export async function typeIntoNumber(
  comfyPage: ComfyPage,
  name: string,
  text: string
) {
  if (comfyPage.isVueNodes) {
    const input = comfyPage.vueNodes
      .getWidgetRowByLabel('KSampler', name)
      .first()
      .locator('input')
    const box = await input.boundingBox()
    if (!box) throw new Error(`No input for ${name}`)
    await comfyPage.page.mouse.click(center(box).x, center(box).y)
    await expect(input).toBeFocused()
    await comfyPage.page.keyboard.press('ControlOrMeta+A')
    await comfyPage.page.keyboard.type(text)
    return
  }
  const row = await widgetRow(comfyPage, name)
  await comfyPage.page.mouse.click(center(row).x, center(row).y)
  const prompt = comfyPage.page.locator('.graphdialog input')
  await expect(prompt).toBeFocused()
  await prompt.press('ControlOrMeta+A')
  await comfyPage.page.keyboard.type(text)
}

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(typeAndData))
  return Buffer.concat([length, typeAndData, crc])
}

/** Encodes an opaque RGB PNG filled with one colour. */
export function createSolidPng(
  width: number,
  height: number,
  [red, green, blue]: [number, number, number]
): Buffer {
  const row = Buffer.alloc(1 + width * 3)
  for (let x = 0; x < width; x++) row.set([red, green, blue], 1 + x * 3)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk(
      'IDAT',
      deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))
    ),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

export async function uploadInputImage(
  comfyPage: ComfyPage,
  filename: string,
  png: Buffer
) {
  const response = await comfyPage.page.request.post(
    `${comfyPage.url}/api/upload/image`,
    {
      multipart: {
        image: { name: filename, mimeType: 'image/png', buffer: png },
        overwrite: 'true',
        type: 'input'
      }
    }
  )
  expect(response.ok(), `upload of ${filename} accepted`).toBe(true)
}

interface ScreenPixels {
  width: number
  height: number
  rgb: (x: number, y: number) => [number, number, number]
}

export async function readScreenPixels(
  comfyPage: ComfyPage,
  rect: ClientRect
): Promise<ScreenPixels> {
  const image = await comfyPage.page.screenshot({ clip: rect })
  const { width, height, rgba } = await decodePng(comfyPage, image)
  return {
    width,
    height,
    rgb: (x, y) => {
      const offset = (y * width + x) * 4
      return [rgba[offset], rgba[offset + 1], rgba[offset + 2]]
    }
  }
}

export const colourDistance = (
  [r1, g1, b1]: [number, number, number],
  [r2, g2, b2]: [number, number, number]
) => Math.abs(r1 - r2) + Math.abs(g1 - g2) + Math.abs(b1 - b2)

export async function openKSamplerComboList(
  comfyPage: ComfyPage,
  name: string,
  { hasSearch }: { hasSearch: boolean }
) {
  const { page } = comfyPage
  if (comfyPage.isVueNodes) {
    await comfyPage.vueNodes
      .getWidgetRowByLabel('KSampler', name)
      .first()
      .getByTestId('widget-select-default-trigger')
      .click()
    await expect(
      page.getByTestId('widget-select-default-overlay')
    ).toBeVisible()
    if (hasSearch)
      await expect(
        page.getByTestId(TestIds.widgets.selectDefaultSearchInput)
      ).toBeFocused()
    return
  }
  const row = await widgetRow(comfyPage, name)
  await page.mouse.click(center(row).x, center(row).y)
  await expect(page.locator('.litecontextmenu')).toBeVisible()
  if (hasSearch)
    await expect(page.locator('.comfy-context-menu-filter')).toBeFocused()
}

export async function firstSocketOffsets(comfyPage: ComfyPage) {
  return comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    const input = node.getInputPos(0)
    const output = node.getOutputPos(0)
    return {
      inputX: input[0] - node.pos[0],
      inputY: input[1] - node.pos[1],
      outputX: output[0] - node.pos[0] - node.size[0],
      outputY: output[1] - node.pos[1]
    }
  })
}

export async function samplerOptions(comfyPage: ComfyPage): Promise<string[]> {
  return comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    const values = node.widgets!.find((w) => w.name === 'sampler_name')!.options
      .values
    return Array.isArray(values) ? values.map(String) : []
  })
}

export async function stepCombo(
  comfyPage: ComfyPage,
  name: string,
  direction: 'previous' | 'next'
) {
  if (comfyPage.isVueNodes) {
    const arrow = await comfyPage.vueNodes
      .getWidgetRowByLabel('KSampler', name)
      .first()
      .getByRole('button', { name: new RegExp(direction, 'i') })
      .boundingBox()
    if (!arrow) throw new Error(`No ${direction} arrow on ${name}`)
    await comfyPage.page.mouse.click(center(arrow).x, center(arrow).y)
  } else {
    const row = await widgetRow(comfyPage, name)
    const x = direction === 'previous' ? row.x + 5 : row.x + row.width - 5
    await comfyPage.page.mouse.click(x, row.y + row.height / 2)
  }
  await comfyPage.nextFrame()
}

export async function clickEmptyCanvasAboveKSampler(comfyPage: ComfyPage) {
  const point = await comfyPage.page.evaluate(() => {
    const node = window.app!.graph.nodes.find((n) => n.type === 'KSampler')!
    return window.app!.canvasPosToClientPos([
      node.pos[0] + node.size[0] / 2,
      node.pos[1] - window.LiteGraph!.NODE_TITLE_HEIGHT - 60
    ])
  })
  await comfyPage.page.mouse.click(point[0], point[1])
  await comfyPage.nextFrame()
}
