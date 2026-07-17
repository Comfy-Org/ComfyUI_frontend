import fs from 'fs'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_PROMPT_NAN_COERCED,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getFromAvifFile } from './avif'
import { getWorkflowDataFromFile } from './parser'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.avif')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.avif'
)

afterEach(() => vi.restoreAllMocks())

describe('AVIF metadata', () => {
  it('extracts workflow and prompt from EXIF data in ISOBMFF boxes', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.avif', { type: 'image/avif' })

    const result = await getFromAvifFile(file)

    expect(JSON.parse(result.workflow)).toEqual(EXPECTED_WORKFLOW)
    expect(JSON.parse(result.prompt)).toEqual(EXPECTED_PROMPT)
  })

  it('parses Python generated prompt with bare NaN/Infinity tokens', async () => {
    const bytes = fs.readFileSync(nanFixturePath)
    const file = new File([bytes], 'nan.avif', { type: 'image/avif' })

    const result = await getFromAvifFile(file)

    expect(result.workflow).toBeUndefined()
    expect(JSON.parse(result.prompt)).toEqual(EXPECTED_PROMPT_NAN_COERCED)
  })

  it('returns empty for non-AVIF data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = new File([new Uint8Array(16)], 'fake.avif')

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
    expect(console.error).toHaveBeenCalledWith('Not a valid AVIF file')
  })

  it('returns empty when AVIF has valid ftyp but corrupt internal boxes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const buf = new Uint8Array(40)
    const dv = new DataView(buf.buffer)
    dv.setUint32(0, 16)
    buf.set(new TextEncoder().encode('ftypavif'), 4)
    dv.setUint32(16, 24)
    buf.set(new TextEncoder().encode('meta'), 20)

    const file = new File([buf], 'corrupt.avif', { type: 'image/avif' })
    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing AVIF metadata'),
      expect.anything()
    )
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.avif')

    it('resolves empty when the FileReader fires error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockFileReaderError('readAsArrayBuffer')
      expect(await getFromAvifFile(file)).toEqual({})
    })

    it('resolves empty when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')
      expect(await getFromAvifFile(file)).toEqual({})
    })
  })
})

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
  version = 2,
  contentType?: string
): Uint8Array => {
  const itemName = itemType === 'mime' ? 'XMP' : ''
  const itemInfo = new TextEncoder().encode(
    `${itemName}\0${contentType === undefined ? '' : `${contentType}\0`}`
  )
  const bodySize = 4 + 2 + 2 + 4 + itemInfo.length
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
    buf.set(itemInfo, 20)
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
  xmp?: string
  includeExif?: boolean
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
    xmp,
    includeExif = true,
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

  const items: {
    itemId: number
    itemType: string
    contentType?: string
    data: Uint8Array
  }[] = []
  if (includeExif) {
    items.push({
      itemId: items.length + 1,
      itemType,
      data: buildExifBlob(exifEntries, endian)
    })
  }
  if (xmp !== undefined) {
    items.push({
      itemId: items.length + 1,
      itemType: 'mime',
      contentType: 'application/rdf+xml',
      data: new TextEncoder().encode(xmp)
    })
  }

  const iinf = buildIinfBox(
    items.map(({ itemId, itemType, contentType }) =>
      buildInfeBox(itemId, itemType, infeVersion, contentType)
    )
  )
  const placeholderIloc = buildIlocBox(
    items.map(({ itemId, data }) => ({
      itemId,
      extentOffset: 0,
      extentLength: data.length
    }))
  )
  const metaSize = 8 + 4 + iinf.length + (omitIloc ? 0 : placeholderIloc.length)
  let itemOffset = ftyp.length + metaSize
  const itemLocations = items.map(({ itemId, data }) => {
    const location = {
      itemId,
      extentOffset: itemOffset,
      extentLength: data.length
    }
    itemOffset += data.length
    return location
  })

  const finalIloc = buildIlocBox(itemLocations)
  const finalInner = omitIloc ? [iinf] : [iinf, finalIloc]
  const meta = buildMetaBox(finalInner)

  const total =
    ftyp.length +
    meta.length +
    items.reduce((length, item) => length + item.data.length, 0)
  const buf = new Uint8Array(total)
  let p = 0
  buf.set(ftyp, p)
  p += ftyp.length
  buf.set(meta, p)
  p += meta.length
  for (const item of items) {
    buf.set(item.data, p)
    p += item.data.length
  }
  return buf.slice().buffer as ArrayBuffer
}

function buildXmpPacket(workflow: string, prompt?: string): string {
  const promptProperty = prompt ? `<pm:prompt>${prompt}</pm:prompt>` : ''
  return `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description xmlns:pm="https://ai-foundry.dev/ns/pixelmeta/1.0/" rdf:about="">${promptProperty}<pm:workflow>${workflow}</pm:workflow></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`
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

  it('imports workflow and prompt from a standard XMP item', async () => {
    const workflow = '{"nodes":[],"version":1}'
    const prompt = '{"1":{"class_type":"KSampler"}}'
    const file = fileFromBuffer(
      buildAvifFile({
        includeExif: false,
        xmp: buildXmpPacket(workflow, prompt)
      })
    )

    const result = await getWorkflowDataFromFile(file)

    expect(result).toEqual({ workflow, prompt })
  })

  it('prefers valid XMP values while retaining EXIF-only metadata', async () => {
    const exifWorkflow = '{"source":"exif"}'
    const xmpWorkflow = '{"source":"xmp"}'
    const prompt = '{"1":{"class_type":"KSampler"}}'
    const file = fileFromBuffer(
      buildAvifFile({
        exifEntries: [`workflow:${exifWorkflow}`, `prompt:${prompt}`],
        xmp: buildXmpPacket(xmpWorkflow)
      })
    )

    const result = await getFromAvifFile(file)

    expect(result.workflow).toBe(xmpWorkflow)
    expect(result.prompt).toBe(prompt)
  })
})
