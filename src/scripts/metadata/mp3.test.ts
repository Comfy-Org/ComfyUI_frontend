import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getMp3Metadata } from './mp3'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.mp3')

afterEach(() => vi.restoreAllMocks())

describe('MP3 metadata', () => {
  it('extracts workflow and prompt from ID3 tags', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.mp3', { type: 'audio/mpeg' })

    const result = await getMp3Metadata(file)

    expect(result.workflow).toEqual({
      nodes: [{ id: 1, type: 'KSampler', pos: [100, 100], size: [200, 200] }]
    })
    expect(result.prompt).toEqual({
      '1': { class_type: 'KSampler', inputs: {} }
    })
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

  it('handles files larger than 4096 bytes without RangeError', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const size = 5000
    const buf = new Uint8Array(size)
    buf[4500] = 0xff
    buf[4501] = 0xfb
    const file = new File([buf], 'large.mp3', { type: 'audio/mpeg' })

    const result = await getMp3Metadata(file)

    expect(result.workflow).toBeUndefined()
    expect(result.prompt).toBeUndefined()
  })
})
