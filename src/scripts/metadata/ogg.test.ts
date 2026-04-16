import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getOggMetadata } from './ogg'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.opus')

afterEach(() => vi.restoreAllMocks())

describe('OGG/Opus metadata', () => {
  it('extracts workflow and prompt from an Opus file', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.opus', { type: 'audio/ogg' })

    const result = await getOggMetadata(file)

    expect(result.workflow).toEqual({
      nodes: [{ id: 1, type: 'KSampler', pos: [100, 100], size: [200, 200] }]
    })
    expect(result.prompt).toEqual({
      '1': { class_type: 'KSampler', inputs: {} }
    })
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
})
