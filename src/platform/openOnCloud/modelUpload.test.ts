import { describe, expect, it } from 'vitest'

import type { CloudMissingModel } from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  formatBytes,
  uploadFiles,
  uploadPercent
} from '@/platform/openOnCloud/modelUpload'

const lora: CloudMissingModel = {
  name: 'add-detail-xl.safetensors',
  folder: 'loras',
  bytes: 218_000_000
}
const checkpoint: CloudMissingModel = {
  name: 'juggernautXL_v9.safetensors',
  folder: 'checkpoints',
  bytes: 6_600_000_000
}

describe(uploadFiles, () => {
  it.for<{ name: string; uploadedBytes: number; expected: number[] }>([
    { name: 'nothing sent yet', uploadedBytes: 0, expected: [0, 0] },
    {
      name: 'the first model part way',
      uploadedBytes: 100_000_000,
      expected: [100_000_000, 0]
    },
    {
      name: 'the first model done, the second part way',
      uploadedBytes: 2_618_000_000,
      expected: [218_000_000, 2_400_000_000]
    },
    {
      name: 'every model done',
      uploadedBytes: 6_818_000_000,
      expected: [218_000_000, 6_600_000_000]
    }
  ])('fills the models in order: $name', ({ uploadedBytes, expected }) => {
    expect(
      uploadFiles([lora, checkpoint], uploadedBytes).map(
        (file) => file.uploadedBytes
      )
    ).toEqual(expected)
  })
})

describe(uploadPercent, () => {
  it('rounds down, so it reads 100% only once every byte is sent', () => {
    expect(uploadPercent([lora, checkpoint], 6_817_000_000)).toBe(99)
    expect(uploadPercent([lora, checkpoint], 2_618_000_000)).toBe(38)
  })
})

describe(formatBytes, () => {
  it.for<{
    bytes: number
    options?: Parameters<typeof formatBytes>[2]
    expected: string
  }>([
    { bytes: 218_000_000, expected: '218 MB' },
    { bytes: 6_818_000_000, expected: '6.8 GB' },
    {
      bytes: 2_400_000_000,
      options: { scaleBytes: 6_600_000_000, withUnit: false },
      expected: '2.4'
    }
  ])('formats $bytes as $expected', ({ bytes, options, expected }) => {
    expect(formatBytes('en', bytes, options)).toBe(expected)
  })
})
