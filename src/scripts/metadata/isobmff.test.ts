import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { getFromIsobmffFile } from './isobmff'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.mp4')

describe('ISOBMFF (MP4) metadata', () => {
  it('extracts workflow and prompt from QuickTime keys/ilst boxes', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.mp4', { type: 'video/mp4' })

    const result = await getFromIsobmffFile(file)

    expect(result.workflow).toEqual({
      nodes: [{ id: 1, type: 'KSampler', pos: [100, 100], size: [200, 200] }]
    })
    expect(result.prompt).toEqual({
      '1': { class_type: 'KSampler', inputs: {} }
    })
  })

  it('returns empty for non-ISOBMFF data', async () => {
    const file = new File([new Uint8Array(16)], 'fake.mp4', {
      type: 'video/mp4'
    })

    const result = await getFromIsobmffFile(file)

    expect(result).toEqual({})
  })
})
