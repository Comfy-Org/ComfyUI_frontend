import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getMp3Metadata } from './mp3'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.mp3')

afterEach(() => vi.restoreAllMocks())

describe('MP3 metadata', () => {
  it('extracts workflow and prompt from ID3 tags', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.mp3', { type: 'audio/mpeg' })

    const result = await getMp3Metadata(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it('returns undefined fields when file has no embedded metadata', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = new File([new Uint8Array(16)], 'empty.mp3', {
      type: 'audio/mpeg'
    })

    const result = await getMp3Metadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('Invalid file signature.')
  })

  it('does not log an invalid signature for a valid MP3 sync header', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const buf = new Uint8Array(16)
    buf[0] = 0xff
    buf[1] = 0xfb
    const file = new File([buf], 'valid.mp3', { type: 'audio/mpeg' })

    await getMp3Metadata(file)

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('does not log an invalid signature for a valid ID3v2 header', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const buf = new Uint8Array(16)
    buf[0] = 0x49
    buf[1] = 0x44
    buf[2] = 0x33
    const file = new File([buf], 'valid-id3.mp3', { type: 'audio/mpeg' })

    await getMp3Metadata(file)

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('extracts metadata that spans the 4096-byte page boundary', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const metadata =
      `prompt\0${JSON.stringify(EXPECTED_PROMPT)}\0` +
      `workflow\0${JSON.stringify(EXPECTED_WORKFLOW)}\0`
    const metadataStart = 4090
    const size = metadataStart + metadata.length + 4
    const buf = new Uint8Array(size)
    for (let i = 0; i < metadata.length; i++) {
      buf[metadataStart + i] = metadata.charCodeAt(i)
    }
    buf[size - 2] = 0xff
    buf[size - 1] = 0xfb
    const file = new File([buf], 'large.mp3', { type: 'audio/mpeg' })

    const result = await getMp3Metadata(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.mp3')

    it('resolves undefined fields when the FileReader fires error', async () => {
      mockFileReaderError('readAsArrayBuffer')

      const result = await getMp3Metadata(file)

      expect(result).toEqual({ prompt: undefined, workflow: undefined })
    })

    it('resolves undefined fields when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')

      const result = await getMp3Metadata(file)

      expect(result).toEqual({ prompt: undefined, workflow: undefined })
    })
  })
})
