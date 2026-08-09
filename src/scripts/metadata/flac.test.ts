import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getFromFlacBuffer, getFromFlacFile } from './flac'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.flac')

afterEach(() => vi.restoreAllMocks())

describe('FLAC metadata', () => {
  it('extracts workflow and prompt from Vorbis comments', () => {
    const bytes = fs.readFileSync(fixturePath)
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    )

    const result = getFromFlacBuffer(buffer)

    expect(result.workflow).toBe(JSON.stringify(EXPECTED_WORKFLOW))
    expect(result.prompt).toBe(JSON.stringify(EXPECTED_PROMPT))
  })

  it('returns empty and logs for non-FLAC data', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const buf = new ArrayBuffer(16)

    const result = getFromFlacBuffer(buf)

    expect(result).toEqual({})
    expect(console.error).toHaveBeenCalledWith('Not a valid FLAC file')
  })

  it('returns empty for a FLAC without a Vorbis Comment block', () => {
    const buffer = new Uint8Array([
      0x66, 0x4c, 0x61, 0x43, 0x80, 0x00, 0x00, 0x00
    ]).buffer

    const result = getFromFlacBuffer(buffer)

    expect(result).toEqual({})
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.flac')

    it('resolves empty when the FileReader fires error', async () => {
      mockFileReaderError('readAsArrayBuffer')

      const result = await getFromFlacFile(file)

      expect(result).toEqual({})
    })

    it('resolves empty when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')

      const result = await getFromFlacFile(file)

      expect(result).toEqual({})
    })
  })

  it('resolves empty when parsing throws on malformed data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const malformed = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0xff, 0xff])
    const file = new File([malformed], 'malformed.flac')

    const result = await getFromFlacFile(file)

    expect(result).toEqual({})
    expect(console.error).toHaveBeenCalledWith(
      'Parser: Error parsing FLAC metadata:',
      expect.anything()
    )
  })
})
