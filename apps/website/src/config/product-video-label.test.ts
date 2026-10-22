import { describe, expect, it } from 'vitest'

import { productVideoLabelFor } from './product-video-label'

describe('productVideoLabelFor', () => {
  it('falls back to the English label for Japanese', () => {
    expect(productVideoLabelFor('ja')).toBe('Comfy API product demo')
  })
})
