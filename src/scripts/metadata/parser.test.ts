import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

import { getWorkflowDataFromFile } from './parser'

describe('getWorkflowDataFromFile', () => {
  it.for(['with_metadata.webp', 'with_metadata_exif_prefix.webp'])(
    'reads workflow and prompt from %s',
    async (name) => {
      const bytes = fs.readFileSync(path.join(__dirname, '__fixtures__', name))
      const file = new File([bytes], name, { type: 'image/webp' })

      expect(await getWorkflowDataFromFile(file)).toEqual({
        workflow:
          '{"nodes":[{"id":1,"type":"KSampler","pos":[100,100],"size":[200,200]}]}',
        prompt: '{"1":{"class_type":"KSampler","inputs":{}}}'
      })
    }
  )

  it.for(['test.latent', 'test.safetensors'])(
    'reads latent metadata from %s without a MIME type',
    async (name) => {
      const header = new TextEncoder().encode(
        '{"__metadata__":{"workflow":"latent workflow","prompt":"latent prompt"}}'
      )
      const bytes = new Uint8Array(8 + header.length)
      new DataView(bytes.buffer).setUint32(0, header.length, true)
      bytes.set(header, 8)

      expect(await getWorkflowDataFromFile(new File([bytes], name))).toEqual({
        workflow: 'latent workflow',
        prompt: 'latent prompt'
      })
    }
  )

  it('preserves the empty WebP workflow and prompt shape', async () => {
    const file = new File([new Uint8Array(12)], 'invalid.webp', {
      type: 'image/webp'
    })

    expect(await getWorkflowDataFromFile(file)).toEqual({
      workflow: undefined,
      prompt: undefined
    })
  })

  it('returns undefined for malformed latent metadata', async () => {
    expect(
      await getWorkflowDataFromFile(
        new File([new Uint8Array(4)], 'invalid.latent')
      )
    ).toBeUndefined()
  })

  it('returns undefined for an unsupported file', async () => {
    expect(
      await getWorkflowDataFromFile(new File(['text'], 'test.txt'))
    ).toBeUndefined()
  })
})
