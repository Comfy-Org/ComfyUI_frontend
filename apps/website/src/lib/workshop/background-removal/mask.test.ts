import { describe, expect, it } from 'vitest'

import { CUTOUT_EXAMPLE, subjectMaskImage, subjectMatte } from './mask'

describe('subject matte', () => {
  it('uses the prepared cut-out as the example matte', () => {
    expect(subjectMatte(CUTOUT_EXAMPLE.url)).toBe(CUTOUT_EXAMPLE.cutout)
    expect(subjectMaskImage(CUTOUT_EXAMPLE.url)).toBe(
      `url("${CUTOUT_EXAMPLE.cutout}")`
    )
  })

  it('falls back to a soft centred oval for an upload', () => {
    expect(subjectMatte('blob:upload')).toBeUndefined()
    expect(subjectMaskImage('blob:upload')).toBe(
      'radial-gradient(ellipse 36% 44% at 50% 54%, #000 72%, transparent 100%)'
    )
  })
})
