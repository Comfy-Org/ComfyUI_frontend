import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getFromAvifFile } from './avif'

const setU32BE = (dv: DataView, off: number, val: number) =>
  dv.setUint32(off, val, false)
const setU16BE = (dv: DataView, off: number, val: number) =>
  dv.setUint16(off, val, false)

const buildExifBlob = (
  asciiEntries: string[],
  endian: 'II' | 'MM' = 'II'
): Uint8Array => {
  const isLE = endian === 'II'
  const headerSize = 8
  const ifdSize = 2 + asciiEntries.length * 12 + 4
  const entryDataSizes = asciiEntries.map((s) => s.length + 1)
  const entryDataTotal = entryDataSizes.reduce((a, b) => a + b, 0)

  const buf = new Uint8Array(headerSize + ifdSize + entryDataTotal)
  const dv = new DataView(buf.buffer)

  buf[0] = endian === 'II' ? 0x49 : 0x4d
  buf[1] = buf[0]
  dv.setUint16(2, 0x002a, isLE)
  dv.setUint32(4, 8, isLE)

  let p = 8
  dv.setUint16(p, asciiEntries.length, isLE)
  p += 2

  let dataOffset = headerSize + ifdSize
  for (let i = 0; i < asciiEntries.length; i++) {
    const dataLen = entryDataSizes[i]
    const tag = 0x9286 + i
    dv.setUint16(p, tag, isLE)
    p += 2
    dv.setUint16(p, 2, isLE)
    p += 2
    dv.setUint32(p, dataLen, isLE)
    p += 4
    dv.setUint32(p, dataOffset, isLE)
    p += 4
    const enc = new TextEncoder().encode(asciiEntries[i])
    buf.set(enc, dataOffset)
    buf[dataOffset + enc.length] = 0
    dataOffset += dataLen
  }
  dv.setUint32(p, 0, isLE)
  return buf
}

const buildInfeBox = (
  itemId: number,
  itemType: string,
  version = 2
): Uint8Array => {
  const bodySize = 4 + 2 + 2 + 4 + 1 + 1
  const totalSize = 8 + bodySize
  const buf = new Uint8Array(totalSize)
  const dv = new DataView(buf.buffer)
  setU32BE(dv, 0, totalSize)
  buf.set(new TextEncoder().encode('infe'), 4)
  buf[8] = version
  if (version >= 2) {
    setU16BE(dv, 12, itemId)
    setU16BE(dv, 14, 0)
    buf.set(new TextEncoder().encode(itemType.padEnd(4).slice(0, 4)), 16)
  }
  return buf
}

const buildIinfBox = (infeBoxes: Uint8Array[]): Uint8Array => {
  const bodySize = 4 + 2 + infeBoxes.reduce((s, b) => s + b.length, 0)
  const totalSize = 8 + bodySize
  const buf = new Uint8Array(totalSize)
  const dv = new DataView(buf.buffer)
  setU32BE(dv, 0, totalSize)
  buf.set(new TextEncoder().encode('iinf'), 4)
  setU16BE(dv, 12, infeBoxes.length)
  let off = 14
  for (const ib of infeBoxes) {
    buf.set(ib, off)
    off += ib.length
  }
  return buf
}

const buildIlocBox = (
  items: { itemId: number; extentOffset: number; extentLength: number }[]
): Uint8Array => {
  const perItemSize = 2 + 2 + 0 + 2 + (4 + 4)
  const bodySize = 4 + 1 + 1 + 2 + items.length * perItemSize
  const totalSize = 8 + bodySize
  const buf = new Uint8Array(totalSize)
  const dv = new DataView(buf.buffer)
  setU32BE(dv, 0, totalSize)
  buf.set(new TextEncoder().encode('iloc'), 4)
  buf[12] = 0x44
  buf[13] = 0x00
  setU16BE(dv, 14, items.length)
  let p = 16
  for (const it of items) {
    setU16BE(dv, p, it.itemId)
    p += 2
    setU16BE(dv, p, 0)
    p += 2
    setU16BE(dv, p, 1)
    p += 2
    setU32BE(dv, p, it.extentOffset)
    p += 4
    setU32BE(dv, p, it.extentLength)
    p += 4
  }
  return buf
}

const buildMetaBox = (boxes: Uint8Array[]): Uint8Array => {
  const bodySize = 4 + boxes.reduce((s, b) => s + b.length, 0)
  const totalSize = 8 + bodySize
  const buf = new Uint8Array(totalSize)
  const dv = new DataView(buf.buffer)
  setU32BE(dv, 0, totalSize)
  buf.set(new TextEncoder().encode('meta'), 4)
  let p = 12
  for (const b of boxes) {
    buf.set(b, p)
    p += b.length
  }
  return buf
}

