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
import { getFromIsobmffFile } from './isobmff'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.mp4')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.mp4'
)

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

  describe('FileReader failure modes', () => {
    afterEach(() => vi.restoreAllMocks())

    const file = new File([new Uint8Array(16)], 'test.mp4')

    it('resolves empty when the FileReader fires error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockFileReaderError('readAsArrayBuffer')
      expect(await getFromIsobmffFile(file)).toEqual({})
      expect(console.error).not.toHaveBeenCalled()
    })

    it('resolves empty when the FileReader fires abort', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      mockFileReaderAbort('readAsArrayBuffer')
      expect(await getFromIsobmffFile(file)).toEqual({})
      expect(console.error).not.toHaveBeenCalled()
    })
  })
})
