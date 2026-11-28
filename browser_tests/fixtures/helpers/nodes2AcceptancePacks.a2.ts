import type { NodeId } from '@comfyorg/graph-model/nodeId'

import {
  decodePng,
  matchingPixels,
  nearColour
} from '@e2e/fixtures/helpers/decodedImage'
import { randomUUID } from 'node:crypto'

import type { ComfyFiles, ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyExpect as expect } from '@e2e/fixtures/ComfyPage'
import type {
  ClientRect,
  Rgb
} from '@e2e/fixtures/helpers/nodes2AcceptancePacks'

export async function countColourInImage(
  comfyPage: ComfyPage,
  image: Buffer,
  rgb: Rgb,
  tolerance = 8
): Promise<number> {
  return matchingPixels(
    await decodePng(comfyPage, image),
    nearColour(rgb, tolerance)
  ).length
}

function sineWav(seconds: number, sampleRate = 8000): Buffer {
  const samples = Math.round(seconds * sampleRate)
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'ascii')
  header.writeUInt32LE(36 + samples * 2, 4)
  header.write('WAVEfmt ', 8, 'ascii')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(sampleRate, 24)
  header.writeUInt32LE(sampleRate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'ascii')
  header.writeUInt32LE(samples * 2, 40)
  const data = Buffer.alloc(samples * 2)
  for (let i = 0; i < samples; i++)
    data.writeInt16LE(
      Math.round(Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 16000),
      i * 2
    )
  return Buffer.concat([header, data])
}

export async function uploadToneWav(
  comfyPage: ComfyPage,
  comfyFiles: ComfyFiles,
  originalName: string
) {
  const name = `${randomUUID()}-${originalName}`
  comfyFiles.deleteAfterTest({ filename: name, type: 'input' })
  const response = await comfyPage.request.post(
    `${comfyPage.url}/api/upload/image`,
    {
      multipart: {
        image: { name, mimeType: 'audio/wav', buffer: sineWav(0.5) },
        overwrite: 'true',
        type: 'input'
      }
    }
  )
  if (!response.ok()) throw new Error(`upload of ${name} failed`)
  return name
}

export async function expectPointOnCanvasOrNode(
  comfyPage: ComfyPage,
  point: { x: number; y: number },
  nodeId?: NodeId
) {
  const hit = await comfyPage.page.evaluate(
    ({ point, nodeId }) => {
      const element = document.elementFromPoint(point.x, point.y)
      if (!element) return 'nothing'
      if (element === window.app!.canvasEl) return 'canvas'
      const node = element.closest('[data-node-id]')
      if (node && node.getAttribute('data-node-id') === String(nodeId))
        return 'node'
      return element.outerHTML.slice(0, 120)
    },
    { point, nodeId }
  )
  expect(['canvas', 'node'], `element under ${point.x},${point.y}`).toContain(
    hit
  )
}

export async function panCanvasBy(
  comfyPage: ComfyPage,
  dx: number,
  dy: number
) {
  await comfyPage.page.evaluate(
    ({ dx, dy }) => {
      const canvas = window.app!.canvas
      canvas.ds.offset[0] += dx
      canvas.ds.offset[1] += dy
      canvas.setDirty(true, true)
    },
    { dx, dy }
  )
  await comfyPage.nextFrame()
}

export function contains(outer: ClientRect, inner: ClientRect) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  )
}
