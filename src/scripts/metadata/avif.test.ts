import fs from 'fs'
import path from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getFromAvifFile } from './avif'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.avif')

afterEach(() => vi.restoreAllMocks())

describe('AVIF metadata', () => {
  it('extracts workflow and prompt from EXIF data in ISOBMFF boxes', async () => {
    const bytes = fs.readFileSync(fixturePath)
    const file = new File([bytes], 'test.avif', { type: 'image/avif' })

    const result = await getFromAvifFile(file)

    expect(JSON.parse(result.workflow)).toEqual({
      nodes: [{ id: 1, type: 'KSampler', pos: [100, 100], size: [200, 200] }]
    })
    expect(JSON.parse(result.prompt)).toEqual({
      '1': { class_type: 'KSampler', inputs: {} }
    })
  })

  it('returns empty for non-AVIF data', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const file = new File([new Uint8Array(16)], 'fake.avif')

    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
    expect(console.error).toHaveBeenCalledWith('Not a valid AVIF file')
  })

  it('returns empty when AVIF has valid ftyp but corrupt internal boxes', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const buf = new Uint8Array(40)
    const dv = new DataView(buf.buffer)
    dv.setUint32(0, 16)
    buf.set(new TextEncoder().encode('ftypavif'), 4)
    dv.setUint32(16, 24)
    buf.set(new TextEncoder().encode('meta'), 20)

    const file = new File([buf], 'corrupt.avif', { type: 'image/avif' })
    const result = await getFromAvifFile(file)

    expect(result).toEqual({})
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing AVIF metadata'),
      expect.anything()
    )
  })
})
