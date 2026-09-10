import { describe, expect, it } from 'vitest'

import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

import { parseComboSpecDescriptor } from './comboSpecDescriptor'

const spec = (extra: Partial<ComboInputSpec>): ComboInputSpec => ({
  type: 'COMBO',
  name: 'test',
  ...extra
})

describe('parseComboSpecDescriptor', () => {
  it('treats a missing spec as a non-upload unknown kind', () => {
    expect(parseComboSpecDescriptor(undefined)).toEqual({
      kind: 'unknown',
      allowUpload: false,
      folder: undefined,
      subfolder: undefined
    })
  })

  it('maps each upload flag to its media kind and enables upload', () => {
    expect(parseComboSpecDescriptor(spec({ image_upload: true })).kind).toBe(
      'image'
    )
    expect(parseComboSpecDescriptor(spec({ audio_upload: true })).kind).toBe(
      'audio'
    )
    expect(parseComboSpecDescriptor(spec({ video_upload: true })).kind).toBe(
      'video'
    )
    expect(
      parseComboSpecDescriptor(spec({ audio_upload: true })).allowUpload
    ).toBe(true)
  })

  it('prefers video over image when both flags are set', () => {
    expect(
      parseComboSpecDescriptor(spec({ image_upload: true, video_upload: true }))
        .kind
    ).toBe('video')
  })

  it('forces mesh uploads into the input folder and keeps the subfolder', () => {
    expect(
      parseComboSpecDescriptor(
        spec({
          mesh_upload: true,
          image_folder: 'output',
          upload_subfolder: '3d'
        })
      )
    ).toEqual({
      kind: 'mesh',
      allowUpload: true,
      folder: 'input',
      subfolder: '3d'
    })
  })

  it('passes through image_folder for non-mesh specs', () => {
    expect(
      parseComboSpecDescriptor(
        spec({ image_upload: true, image_folder: 'output' })
      ).folder
    ).toBe('output')
  })
})
