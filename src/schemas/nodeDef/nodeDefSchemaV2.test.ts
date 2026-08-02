import { describe, expect, it } from 'vitest'

import { isUploadComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

describe('isUploadComboInputSpec', () => {
  it.for([
    { name: 'image_upload', flags: { image_upload: true } },
    { name: 'animated_image_upload', flags: { animated_image_upload: true } },
    { name: 'video_upload', flags: { video_upload: true } },
    { name: 'audio_upload', flags: { audio_upload: true } },
    { name: 'mesh_upload', flags: { mesh_upload: true } }
  ])('is true for a combo spec with $name', ({ flags }) => {
    const spec: InputSpec = { type: 'COMBO', name: 'image', ...flags }
    expect(isUploadComboInputSpec(spec)).toBe(true)
  })

  it('is false for a plain value combo spec', () => {
    const spec: InputSpec = {
      type: 'COMBO',
      name: 'ckpt_name',
      options: ['a.safetensors', 'b.safetensors']
    }
    expect(isUploadComboInputSpec(spec)).toBe(false)
  })

  it('is false for a non-combo spec', () => {
    const spec: InputSpec = { type: 'STRING', name: 'text' }
    expect(isUploadComboInputSpec(spec)).toBe(false)
  })
})
