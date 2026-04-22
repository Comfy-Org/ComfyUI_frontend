import { describe, expect, it } from 'vitest'

import { getWebpMetadata } from './pnginfo'

function buildExifPayload(workflowJson: string): Uint8Array {
  const fullStr = `workflow:${workflowJson}\0`
  const strBytes = new TextEncoder().encode(fullStr)

  const headerSize = 22
  const buf = new Uint8Array(headerSize + strBytes.length)
  const dv = new DataView(buf.buffer)

  buf.set([0x49, 0x49], 0)
  dv.setUint16(2, 0x002a, true)
  dv.setUint32(4, 8, true)
  dv.setUint16(8, 1, true)
  dv.setUint16(10, 0, true)
  dv.setUint16(12, 2, true)
  dv.setUint32(14, strBytes.length, true)
  dv.setUint32(18, 22, true)
  buf.set(strBytes, 22)

  return buf
}

function buildWebp(precedingChunkLength: number, workflowJson: string): File {
  const exifPayload = buildExifPayload(workflowJson)
  const precedingPadded = precedingChunkLength + (precedingChunkLength % 2)
  const totalSize = 12 + (8 + precedingPadded) + (8 + exifPayload.length)

  const buffer = new Uint8Array(totalSize)
  const dv = new DataView(buffer.buffer)

  buffer.set([0x52, 0x49, 0x46, 0x46], 0)
  dv.setUint32(4, totalSize - 8, true)
  buffer.set([0x57, 0x45, 0x42, 0x50], 8)

  buffer.set([0x56, 0x50, 0x38, 0x20], 12)
  dv.setUint32(16, precedingChunkLength, true)

  const exifStart = 20 + precedingPadded
  buffer.set([0x45, 0x58, 0x49, 0x46], exifStart)
  dv.setUint32(exifStart + 4, exifPayload.length, true)
  buffer.set(exifPayload, exifStart + 8)

  return new File([buffer], 'test.webp', { type: 'image/webp' })
}

describe('getWebpMetadata', () => {
  it('finds workflow when a preceding chunk has odd length (RIFF padding)', async () => {
    const workflow = '{"nodes":[]}'
    const file = buildWebp(3, workflow)

    const metadata = await getWebpMetadata(file)

    expect(metadata.workflow).toBe(workflow)
  })

  it('finds workflow when preceding chunk has even length (no padding)', async () => {
    const workflow = '{"nodes":[1]}'
    const file = buildWebp(4, workflow)

    const metadata = await getWebpMetadata(file)

    expect(metadata.workflow).toBe(workflow)
  })
})
