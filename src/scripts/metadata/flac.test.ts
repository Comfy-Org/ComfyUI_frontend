import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { getFromFlacBuffer } from './flac'

const fixturePath = path.resolve(__dirname, '__fixtures__/with_metadata.flac')

describe('FLAC metadata', () => {
  it('extracts workflow and prompt from Vorbis comments', () => {
    const bytes = fs.readFileSync(fixturePath)
    const buffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    )

    const result = getFromFlacBuffer(buffer)

    expect(result.workflow).toBe(
      '{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}'
    )
    expect(result.prompt).toBe('{"1":{"class_type":"KSampler","inputs":{}}}')
  })

  it('returns undefined for non-FLAC data', () => {
    const buf = new ArrayBuffer(16)
    const result = getFromFlacBuffer(buf)
    expect(result).toBeUndefined()
  })
})
