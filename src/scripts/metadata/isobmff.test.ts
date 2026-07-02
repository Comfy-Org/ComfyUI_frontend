import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_PROMPT_NAN_COERCED,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError,
  mockFileReaderResult
} from './__fixtures__/helpers'
import { getFromIsobmffFile } from './isobmff'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.mp4')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.mp4'
)
const encoder = new TextEncoder()

function uint32(value: number) {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ])
}

function concatBytes(...chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

function box(type: string, payload = new Uint8Array(), size?: number) {
  return concatBytes(
    uint32(size ?? 8 + payload.length),
    encoder.encode(type),
    payload
  )
}

function keyEntry(name: string) {
  const encoded = encoder.encode(name)
  return concatBytes(
    uint32(8 + encoded.length),
    encoder.encode('mdta'),
    encoded
  )
}

function keysBox(names: string[]) {
  return box(
    'keys',
    concatBytes(uint32(0), uint32(names.length), ...names.map(keyEntry))
  )
}

function dataBox(value: string | Uint8Array) {
  const payload = typeof value === 'string' ? encoder.encode(value) : value
  return box('data', concatBytes(uint32(0), uint32(0), payload))
}

function ilstItem(index: number, payload: Uint8Array) {
  return concatBytes(uint32(8 + payload.length), uint32(index), payload)
}

function ilstBox(...items: Uint8Array[]) {
  return box('ilst', concatBytes(...items))
}

function metaBox(...children: Uint8Array[]) {
  return box('meta', concatBytes(uint32(0), ...children))
}

function udtaWithMeta(...children: Uint8Array[]) {
  return box('udta', metaBox(...children))
}

async function readMp4(bytes: Uint8Array) {
  return getFromIsobmffFile(
    new File([bytes as Uint8Array<ArrayBuffer>], 'test.mp4', {
      type: 'video/mp4'
    })
  )
}

describe('ISOBMFF (MP4) metadata', () => {
  it('extracts workflow and prompt from QuickTime keys/ilst boxes', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.mp4', { type: 'video/mp4' })

    const result = await getFromIsobmffFile(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it('parses Python generated prompt with bare NaN/Infinity tokens', async () => {
    const bytes = fs.readFileSync(nanFixturePath)
    const file = new File([bytes], 'nan.mp4', { type: 'video/mp4' })

    const result = await getFromIsobmffFile(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toEqual(EXPECTED_PROMPT_NAN_COERCED)
  })

  it('returns empty for non-ISOBMFF data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.mp4', {
      type: 'video/mp4'
    })

    const result = await getFromIsobmffFile(file)

    expect(result).toEqual({})
  })

  it('extracts metadata from udta nested inside moov', async () => {
    const bytes = box(
      'moov',
      udtaWithMeta(
        keysBox(['WORKFLOW']),
        ilstBox(ilstItem(1, dataBox('xxxx{"nodes":[]}')))
      )
    )

    const result = await readMp4(bytes)

    expect(result.workflow).toEqual({ nodes: [] })
  })

  it('returns empty when a top-level box declares an impossible size', async () => {
    const result = await readMp4(box('free', new Uint8Array([1, 2]), 100))

    expect(result).toEqual({})
  })

  it('returns empty when the keys box cannot provide entries', async () => {
    const tooShortKeys = box('keys', uint32(0))
    const missingKeyEntry = box(
      'keys',
      concatBytes(uint32(0), uint32(1), uint32(8))
    )
    const malformedKey = box(
      'keys',
      concatBytes(uint32(0), uint32(1), uint32(7), encoder.encode('bad!'))
    )
    const oversizedKey = box(
      'keys',
      concatBytes(uint32(0), uint32(1), uint32(100), encoder.encode('bad!'))
    )

    await expect(readMp4(udtaWithMeta(tooShortKeys))).resolves.toEqual({})
    await expect(readMp4(udtaWithMeta(missingKeyEntry))).resolves.toEqual({})
    await expect(readMp4(udtaWithMeta(malformedKey))).resolves.toEqual({})
    await expect(readMp4(udtaWithMeta(oversizedKey))).resolves.toEqual({})
  })

  it('ignores item entries whose key is unknown or unsupported', async () => {
    const unknownIndex = udtaWithMeta(
      keysBox(['PROMPT']),
      ilstBox(ilstItem(2, dataBox('{"1":{}}')))
    )
    const unsupportedKey = udtaWithMeta(
      keysBox(['DESCRIPTION']),
      ilstBox(ilstItem(1, dataBox('{"ignored":true}')))
    )

    await expect(readMp4(unknownIndex)).resolves.toEqual({})
    await expect(readMp4(unsupportedKey)).resolves.toEqual({})
  })

  it('ignores metadata items without readable JSON data', async () => {
    const shortDataBox = box('data')
    const noJson = dataBox('not-json')
    const invalidJson = dataBox('prefix {not-json')
    const noDataBox = box('free', new Uint8Array([1]))
    const invalidItems = ilstBox(
      concatBytes(uint32(8), uint32(1)),
      concatBytes(uint32(100), uint32(1), invalidJson)
    )

    await expect(
      readMp4(
        udtaWithMeta(keysBox(['PROMPT']), ilstBox(ilstItem(1, shortDataBox)))
      )
    ).resolves.toEqual({})
    await expect(
      readMp4(udtaWithMeta(keysBox(['PROMPT']), ilstBox(ilstItem(1, noJson))))
    ).resolves.toEqual({})
    await expect(
      readMp4(
        udtaWithMeta(keysBox(['PROMPT']), ilstBox(ilstItem(1, invalidJson)))
      )
    ).resolves.toEqual({})
    await expect(
      readMp4(
        udtaWithMeta(keysBox(['PROMPT']), ilstBox(ilstItem(1, noDataBox)))
      )
    ).resolves.toEqual({})
    await expect(
      readMp4(udtaWithMeta(keysBox(['PROMPT']), invalidItems))
    ).resolves.toEqual({})
  })

  it('returns empty when required metadata boxes are absent', async () => {
    await expect(readMp4(box('udta', box('free')))).resolves.toEqual({})
    await expect(readMp4(udtaWithMeta(ilstBox()))).resolves.toEqual({})
    await expect(readMp4(udtaWithMeta(keysBox(['PROMPT'])))).resolves.toEqual(
      {}
    )
  })

  describe('FileReader failure modes', () => {
    afterEach(() => vi.restoreAllMocks())

    const file = new File([new Uint8Array(16)], 'test.mp4')

    it('resolves empty when the FileReader fires error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockFileReaderError('readAsArrayBuffer')
      expect(await getFromIsobmffFile(file)).toEqual({})
    })

    it('resolves empty when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')
      expect(await getFromIsobmffFile(file)).toEqual({})
    })

    it('resolves empty when the FileReader load has no result', async () => {
      mockFileReaderResult('readAsArrayBuffer', null)
      expect(await getFromIsobmffFile(file)).toEqual({})
    })
  })
})
