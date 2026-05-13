import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_PROMPT_NAN_COERCED,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getOggMetadata } from './ogg'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.opus')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.opus'
)

afterEach(() => vi.restoreAllMocks())

describe('OGG/Opus metadata', () => {
  it('extracts workflow and prompt from an Opus file', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.opus', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it('parses Python generated prompt with bare NaN/Infinity tokens', async () => {
    const bytes = fs.readFileSync(nanFixturePath)
    const file = new File([bytes], 'nan.opus', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toEqual(EXPECTED_PROMPT_NAN_COERCED)
  })

  it('returns undefined fields for non-OGG data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = new File([new Uint8Array(16)], 'fake.ogg', {
      type: 'audio/ogg'
    })

    const result = await getOggMetadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toBeUndefined()
    expect(console.error).toHaveBeenCalledWith('Invalid file signature.')
  })

  it('handles files larger than 4096 bytes without RangeError', async () => {
    const size = 5000
    const buf = new Uint8Array(size)
    const oggs = new TextEncoder().encode('OggS\0')
    buf.set(oggs, 0)
    buf.set(oggs, 4500)
    const file = new File([buf], 'large.ogg', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toBeUndefined()
  })

  it('logs and skips when embedded JSON is malformed', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const metadata = `prompt={not json}\0workflow={also bad}\0`
    const oggs = new TextEncoder().encode('OggS\0')
    const buf = new Uint8Array(128)
    buf.set(oggs, 0)
    for (let i = 0; i < metadata.length; i++) {
      buf[16 + i] = metadata.charCodeAt(i)
    }
    buf.set(oggs, 16 + metadata.length + 8)
    const file = new File([buf], 'malformed.opus', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.prompt).toBeUndefined()
    expect(result.workflow).toBeUndefined()
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to parse Ogg prompt metadata',
      expect.any(SyntaxError)
    )
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to parse Ogg workflow metadata',
      expect.any(SyntaxError)
    )
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.ogg')

    it('resolves undefined fields when the FileReader fires error', async () => {
      mockFileReaderError('readAsArrayBuffer')

      const result = await getOggMetadata(file)

      expect(result).toEqual({ prompt: undefined, workflow: undefined })
    })

    it('resolves undefined fields when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')

      const result = await getOggMetadata(file)

      expect(result).toEqual({ prompt: undefined, workflow: undefined })
    })
  })
})
