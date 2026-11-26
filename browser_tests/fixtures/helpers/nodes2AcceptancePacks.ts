import type { NodeId } from '@comfyorg/graph-model/nodeId'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import type { Bounds, Point2D } from '@comfyorg/shared-frontend-utils/geometry'
import { createSolidPng } from '@e2e/fixtures/helpers/nodes2AcceptanceInputs'

import {
  decodePng,
  matchingPixels,
  nearColour
} from '@e2e/fixtures/helpers/decodedImage'
import { randomUUID } from 'node:crypto'

import type { ComfyFiles, ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import packData from '@e2e/fixtures/data/nodes2AcceptancePacks.json' with { type: 'json' }

export type ClientRect = Bounds

export type Rgb = readonly [number, number, number]

export const RED: Rgb = [255, 0, 0]
export const BLUE: Rgb = [0, 0, 255]
export const GREEN: Rgb = [0, 255, 0]
export const MAGENTA: Rgb = [255, 0, 255]

export const PACK_RENDERERS = [
  { name: 'classic', tags: [] },
  { name: 'Nodes 2.0', tags: ['@vue-nodes'] }
] as const

export const PACK_TAGS = ['@nodes2-acceptance', '@acceptance-packs'] as const

type PackDirectory = (typeof packData.packs)[number]['directory']

function packEntry(directory: PackDirectory) {
  const entry = packData.packs.find((pack) => pack.directory === directory)
  if (!entry) throw new Error(`Pack ${directory} is not pinned`)
  return entry
}

export async function expectPackLoaded(
  comfyPage: ComfyPage,
  directory: PackDirectory
) {
  const pack = packEntry(directory)
  const response = await comfyPage.request.get(
    `${comfyPage.url}/api/object_info`
  )
  expect(response.ok(), `${directory}: /object_info request failed`).toBe(true)
  const objectInfo: Record<string, unknown> = await response.json()
  const missingServerTypes = pack.serverNodeTypes.filter(
    (type) => !(type in objectInfo)
  )
  expect(
    missingServerTypes,
    `${directory}@${pack.commit.slice(0, 7)} node types missing from /object_info`
  ).toEqual([])

  const registered = await comfyPage.page.evaluate(
    (frontendTypes) => ({
      extensions: window.app!.extensions.map((extension) => extension.name),
      frontendTypes: frontendTypes.filter(
        (type) => !!window.LiteGraph!.registered_node_types[type]
      )
    }),
    pack.frontendNodeTypes
  )
  expect(
    pack.extensions.filter((name) => !registered.extensions.includes(name)),
    `${directory} frontend extensions not registered`
  ).toEqual([])
  expect(
    pack.frontendNodeTypes.filter(
      (type) => !registered.frontendTypes.includes(type)
    ),
    `${directory} frontend node types not registered`
  ).toEqual([])
}

export async function keepMixlabOffNodeDrawHooks(comfyPage: ComfyPage) {
  await comfyPage.page.route('**/manager/badge_mode', (route) =>
    route.fulfill({ status: 200, contentType: 'text/plain', body: 'none' })
  )
}

export async function showEmptyGraphAtZoomOne(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => {
    const app = window.app!
    app.graph.clear()
    app.canvas.ds.scale = 1
    app.canvas.ds.offset[0] = 0
    app.canvas.ds.offset[1] = 0
    app.canvas.setDirty(true, true)
  })
  await comfyPage.nextFrame()
}

export async function addPackNode(
  comfyPage: ComfyPage,
  type: string,
  pos: readonly [number, number],
  size?: readonly [number, number]
): Promise<NodeId> {
  const id = await comfyPage.page.evaluate(
    ({ type, pos, size }) => {
      const node = window.LiteGraph!.createNode(type)
      if (!node) return null
      node.pos = [pos[0], pos[1]]
      window.app!.graph.add(node)
      if (size) node.setSize([size[0], size[1]])
      window.app!.canvas.setDirty(true, true)
      return String(node.id)
    },
    { type, pos, size }
  )
  expect(id, `LiteGraph could not create ${type}`).not.toBeNull()
  const nodeId = toNodeId(id!)
  if (comfyPage.isVueNodes)
    await expect(comfyPage.vueNodes.getNodeLocator(nodeId)).toBeVisible()
  await comfyPage.nextFrame()
  return nodeId
}

export async function graphToClient(
  comfyPage: ComfyPage,
  point: readonly [number, number]
): Promise<{ x: number; y: number }> {
  const [x, y] = await comfyPage.page.evaluate(
    (graphPoint) =>
      window.app!.canvasPosToClientPos([graphPoint[0], graphPoint[1]]),
    point
  )
  return { x, y }
}

