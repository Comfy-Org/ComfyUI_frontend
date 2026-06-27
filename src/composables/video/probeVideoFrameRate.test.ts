import { describe, expect, it } from 'vitest'

import { parseMp4AverageFrameRate } from './probeVideoFrameRate'

function writeUint32(value: number): Uint8Array {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, value)
  return bytes
}

function writeBox(type: string, content: Uint8Array): Uint8Array {
  const box = new Uint8Array(8 + content.length)
  box.set(writeUint32(8 + content.length), 0)
  for (let index = 0; index < 4; index++) {
    box[4 + index] = type.charCodeAt(index)
  }
  box.set(content, 8)
  return box
}

function concatBoxes(...boxes: Uint8Array[]): Uint8Array {
  const totalLength = boxes.reduce((sum, box) => sum + box.length, 0)
  const merged = new Uint8Array(totalLength)
  let offset = 0
  for (const box of boxes) {
    merged.set(box, offset)
    offset += box.length
  }
  return merged
}

function createVideoTrackBox(
  sampleCount: number,
  timescale: number
): Uint8Array {
  const handler = writeBox(
    'hdlr',
    concatBoxes(
      writeUint32(0),
      writeUint32(0),
      new Uint8Array([0x76, 0x69, 0x64, 0x65])
    )
  )
  const mediaHeader = writeBox(
    'mdhd',
    concatBoxes(
      writeUint32(0),
      writeUint32(0),
      writeUint32(0),
      writeUint32(timescale),
      writeUint32(timescale * 10)
    )
  )
  const sampleSizes = writeBox(
    'stsz',
    concatBoxes(writeUint32(0), writeUint32(0), writeUint32(sampleCount))
  )
  const media = writeBox('mdia', concatBoxes(mediaHeader, sampleSizes, handler))
  return writeBox('trak', concatBoxes(media))
}

describe('parseMp4AverageFrameRate', () => {
  it('derives average frame rate from video track sample count and duration', () => {
    const moov = writeBox('moov', createVideoTrackBox(240, 24))
    const data = concatBoxes(moov)

    expect(parseMp4AverageFrameRate(data, 10)).toBe(24)
  })

  it('returns undefined when moov metadata is missing', () => {
    expect(parseMp4AverageFrameRate(new Uint8Array([0, 0, 0, 0]), 10)).toBe(
      undefined
    )
  })
})
