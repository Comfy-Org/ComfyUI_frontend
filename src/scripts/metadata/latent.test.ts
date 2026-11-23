import { describe, expect, it } from 'vitest'

import { getFromLatentFile } from './latent'

describe('getFromLatentFile', () => {
  function buildSafetensors(headerObj: object): File {
    const headerBytes = new TextEncoder().encode(JSON.stringify(headerObj))
    const buf = new Uint8Array(8 + headerBytes.length)
    const dv = new DataView(buf.buffer)
    dv.setUint32(0, headerBytes.length, true)
    dv.setUint32(4, 0, true)
    buf.set(headerBytes, 8)
    return new File([buf], 'test.safetensors')
  }

  it('extracts __metadata__ from a safetensors header', async () => {
    const workflow =
      '{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}'
    const prompt = '{"1":{"class_type":"KSampler","inputs":{}}}'
    const file = buildSafetensors({
      __metadata__: { workflow, prompt },
      'tensor.weight': { dtype: 'F32', shape: [1], data_offsets: [0, 4] }
    })

    const metadata = await getFromLatentFile(file)

    expect(metadata).toEqual({ workflow, prompt })
  })

  it('returns undefined when the safetensors header has no __metadata__', async () => {
    const file = buildSafetensors({
      'tensor.weight': { dtype: 'F32', shape: [1], data_offsets: [0, 4] }
    })

    const metadata = await getFromLatentFile(file)

    expect(metadata).toBeUndefined()
  })

  it('returns undefined for a truncated or malformed file', async () => {
    const file = new File([new Uint8Array(4)], 'bad.safetensors')

    const metadata = await getFromLatentFile(file)

    expect(metadata).toBeUndefined()
  })
})
