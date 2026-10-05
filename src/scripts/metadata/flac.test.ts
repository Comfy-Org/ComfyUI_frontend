import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getFromFlacBuffer, getFromFlacFile } from './flac'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.flac')

function createFlacWithComments(comments: string[]): ArrayBuffer {
  const encoded = comments.map((comment) => new TextEncoder().encode(comment))
  const blockSize = encoded.reduce(
    (size, comment) => size + 4 + comment.length,
    8
  )
  const bytes = new Uint8Array(46 + blockSize)
  const view = new DataView(bytes.buffer)
  bytes.set([0x66, 0x4c, 0x61, 0x43])
  view.setUint32(4, 34)
  view.setUint32(42, 0x84000000 | blockSize)
  view.setUint32(50, encoded.length, true)
  let offset = 54
  for (const comment of encoded) {
    view.setUint32(offset, comment.length, true)
    bytes.set(comment, offset + 4)
    offset += 4 + comment.length
  }
  return bytes.buffer
}

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

  it('preserves UTF-8 workflow and prompt text from a nonzero-offset comment block', () => {
    const workflow = '{"nodes":[{"title":"日本語 café 🎵"}]}'
    const prompt = '{"1":{"inputs":{"text":"é=日本語 🎵"}}}'
    const buffer = createFlacWithComments([
      `workflow=${workflow}`,
      `prompt=${prompt}`
    ])

    expect(getFromFlacBuffer(buffer)).toEqual({ workflow, prompt })
  })

  it('rejects comment lengths that extend beyond the metadata block into following data', () => {
    const metadata = createFlacWithComments(['workflow={}'])
    const bytes = new Uint8Array(metadata.byteLength + 16)
    bytes.set(new Uint8Array(metadata))
    const view = new DataView(bytes.buffer)
    view.setUint32(54, view.getUint32(54, true) + 1, true)

    expect(() => getFromFlacBuffer(bytes.buffer)).toThrow(RangeError)
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