const buildFtypBox = (majorBrand = 'avif'): Uint8Array => {
  const buf = new Uint8Array(16)
  const dv = new DataView(buf.buffer)
  setU32BE(dv, 0, 16)
  buf.set(new TextEncoder().encode('ftyp'), 4)
  buf.set(new TextEncoder().encode(majorBrand.padEnd(4).slice(0, 4)), 8)
  setU32BE(dv, 12, 0)
  return buf
}

interface BuildAvifOpts {
  exifEntries?: string[]
  endian?: 'II' | 'MM'
  itemType?: string
  ftypBrand?: string
  omitMeta?: boolean
  omitIloc?: boolean
  infeVersion?: number
}

const buildAvifFile = (opts: BuildAvifOpts = {}): ArrayBuffer => {
  const {
    exifEntries = [],
    endian = 'II',
    itemType = 'Exif',
    ftypBrand = 'avif',
    omitMeta = false,
    omitIloc = false,
    infeVersion = 2
  } = opts

  const ftyp = buildFtypBox(ftypBrand)
  if (omitMeta) {
    return ftyp.slice().buffer as ArrayBuffer
  }

  const exifData = buildExifBlob(exifEntries, endian)
  const infe = buildInfeBox(1, itemType, infeVersion)
  const iinf = buildIinfBox([infe])

  const realIloc = buildIlocBox([
    { itemId: 1, extentOffset: 0, extentLength: exifData.length }
  ])
  const metaSize = 8 + 4 + iinf.length + (omitIloc ? 0 : realIloc.length)
  const exifOffset = ftyp.length + metaSize

  const finalIloc = buildIlocBox([
    { itemId: 1, extentOffset: exifOffset, extentLength: exifData.length }
  ])
  const finalInner = omitIloc ? [iinf] : [iinf, finalIloc]
  const meta = buildMetaBox(finalInner)

  const total = ftyp.length + meta.length + exifData.length
  const buf = new Uint8Array(total)
  let p = 0
  buf.set(ftyp, p)
  p += ftyp.length
  buf.set(meta, p)
  p += meta.length
  buf.set(exifData, p)
  return buf.slice().buffer as ArrayBuffer
}

const fileFromBuffer = (buffer: ArrayBuffer, name = 'test.avif'): File =>
  new File([buffer], name, { type: 'image/avif' })

describe('getFromAvifFile', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'log').mockImplementation(() => undefined)
  })

  it('extracts workflow JSON from EXIF when AVIF has an Exif item', async () => {
    const workflow = '{"nodes":[],"version":1}'
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: [`workflow:${workflow}`] })
    )

    const result = await getFromAvifFile(file)

    expect(result.workflow).toBe(JSON.stringify(JSON.parse(workflow)))
  })

  it('extracts prompt JSON from EXIF', async () => {
    const prompt = '{"1":{"class_type":"KSampler"}}'
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: [`prompt:${prompt}`] })
    )

    const result = await getFromAvifFile(file)

    expect(result.prompt).toBe(JSON.stringify(JSON.parse(prompt)))
  })

  it('parses big-endian (MM) EXIF data', async () => {
    const workflow = '{"endian":"big"}'
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: [`workflow:${workflow}`], endian: 'MM' })
    )

    const result = await getFromAvifFile(file)

    expect(result.workflow).toBe(JSON.stringify(JSON.parse(workflow)))
  })

  it('returns {} when AVIF major brand is not "avif"', async () => {
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: ['workflow:{}'], ftypBrand: 'heic' })
    )

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('returns {} when meta box is missing', async () => {
    const file = fileFromBuffer(buildAvifFile({ omitMeta: true }))

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('returns {} when iinf has no Exif item', async () => {
    const file = fileFromBuffer(
      buildAvifFile({
        exifEntries: ['workflow:{}'],
        itemType: 'mime'
      })
    )

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('returns {} when EXIF entry uses an unrecognized key', async () => {
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: ['random:thing'] })
    )

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('returns {} when EXIF entry has malformed JSON', async () => {
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: ['workflow:{notjson'] })
    )

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('returns {} (and does not throw) when infe version is unsupported', async () => {
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: ['workflow:{}'], infeVersion: 1 })
    )

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('returns {} when iloc box is missing while iinf has an Exif item', async () => {
    const file = fileFromBuffer(
      buildAvifFile({ exifEntries: ['workflow:{}'], omitIloc: true })
    )

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('returns {} when buffer is too short to contain a valid header', async () => {
    const file = fileFromBuffer(new Uint8Array(4).buffer)

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
  })

  it('extracts both prompt and workflow when present in separate EXIF entries', async () => {
    const prompt = '{"node":1}'
    const workflow = '{"nodes":[1]}'
    const file = fileFromBuffer(
      buildAvifFile({
        exifEntries: [`prompt:${prompt}`, `workflow:${workflow}`]
      })
    )

    const result = await getFromAvifFile(file)

    expect(result.prompt).toBe(JSON.stringify(JSON.parse(prompt)))
    expect(result.workflow).toBe(JSON.stringify(JSON.parse(workflow)))
  })
})
