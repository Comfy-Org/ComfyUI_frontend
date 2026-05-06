import { describe, expect, it } from 'vitest'

import { comboAdapter } from '@/renderer/extensions/vueNodes/widgets/adapters/comboAdapter'
import type { ComboInputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

function makeSpec(overrides: Partial<ComboInputSpec> = {}): ComboInputSpec {
  return {
    name: 'field',
    type: 'COMBO',
    isOptional: false,
    ...overrides
  } as ComboInputSpec
}

describe('comboAdapter.canHandle', () => {
  it('returns true for combo input specs', () => {
    expect(comboAdapter.canHandle(makeSpec())).toBe(true)
  })
})

describe('comboAdapter.extractProps', () => {
  it('returns kind=unknown when no upload flags set', () => {
    expect(comboAdapter.extractProps(makeSpec()).assetKind).toBe('unknown')
  })

  it('detects video', () => {
    expect(
      comboAdapter.extractProps(makeSpec({ video_upload: true } as never))
        .assetKind
    ).toBe('video')
  })

  it('detects image (image_upload)', () => {
    expect(
      comboAdapter.extractProps(makeSpec({ image_upload: true } as never))
        .assetKind
    ).toBe('image')
  })

  it('detects image (animated_image_upload)', () => {
    expect(
      comboAdapter.extractProps(
        makeSpec({ animated_image_upload: true } as never)
      ).assetKind
    ).toBe('image')
  })

  it('detects audio', () => {
    expect(
      comboAdapter.extractProps(makeSpec({ audio_upload: true } as never))
        .assetKind
    ).toBe('audio')
  })

  it('detects mesh and forces uploadFolder=input', () => {
    const props = comboAdapter.extractProps(
      makeSpec({ mesh_upload: true } as never)
    )
    expect(props.assetKind).toBe('mesh')
    expect(props.uploadFolder).toBe('input')
  })

  it('respects image_folder for non-mesh', () => {
    const props = comboAdapter.extractProps(
      makeSpec({ image_upload: true, image_folder: 'output' } as never)
    )
    expect(props.uploadFolder).toBe('output')
  })

  it('flags allowUpload when any *_upload is true', () => {
    expect(
      comboAdapter.extractProps(makeSpec({ image_upload: true } as never))
        .allowUpload
    ).toBe(true)
    expect(comboAdapter.extractProps(makeSpec()).allowUpload).toBe(false)
  })
})
