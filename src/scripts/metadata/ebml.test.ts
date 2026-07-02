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
import { getFromWebmFile } from './ebml'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.webm')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.webm'
)
const WEBM_SIGNATURE = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])
const SIMPLE_TAG = new Uint8Array([0x67, 0xc8])
const TAG_NAME = new Uint8Array([0x45, 0xa3])
const TAG_VALUE = new Uint8Array([0x44, 0x87])
const encoder = new TextEncoder()

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

function bytes(...values: number[]) {
  return new Uint8Array(values)
}

function vint(value: number) {
  return bytes(0x80 | value)
}

function element(id: Uint8Array, value: string) {
  const encoded = encoder.encode(value)
  return concatBytes(id, vint(encoded.length), encoded)
}

function simpleTag(name: string, value: string, useTwoByteSize = false) {
  const payload = concatBytes(
    element(TAG_NAME, name),
    element(TAG_VALUE, value)
  )
  const size = useTwoByteSize
    ? bytes(0x40, payload.length)
    : vint(payload.length)
  return concatBytes(SIMPLE_TAG, size, payload)
}

async function readWebm(bytes: Uint8Array) {
  return getFromWebmFile(new File([bytes], 'test.webm', { type: 'video/webm' }))
}

describe('WebM/EBML metadata', () => {
  it('extracts workflow and prompt from EBML SimpleTag elements', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.webm', { type: 'video/webm' })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it('parses Python generated prompt with bare NaN/Infinity tokens', async () => {
    const bytes = fs.readFileSync(nanFixturePath)
    const file = new File([bytes], 'nan.webm', { type: 'video/webm' })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toEqual(EXPECTED_PROMPT_NAN_COERCED)
  })

  it('returns empty for non-WebM data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.webm')

    const result = await getFromWebmFile(file)

    expect(result).toEqual({})
  })

  it('extracts plain string tags and trims null-terminated values', async () => {
    const result = await readWebm(
      concatBytes(
        WEBM_SIGNATURE,
        simpleTag('\0Comment', ' hello \0ignored', true)
      )
    )

    expect(result.comment).toBe('hello')
  })

  it('ignores prompt tags whose value is not complete JSON', async () => {
    const result = await readWebm(
      concatBytes(WEBM_SIGNATURE, simpleTag('PROMPT', '{not-json'))
    )

    expect(result.prompt).toBeUndefined()
  })

  it('ignores prompt tags whose value has no JSON object', async () => {
    const result = await readWebm(
      concatBytes(WEBM_SIGNATURE, simpleTag('PROMPT', 'not-json'))
    )

    expect(result.prompt).toBeUndefined()
  })

  it('parses the first complete JSON object from a prompt tag', async () => {
    const result = await readWebm(
      concatBytes(
        WEBM_SIGNATURE,
        simpleTag('PROMPT', 'prefix {"outer":{"inner":1}} trailing')
      )
    )

    expect(result.prompt).toEqual({ outer: { inner: 1 } })
  })

  it('ignores tags whose name has no readable text', async () => {
    const payload = concatBytes(
      concatBytes(TAG_NAME, vint(2), bytes(0, 1)),
      element(TAG_VALUE, 'value')
    )

    const result = await readWebm(
      concatBytes(WEBM_SIGNATURE, SIMPLE_TAG, vint(payload.length), payload)
    )

    expect(result).toEqual({})
  })

  it('ignores tag elements with zero-sized names', async () => {
    const payload = concatBytes(TAG_NAME, vint(0), element(TAG_VALUE, 'value'))

    const result = await readWebm(
      concatBytes(WEBM_SIGNATURE, SIMPLE_TAG, vint(payload.length), payload)
    )

    expect(result).toEqual({})
  })

  it('ignores malformed SimpleTag encodings', async () => {
    const nameOnly = element(TAG_NAME, 'comment')

    await expect(
      readWebm(concatBytes(WEBM_SIGNATURE, SIMPLE_TAG))
    ).resolves.toEqual({})
    await expect(
      readWebm(concatBytes(WEBM_SIGNATURE, SIMPLE_TAG, bytes(0x00)))
    ).resolves.toEqual({})
    await expect(
      readWebm(concatBytes(WEBM_SIGNATURE, SIMPLE_TAG, bytes(0x7f, 0xff)))
    ).resolves.toEqual({})
    await expect(
      readWebm(concatBytes(WEBM_SIGNATURE, SIMPLE_TAG, vint(10), TAG_NAME))
    ).resolves.toEqual({})
    await expect(
      readWebm(
        concatBytes(WEBM_SIGNATURE, SIMPLE_TAG, vint(nameOnly.length), nameOnly)
      )
    ).resolves.toEqual({})
  })

  describe('FileReader failure modes', () => {
    afterEach(() => vi.restoreAllMocks())

    const file = new File([new Uint8Array(16)], 'test.webm')

    it('resolves empty when the FileReader fires error', async () => {
      mockFileReaderError('readAsArrayBuffer')
      expect(await getFromWebmFile(file)).toEqual({})
    })

    it('resolves empty when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')
      expect(await getFromWebmFile(file)).toEqual({})
    })

    it('resolves empty when the FileReader load has no result', async () => {
      mockFileReaderResult('readAsArrayBuffer', null)
      expect(await getFromWebmFile(file)).toEqual({})
    })
  })
})
