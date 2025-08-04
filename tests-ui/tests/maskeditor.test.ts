import { describe, expect, it } from 'vitest'

import { imageLayerFilenamesIfApplicable } from '@/extensions/core/maskEditorLayerFilenames'

describe('imageLayerFilenamesIfApplicable', () => {
  // In case the naming scheme changes, this test will ensure CI fails if developers forget to support the old naming scheme. (Causing MaskEditor to lose layer data for previously-saved images.)
  it('should support all past layer naming schemes to preserve backward compatibility', async () => {
    const dummyTimestamp = 1234567890
    const inputToSupport = `clipspace-painted-masked-${dummyTimestamp}.png`
    const expectedOutput = {
      maskedImage: `clipspace-mask-${dummyTimestamp}.png`,
      paint: `clipspace-paint-${dummyTimestamp}.png`,
      paintedImage: `clipspace-painted-${dummyTimestamp}.png`,
      paintedMaskedImage: inputToSupport
    }
    const actualOutput = imageLayerFilenamesIfApplicable(inputToSupport)
    expect(actualOutput).toEqual(expectedOutput)
  })
})
