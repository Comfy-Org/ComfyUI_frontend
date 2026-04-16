import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { getFromWebmFile } from './ebml'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.webm')

describe('WebM/EBML metadata', () => {
  it('extracts workflow and prompt from EBML SimpleTag elements', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.webm', { type: 'video/webm' })

    const result = await getFromWebmFile(file)

    expect(result.workflow).toEqual({
      nodes: [{ id: 1, type: 'KSampler', pos: [100, 100], size: [200, 200] }]
    })
    expect(result.prompt).toEqual({
      '1': { class_type: 'KSampler', inputs: {} }
    })
  })

  it('returns empty for non-WebM data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.webm')

    const result = await getFromWebmFile(file)

    expect(result).toEqual({})
  })
})
