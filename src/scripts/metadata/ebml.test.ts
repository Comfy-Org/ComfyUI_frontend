import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_PROMPT_NAN_COERCED,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getFromWebmFile } from './ebml'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.webm')
const nanFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_nan_metadata.webm'
)
const legacyCommentFixturePath = path.resolve(
  __dirname,
  '__fixtures__/with_vhs_legacy_comment.webm'
)

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

  it('reads workflow and prompt from a legacy VideoHelperSuite COMMENT tag', async () => {
    const bytes = fs.readFileSync(legacyCommentFixturePath)
    const file = new File([bytes], 'vhs.webm', { type: 'video/webm' })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toEqual(EXPECTED_WORKFLOW)
    expect(result.prompt).toEqual(EXPECTED_PROMPT)
  })

  it('returns empty for non-WebM data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.webm')

    const result = await getFromWebmFile(file)

    expect(result).toEqual({})
  })

  describe('FileReader failure modes', () => {
    const file = new File([new Uint8Array(16)], 'test.webm')

    it('resolves empty when the FileReader fires error', async () => {
      mockFileReaderError('readAsArrayBuffer')
      expect(await getFromWebmFile(file)).toEqual({})
    })

    it('resolves empty when the FileReader fires abort', async () => {
      mockFileReaderAbort('readAsArrayBuffer')
      expect(await getFromWebmFile(file)).toEqual({})
    })
  })
})