export async function nodeBodyPoint(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  fx: number,
  fy: number
) {
  const point = await comfyPage.page.evaluate(
    ({ nodeId, fx, fy }) => {
      const node = window.app!.graph.getNodeById(nodeId)!
      return [
        node.pos[0] + node.size[0] * fx,
        node.pos[1] + node.size[1] * fy
      ] as const
    },
    { nodeId, fx, fy }
  )
  return graphToClient(comfyPage, point)
}

export async function nodeScreenRect(
  comfyPage: ComfyPage,
  nodeId: NodeId
): Promise<ClientRect> {
  if (comfyPage.isVueNodes) {
    const box = await comfyPage.vueNodes.getNodeLocator(nodeId).boundingBox()
    if (!box) throw new Error(`Node ${nodeId} has no box`)
    return box
  }
  const [left, top, right, bottom] = await comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)!
    const titleHeight = window.LiteGraph!.NODE_TITLE_HEIGHT
    const [x0, y0] = window.app!.canvasPosToClientPos([
      node.pos[0],
      node.pos[1] - titleHeight
    ])
    const [x1, y1] = window.app!.canvasPosToClientPos([
      node.pos[0] + node.size[0],
      node.pos[1] + node.size[1]
    ])
    return [x0, y0, x1, y1]
  }, nodeId)
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export function padRect(rect: ClientRect, pad: number): ClientRect {
  return {
    x: rect.x - pad,
    y: rect.y - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2
  }
}

export async function redrawCanvas(comfyPage: ComfyPage) {
  await comfyPage.page.evaluate(() => window.app!.canvas.setDirty(true, true))
  await comfyPage.nextFrame()
}

export async function countColour(
  comfyPage: ComfyPage,
  rect: ClientRect,
  rgb: Rgb,
  tolerance = 40
): Promise<number> {
  await redrawCanvas(comfyPage)
  const viewport = comfyPage.page.viewportSize()!
  const x = Math.max(0, Math.round(rect.x))
  const y = Math.max(0, Math.round(rect.y))
  const image = await comfyPage.page.screenshot({
    clip: {
      x,
      y,
      width: Math.max(1, Math.min(viewport.width - x, Math.round(rect.width))),
      height: Math.max(
        1,
        Math.min(viewport.height - y, Math.round(rect.height))
      )
    }
  })
  return matchingPixels(
    await decodePng(comfyPage, image),
    nearColour(rgb, tolerance)
  ).length
}

export async function colourCentre(
  comfyPage: ComfyPage,
  rect: ClientRect,
  rgb: Rgb,
  tolerance = 40
): Promise<{ x: number; y: number } | null> {
  await redrawCanvas(comfyPage)
  const x = Math.max(0, Math.round(rect.x))
  const y = Math.max(0, Math.round(rect.y))
  const image = await comfyPage.page.screenshot({
    clip: {
      x,
      y,
      width: Math.max(1, Math.round(rect.width)),
      height: Math.max(1, Math.round(rect.height))
    }
  })
  const matches = matchingPixels(
    await decodePng(comfyPage, image),
    nearColour(rgb, tolerance)
  )
  if (matches.length === 0) return null
  const sum = matches.reduce(
    (total, point) => ({ x: total.x + point.x, y: total.y + point.y }),
    { x: 0, y: 0 }
  )
  return { x: x + sum.x / matches.length, y: y + sum.y / matches.length }
}

export async function uploadSolidImage(
  comfyPage: ComfyPage,
  comfyFiles: ComfyFiles,
  originalName: string,
  rgb: Rgb,
  size: readonly [number, number] = [256, 256]
) {
  const name = `${randomUUID()}-${originalName}`
  comfyFiles.deleteAfterTest({ filename: name, type: 'input' })
  const response = await comfyPage.request.post(
    `${comfyPage.url}/api/upload/image`,
    {
      multipart: {
        image: {
          name,
          mimeType: 'image/png',
          buffer: createSolidPng(size[0], size[1], [...rgb])
        },
        overwrite: 'true',
        type: 'input'
      }
    }
  )
  expect(response.ok(), `upload of ${name} failed`).toBe(true)
  return name
}

export const inputImage = (filename: string) => ({
  filename,
  subfolder: '',
  type: 'input'
})

