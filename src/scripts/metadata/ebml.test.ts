import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EXPECTED_PROMPT,
  EXPECTED_WORKFLOW,
  mockFileReaderAbort,
  mockFileReaderError
} from './__fixtures__/helpers'
import { getFromWebmFile } from './ebml'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.webm')

describe('WebM/EBML metadata', () => {
  it('extracts workflow and prompt from EBML SimpleTag elements', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.webm', { type: 'video/webm' })

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
  })
})
