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

  it('returns undefined for non-FLAC data', () => {
    const buf = new ArrayBuffer(16)
    const result = getFromFlacBuffer(buf)
    expect(result).toBeUndefined()
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
})