export async function dispatchExecuted(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  output: Record<string, unknown>
) {
  await comfyPage.page.evaluate(
    ({ nodeId, output }) => {
      window.app!.api.dispatchCustomEvent('executed', {
        node: nodeId,
        display_node: nodeId,
        prompt_id: '',
        output
      })
    },
    { nodeId, output }
  )
  await comfyPage.nextFrame()
}

export async function dispatchPackEvent(
  comfyPage: ComfyPage,
  type: string,
  detail: unknown
) {
  await comfyPage.page.evaluate(
    ({ type, detail }) => {
      EventTarget.prototype.dispatchEvent.call(
        window.app!.api,
        new CustomEvent(type, { detail })
      )
    },
    { type, detail }
  )
  await comfyPage.nextFrame()
}

export async function legacyWidgetPoint(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  widgetName: string,
  x: number,
  y: number
) {
  if (comfyPage.isVueNodes) {
    const canvas = comfyPage.vueNodes
      .getNodeLocator(nodeId)
      .locator(`[data-widget-name="${widgetName}"] canvas`)
    await expect(canvas).toBeVisible()
    const box = await canvas.boundingBox()
    if (!box) throw new Error(`Widget ${widgetName} has no canvas box`)
    return { x: box.x + x, y: box.y + 1 + y }
  }
  const drawnTop = () =>
    comfyPage.page.evaluate(
      ({ nodeId, widgetName }) => {
        window.app!.canvas.setDirty(true, true)
        return window
          .app!.graph.getNodeById(nodeId)
          ?.widgets?.find((w) => w.name === widgetName)?.last_y
      },
      { nodeId, widgetName }
    )
  await expect
    .poll(drawnTop, { message: `${widgetName} drawn on the canvas` })
    .toEqual(expect.any(Number))
  const point = await comfyPage.page.evaluate(
    ({ nodeId, widgetName, x, y }) => {
      const node = window.app!.graph.getNodeById(nodeId)!
      const widget = node.widgets!.find((w) => w.name === widgetName)!
      return [node.pos[0] + x, node.pos[1] + widget.last_y! + y] as const
    },
    { nodeId, widgetName, x, y }
  )
  return graphToClient(comfyPage, point)
}

export async function widgetState(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  widgetName: string,
  path: readonly string[]
): Promise<unknown> {
  return comfyPage.page.evaluate(
    ({ nodeId, widgetName, path }) =>
      path.reduce<unknown>(
        (value, key) =>
          value !== null && typeof value === 'object'
            ? Reflect.get(value, key)
            : undefined,
        window
          .app!.graph.getNodeById(nodeId)
          ?.widgets?.find((widget) => widget.name === widgetName)
      ),
    { nodeId, widgetName, path }
  )
}

export async function nodeValue(
  comfyPage: ComfyPage,
  nodeId: NodeId,
  path: readonly string[]
): Promise<unknown> {
  return comfyPage.page.evaluate(
    ({ nodeId, path }) =>
      path.reduce<unknown>(
        (value, key) =>
          value !== null && typeof value === 'object'
            ? Reflect.get(value, key)
            : undefined,
        window.app!.graph.getNodeById(nodeId)
      ),
    { nodeId, path }
  )
}

export async function nodeGeometry(comfyPage: ComfyPage, nodeId: NodeId) {
  return comfyPage.page.evaluate((id) => {
    const node = window.app!.graph.getNodeById(id)!
    return { pos: [...node.pos], size: [...node.size] }
  }, nodeId)
}

export async function expectSplitColours(
  comfyPage: ComfyPage,
  split: Point2D,
  left: Rgb,
  right: Rgb
) {
  const leftSample = { x: split.x - 24, y: split.y - 5, width: 10, height: 10 }
  const rightSample = { x: split.x + 14, y: split.y - 5, width: 10, height: 10 }
  await expect(async () => {
    expect(await countColour(comfyPage, leftSample, left)).toBeGreaterThan(80)
    expect(await countColour(comfyPage, rightSample, right)).toBeGreaterThan(80)
    expect(await countColour(comfyPage, leftSample, right)).toBe(0)
    expect(await countColour(comfyPage, rightSample, left)).toBe(0)
  }).toPass({ timeout: 10_000 })
}

const isTetrisPieceColour = (r: number, g: number, b: number) =>
  Math.max(r, g, b) > 100 && Math.max(r, g, b) - Math.min(r, g, b) > 80

export async function tetrisPiecePixels(comfyPage: ComfyPage, field: Bounds) {
  await redrawCanvas(comfyPage)
  const png = await comfyPage.page.screenshot({ clip: field })
  return matchingPixels(await decodePng(comfyPage, png), isTetrisPieceColour)
    .length
}
